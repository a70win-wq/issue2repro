/**
 * Deterministic information extraction.
 *
 * Issue content is treated as UNTRUSTED USER INPUT. The analyzer only
 * performs text matching; it never executes, evaluates, or fetches
 * anything contained in an issue.
 */

import { parseMarkdown, type ParsedMarkdown, type Section } from "./parser.js";
import type { Issue2ReproConfig } from "./config.js";
import { calculateScore, readinessStatusFor, scoreInputFromReport } from "./scoring.js";
import type {
  EnvironmentInfo,
  FieldKey,
  IssueInput,
  RegressionInfo,
  ReproductionReport,
} from "./types.js";

const KNOWN_ENVIRONMENTS = ["macOS", "Windows", "Linux", "iOS", "Android"] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function capText(text: string, max: number): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (collapsed.length <= max) return collapsed;
  return `${collapsed.slice(0, max - 1)}…`;
}

function findSection(parsed: ParsedMarkdown, names: string[]): Section | null {
  for (const section of parsed.sections) {
    if (!section.heading) continue;
    const normalized = normalizeHeading(section.heading.text);
    if (names.includes(normalized)) return section;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Heading vocabularies
// ---------------------------------------------------------------------------

const STEPS_HEADINGS = [
  "steps to reproduce",
  "reproduction steps",
  "how to reproduce",
  "steps to repro",
  "repro steps",
  "reproduce",
  "steps",
];

const EXPECTED_HEADINGS = [
  "expected",
  "expected behaviour",
  "expected behavior",
  "what should happen",
  "expected result",
  "expected results",
  "expected outcome",
];

const ACTUAL_HEADINGS = [
  "actual",
  "actual behaviour",
  "actual behavior",
  "what happened",
  "result",
  "results",
  "actual result",
  "actual results",
  "observed behaviour",
  "observed behavior",
  "observed",
];

const ENVIRONMENT_HEADINGS = [
  "environment",
  "your environment",
  "system",
  "system information",
  "system info",
  "setup",
  "versions",
  "details",
];

const DESCRIPTION_HEADINGS = [
  "describe the bug",
  "description",
  "bug description",
  "summary",
  "the problem",
  "problem",
  "bug",
];

// ---------------------------------------------------------------------------
// Reproduction steps
// ---------------------------------------------------------------------------

const MAX_STEPS = 20;

function stripLeadingNumber(text: string): string {
  return text.replace(/^\d+[.)]\s*/, "").trim();
}

function extractSteps(parsed: ParsedMarkdown): string[] {
  // 1. Dedicated "steps" section.
  const stepsSection = findSection(parsed, STEPS_HEADINGS);
  if (stepsSection) {
    const fromLists = stepsSection.lists
      .flat()
      .map((item) => item.text.trim())
      .filter((text) => text.length > 0);
    if (fromLists.length > 0) return fromLists.slice(0, MAX_STEPS);
    const fromLines = stepsSection.lines
      .map((line) => stripLeadingNumber(line))
      .filter((text) => text.length > 0);
    if (fromLines.length > 0) return fromLines.slice(0, MAX_STEPS);
  }

  // 2. Consecutive "Step N" headings.
  const stepHeadingSections = parsed.sections.filter(
    (section) => section.heading !== null && /^steps?\s*#?\s*\d+/i.test(section.heading.text),
  );
  if (stepHeadingSections.length >= 2) {
    const steps = stepHeadingSections
      .map((section) => {
        const remainder = (section.heading?.text ?? "")
          .replace(/^steps?\s*#?\s*\d+\s*[:.-]?\s*/i, "")
          .trim();
        if (remainder.length > 0) return remainder;
        return section.lines[0]?.trim() ?? "";
      })
      .filter((text) => text.length > 0);
    if (steps.length >= 2) return steps.slice(0, MAX_STEPS);
  }

  // 3. Fallback: lists anywhere outside expected/actual/environment sections.
  const excluded = new Set<Section>();
  for (const names of [EXPECTED_HEADINGS, ACTUAL_HEADINGS, ENVIRONMENT_HEADINGS]) {
    const section = findSection(parsed, names);
    if (section) excluded.add(section);
  }

  for (const ordered of [true, false]) {
    for (const section of parsed.sections) {
      if (excluded.has(section)) continue;
      for (const list of section.lists) {
        if (list.length >= 2 && (list[0]?.ordered ?? false) === ordered) {
          return list.map((item) => item.text.trim()).slice(0, MAX_STEPS);
        }
      }
    }
  }

  return [];
}

// ---------------------------------------------------------------------------
// Expected / actual behaviour
// ---------------------------------------------------------------------------

const INLINE_EXPECTED_RE = /^(?:expected(?:\s+behaviou?r)?|what should happen|expected\s+result)\s*:\s*(.+)$/i;
const INLINE_ACTUAL_RE = /^(?:actual(?:\s+behaviou?r)?|what happened|actual\s+result|result)\s*:\s*(.+)$/i;

function extractBehaviour(parsed: ParsedMarkdown, headings: string[], inline: RegExp): string | null {
  const section = findSection(parsed, headings);
  if (section) {
    const text = section.text.trim();
    if (text.length > 0) return capText(text, 500);
  }
  for (const paragraph of parsed.paragraphs) {
    for (const line of paragraph.split(/\s{2,}|\n/)) {
      const match = line.trim().match(inline);
      if (match && match[1]) return capText(match[1], 500);
    }
    const direct = paragraph.trim().match(inline);
    if (direct && direct[1]) return capText(direct[1], 500);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Problem description
// ---------------------------------------------------------------------------

const PROBLEM_TITLE_RE =
  /\b(broken|fails?|failed|failure|crash(?:es|ed|ing)?|errors?|bugs?|wrong|cannot|can'?t|unable|not working|doesn'?t work|issue|problem|slow|freezes?|hangs?)\b/i;

function extractProblemDescription(input: IssueInput, parsed: ParsedMarkdown): string | null {
  const descriptionSection = findSection(parsed, DESCRIPTION_HEADINGS);
  if (descriptionSection && descriptionSection.text.trim().length > 0) {
    return capText(descriptionSection.text, 300);
  }

  for (const paragraph of parsed.paragraphs) {
    if (paragraph.length >= 8) return capText(paragraph, 300);
  }

  if (input.title && PROBLEM_TITLE_RE.test(input.title)) {
    return capText(input.title, 300);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Environment detection
// ---------------------------------------------------------------------------

interface OsDefinition {
  name: (typeof KNOWN_ENVIRONMENTS)[number];
  detect: RegExp;
  version: RegExp | null;
}

const OS_DEFINITIONS: OsDefinition[] = [
  {
    name: "macOS",
    detect: /\bmac\s*os\s*x\b|\bmacos\b|\bos\s*x\b|\bmac\b/i,
    version: /\b(?:macos|mac\s*os\s*x|os\s*x)\s*v?(\d+(?:[._]\d+)*)/i,
  },
  {
    name: "Windows",
    detect: /\bwindows\b/i,
    version: /\bwindows\s+(?!server\b|phone\b)(\d+(?:\.\d+)?)/i,
  },
  {
    name: "Linux",
    detect:
      /\blinux\b|\bubuntu\b|\bfedora\b|\bdebian\b|\barch\b|\bmanjaro\b|\bopensuse\b|\bgentoo\b/i,
    version:
      /\b(?:ubuntu|debian|fedora|manjaro|opensuse|gentoo|linux)\s*v?(\d+(?:\.\d+)*)/i,
  },
  {
    name: "iOS",
    detect: /\bios\b|\biphone\b|\bipad\b/i,
    version: /\bios\s+v?(\d+(?:\.\d+)*)/i,
  },
  {
    name: "Android",
    detect: /\bandroid\b/i,
    version: /\bandroid\s+v?(\d+(?:\.\d+)*)/i,
  },
];

const BROWSER_DEFINITIONS = [
  { name: "Chrome", detect: /\bchrome\b|\bchromium\b/i, version: /\b(?:chrome|chromium)\s*v?(\d+(?:\.\d+)*)/i },
  { name: "Safari", detect: /\bsafari\b/i, version: /\bsafari\s*v?(\d+(?:\.\d+)*)/i },
  { name: "Firefox", detect: /\bfirefox\b/i, version: /\bfirefox\s*v?(\d+(?:\.\d+)*)/i },
  { name: "Edge", detect: /\bedge\b/i, version: /\bedge\s*v?(\d+(?:\.\d+)*)/i },
];

const RUNTIME_DEFINITIONS = [
  {
    name: "Node.js",
    detect: /\bnode(?:\.js)?\b/i,
    version: /\bnode(?:\.js)?\s+v?(\d+(?:\.\d+)*)/i,
  },
  { name: "Python", detect: /\bpython\b/i, version: /\bpython\s+v?(\d+(?:\.\d+)*)/i },
  { name: "Java", detect: /\bjava\b(?!script)/i, version: /\bjava\s+v?(\d+(?:\.\d+)*)/i },
  {
    name: "Go",
    detect: /\bgolang\b|\bgo\s+v?\d+\.\d+/i,
    version: /\bgo\s+v?(\d+\.\d+(?:\.\d+)*)/i,
  },
  { name: "Rust", detect: /\brust\b/i, version: /\brustc?\s+v?(\d+\.\d+(?:\.\d+)*)/i },
  { name: "Ruby", detect: /\bruby\b/i, version: /\bruby\s+v?(\d+(?:\.\d+)*)/i },
  { name: "PHP", detect: /\bphp\b/i, version: /\bphp\s+v?(\d+(?:\.\d+)*)/i },
];

/** Words that claim a nearby version number for themselves. */
const VERSION_BLOCKERS =
  /^(?:node|node\.js|python|java|javascript|typescript|go|golang|rust|ruby|php|chrome|chromium|safari|firefox|edge|macos|windows|linux|ubuntu|debian|fedora|ios|android|kernel|npm|yarn|pnpm|deno|bun|dotnet|\.net)$/i;

function wordBefore(text: string, index: number): string {
  const before = text.slice(Math.max(0, index - 40), index);
  const match = before.match(/([\w.]+)[\s:,\-–]*$/);
  return match?.[1] ?? "";
}

function blockedByContext(text: string, index: number): boolean {
  return VERSION_BLOCKERS.test(wordBefore(text, index));
}

function firstMatchIn(haystacks: string[], re: RegExp): RegExpMatchArray | null {
  for (const haystack of haystacks) {
    const match = haystack.match(re);
    if (match) return match;
  }
  return null;
}

function detectEnvironment(haystacks: string[]): EnvironmentInfo {
  const environment: EnvironmentInfo = {
    os: null,
    osVersion: null,
    browser: null,
    browserVersion: null,
    appVersion: null,
    runtime: null,
    runtimeVersion: null,
  };

  for (const definition of OS_DEFINITIONS) {
    if (firstMatchIn(haystacks, definition.detect)) {
      environment.os = definition.name;
      const version = definition.version ? firstMatchIn(haystacks, definition.version) : null;
      if (version && version[1]) {
        environment.osVersion = version[1].replace(/_/g, ".");
      }
      break;
    }
  }

  for (const definition of BROWSER_DEFINITIONS) {
    if (firstMatchIn(haystacks, definition.detect)) {
      environment.browser = definition.name;
      const version = firstMatchIn(haystacks, definition.version);
      if (version && version[1]) environment.browserVersion = version[1];
      break;
    }
  }

  for (const definition of RUNTIME_DEFINITIONS) {
    if (firstMatchIn(haystacks, definition.detect)) {
      environment.runtime = definition.name;
      const version = firstMatchIn(haystacks, definition.version);
      if (version && version[1]) environment.runtimeVersion = version[1];
      break;
    }
  }

  environment.appVersion = detectAppVersion(haystacks);
  return environment;
}

const APP_VERSION_EXPLICIT_RE =
  /\bversion\s*[:-]?\s*v?(\d+(?:\.\d+){1,2}(?:[-+][0-9A-Za-z.-]+)?)/gi;
const APP_VERSION_V_PREFIX_RE = /\bv(\d+\.\d+(?:\.\d+)?(?:[-+][0-9A-Za-z.-]+)?)\b/g;
const APP_VERSION_BARE_RE = /\b(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)\b/g;

function detectAppVersion(haystacks: string[]): string | null {
  const patterns = [APP_VERSION_EXPLICIT_RE, APP_VERSION_V_PREFIX_RE, APP_VERSION_BARE_RE];
  for (const pattern of patterns) {
    for (const haystack of haystacks) {
      pattern.lastIndex = 0;
      for (const match of haystack.matchAll(pattern)) {
        if (match[1] && !blockedByContext(haystack, match.index ?? 0)) {
          return match[1];
        }
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Evidence
// ---------------------------------------------------------------------------

const REPRODUCTION_LINK_HOSTS = [
  "codesandbox.io",
  "stackblitz.com",
  "codepen.io",
  "github.com",
  "gist.github.com",
  "replit.com",
];

const PROSE_LOG_LINE_RE = /\b(?:error|exception|fatal|panic|traceback)\b\s*[:-]|\bstack\s*trace\b/i;
/** Case-sensitive on purpose: matches SIGABRT, SIGSEGV, etc. (not "signed"). */
const SIGNAL_RE = /\bSIG[A-Z]{2,}\b/;

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function detectLogs(parsed: ParsedMarkdown): string[] {
  const logs: string[] = [];
  for (const block of parsed.codeBlocks) {
    const content = block.content.trim();
    if (content.length > 0) logs.push(capText(content, 1000));
  }
  for (const line of parsed.prose.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length > 0 && (PROSE_LOG_LINE_RE.test(trimmed) || SIGNAL_RE.test(trimmed))) {
      logs.push(capText(trimmed, 500));
    }
  }
  return logs.slice(0, 5);
}

const GITHUB_ATTACHMENT_RE =
  /user-images\.githubusercontent\.com|private-user-images\.githubusercontent\.com|github\.com\/[^/\s]+\/[^/\s]+\/(?:files\/\d+|attachments)/i;

function detectScreenshots(parsed: ParsedMarkdown): string[] {
  const screenshots = [...parsed.images];
  for (const url of parsed.links) {
    if (GITHUB_ATTACHMENT_RE.test(url) && !screenshots.includes(url)) {
      screenshots.push(url);
    }
  }
  return screenshots.slice(0, 10);
}

function detectReproductionLinks(parsed: ParsedMarkdown, screenshots: string[], sourceUrl?: string): string[] {
  const normalizedSource = sourceUrl ? sourceUrl.split("#")[0] : null;
  const links: string[] = [];
  for (const url of parsed.links) {
    if (screenshots.includes(url)) continue;
    if (normalizedSource && url.split("#")[0] === normalizedSource) continue;
    const host = hostOf(url);
    if (!host) continue;
    const matchesHost = REPRODUCTION_LINK_HOSTS.some(
      (allowed) => host === allowed || host.endsWith(`.${allowed}`),
    );
    if (matchesHost && !links.includes(url)) links.push(url);
  }
  return links.slice(0, 10);
}

// ---------------------------------------------------------------------------
// Regression
// ---------------------------------------------------------------------------

/** Strong, unambiguous regression signals. */
const REGRESSION_STRONG_PATTERNS: RegExp[] = [
  /\bworked before\b/i,
  /\bused to work\b/i,
  /\bworked (?:fine|ok|well)?\s*(?:in|on|with)\s*v?\d/i,
  /\bprevious version worked\b/i,
  /\bsince version\b/i,
  /\bregression\b/i,
];

/** Weaker signals that still indicate a regression. */
const REGRESSION_WEAK_PATTERNS: RegExp[] = [
  /\bstarted after (?:the )?(?:update|upgrade)\b/i,
  /\bafter (?:the )?(?:update|upgrade|upgrading|updating)\b/i,
  /\bbroken after\b/i,
  /\bsince (?:the )?(?:last )?(?:update|upgrade)\b/i,
];

function detectRegression(parsed: ParsedMarkdown): RegressionInfo {
  const lines: string[] = [];
  for (const section of parsed.sections) {
    for (const line of section.text.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.length > 0) lines.push(trimmed);
    }
  }
  for (const patterns of [REGRESSION_STRONG_PATTERNS, REGRESSION_WEAK_PATTERNS]) {
    for (const line of lines) {
      if (patterns.some((pattern) => pattern.test(line))) {
        return { detected: true, description: capText(line, 200) };
      }
    }
  }
  return { detected: false, description: null };
}

// ---------------------------------------------------------------------------
// Missing fields
// ---------------------------------------------------------------------------

function computeMissingFields(
  report: Omit<ReproductionReport, "missingFields" | "readinessScore" | "readinessStatus">,
  config: Issue2ReproConfig,
): FieldKey[] {
  const missing = new Set<FieldKey>();
  if (report.problemDescription === null) missing.add("problem_description");
  if (report.reproduction.steps.length === 0) missing.add("reproduction_steps");
  if (report.reproduction.expectedBehaviour === null) missing.add("expected_behavior");
  if (report.reproduction.actualBehaviour === null) missing.add("actual_behavior");
  if (report.environment.appVersion === null) missing.add("app_version");
  if (report.environment.os === null) missing.add("environment");
  else if (report.environment.osVersion === null) missing.add("os_version");
  if (report.evidence.logs.length === 0) missing.add("logs");
  if (report.evidence.screenshots.length === 0) missing.add("screenshots");
  if (!report.regression.detected) missing.add("regression");
  if (report.evidence.links.length === 0) missing.add("minimal_reproduction");

  const order: FieldKey[] = [
    ...config.required,
    ...config.optional.filter((field) => !config.required.includes(field)),
  ];
  return order.filter((field) => missing.has(field));
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function analyzeIssue(input: IssueInput, config: Issue2ReproConfig): ReproductionReport {
  const parsed = parseMarkdown(input.body);

  const environmentSection = findSection(parsed, ENVIRONMENT_HEADINGS);
  const haystacks: string[] = [];
  if (environmentSection && environmentSection.text.trim().length > 0) {
    haystacks.push(environmentSection.text);
  }
  haystacks.push(parsed.prose);

  const environment = detectEnvironment(haystacks);
  const steps = extractSteps(parsed);
  const expectedBehaviour = extractBehaviour(parsed, EXPECTED_HEADINGS, INLINE_EXPECTED_RE);
  const actualBehaviour = extractBehaviour(parsed, ACTUAL_HEADINGS, INLINE_ACTUAL_RE);
  const problemDescription = extractProblemDescription(input, parsed);
  const logs = detectLogs(parsed);
  const screenshots = detectScreenshots(parsed);
  const links = detectReproductionLinks(parsed, screenshots, input.source.url);
  const regression = detectRegression(parsed);

  const base = {
    source: input.source,
    title: input.title ?? "",
    problemDescription,
    environment,
    reproduction: { steps, expectedBehaviour, actualBehaviour },
    evidence: { logs, screenshots, links },
    regression,
  };

  const missingFields = computeMissingFields(base, config);
  const scoreInput = scoreInputFromReport(base);
  const readinessScore = calculateScore(scoreInput);
  const readinessStatus = readinessStatusFor(readinessScore);

  return { ...base, missingFields, readinessScore, readinessStatus };
}

export { KNOWN_ENVIRONMENTS };
