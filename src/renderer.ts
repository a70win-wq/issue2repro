/**
 * Renderers: terminal, Markdown (GitHub comment + file report) and JSON.
 *
 * Every automated GitHub comment contains the COMMENT_MARKER so that it can
 * be found and updated instead of duplicated.
 */

import { STATUS_LABELS } from "./scoring.js";
import {
  FIELD_LABELS,
  FIELD_REQUEST_PHRASES,
  type FieldKey,
  type ReproductionReport,
} from "./types.js";

export const COMMENT_MARKER = "<!-- issue2repro-report -->";

const ANSI = {
  reset: "\u001b[0m",
  bold: "\u001b[1m",
  dim: "\u001b[2m",
  red: "\u001b[31m",
  green: "\u001b[32m",
  yellow: "\u001b[33m",
  cyan: "\u001b[36m",
};

type ColorName = "bold" | "dim" | "red" | "green" | "yellow" | "cyan";

function painter(enabled: boolean) {
  return (text: string, color: ColorName): string =>
    enabled ? `${ANSI[color]}${text}${ANSI.reset}` : text;
}

function statusColor(report: ReproductionReport): ColorName {
  switch (report.readinessStatus) {
    case "excellent":
    case "reproducible":
      return "green";
    case "needs-information":
      return "yellow";
    default:
      return "red";
  }
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

// ---------------------------------------------------------------------------
// Suggested maintainer reply (deterministic, no LLM)
// ---------------------------------------------------------------------------

export function buildSuggestedReply(missingFields: string[]): string {
  const fields = missingFields.filter((field): field is FieldKey => field in FIELD_LABELS);
  if (fields.length === 0) {
    return "Thanks for the report — this issue looks ready to reproduce.";
  }
  const bullets = fields.map((field) => `- ${FIELD_REQUEST_PHRASES[field]}`);
  return [
    "Thanks for the report.",
    "",
    "To help us reproduce this issue, could you provide:",
    "",
    ...bullets,
    "",
    "Once we have these details, it should be easier to investigate.",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Terminal renderer
// ---------------------------------------------------------------------------

export interface RenderOptions {
  color?: boolean;
}

function progressBar(score: number): string {
  const total = 20;
  const filled = Math.round((score / 100) * total);
  return `${"█".repeat(filled)}${"░".repeat(total - filled)}`;
}

function box(lines: string[]): string {
  const width = Math.min(78, Math.max(...lines.map((line) => line.length)) + 2);
  const top = `╭${"─".repeat(width)}╮`;
  const bottom = `╰${"─".repeat(width)}╯`;
  const body = lines.map((line) => `│ ${truncate(line, width - 2).padEnd(width - 2)} │`);
  return [top, ...body, bottom].join("\n");
}

function orUnknown(value: string | null): string {
  return value ?? "Unknown";
}

export function renderTerminal(report: ReproductionReport, options: RenderOptions = {}): string {
  const color = options.color ?? true;
  const paint = painter(color);
  const lines: string[] = [];

  const titleLine =
    report.source.type === "github" && report.source.issueNumber !== undefined
      ? `Issue #${report.source.issueNumber} — ${report.title}`
      : report.title;

  lines.push(box(["Issue2Repro", truncate(titleLine, 120)]));
  lines.push("");
  lines.push(paint("Reproduction readiness", "bold"));
  lines.push("");
  lines.push(`${paint(progressBar(report.readinessScore), statusColor(report))} ${report.readinessScore}%`);
  lines.push("");
  lines.push(`Status: ${paint(STATUS_LABELS[report.readinessStatus], statusColor(report))}`);
  lines.push("");
  lines.push("");

  lines.push(paint("Summary", "bold"));
  lines.push("");
  lines.push(report.problemDescription ?? "Unknown");
  lines.push("");
  lines.push("");

  lines.push(paint("Environment", "bold"));
  lines.push("");
  lines.push(`Operating system: ${orUnknown(report.environment.os)}`);
  lines.push(`OS version: ${orUnknown(report.environment.osVersion)}`);
  lines.push(`Application version: ${orUnknown(report.environment.appVersion)}`);
  lines.push(`Browser: ${orUnknown(report.environment.browser)}`);
  lines.push(`Runtime: ${orUnknown(report.environment.runtime)}`);
  lines.push("");
  lines.push("");

  lines.push(paint("Reproduction Steps", "bold"));
  lines.push("");
  if (report.reproduction.steps.length === 0) {
    lines.push("Not enough information.");
  } else {
    report.reproduction.steps.forEach((step, index) => {
      lines.push(`${index + 1}. ${step}`);
    });
  }
  lines.push("");
  lines.push("");

  lines.push(paint("Expected Behaviour", "bold"));
  lines.push("");
  lines.push(orUnknown(report.reproduction.expectedBehaviour));
  lines.push("");
  lines.push("");

  lines.push(paint("Actual Behaviour", "bold"));
  lines.push("");
  lines.push(orUnknown(report.reproduction.actualBehaviour));
  lines.push("");
  lines.push("");

  lines.push(paint("Evidence", "bold"));
  lines.push("");
  const { logs, screenshots, links } = report.evidence;
  lines.push(`Logs: ${logs.length > 0 ? `${logs.length} detected` : "None detected"}`);
  lines.push(`Screenshots: ${screenshots.length > 0 ? `${screenshots.length} detected` : "None detected"}`);
  lines.push(`Reproduction links: ${links.length > 0 ? `${links.length} detected` : "None detected"}`);
  lines.push("");
  lines.push("");

  lines.push(paint("Regression", "bold"));
  lines.push("");
  lines.push(
    report.regression.detected
      ? report.regression.description ?? "Regression detected."
      : "No regression information detected.",
  );
  lines.push("");
  lines.push("");

  lines.push(paint("Missing Information", "bold"));
  lines.push("");
  if (report.missingFields.length === 0) {
    lines.push(paint("None — all tracked information is present.", "green"));
  } else {
    for (const field of report.missingFields) {
      if (field in FIELD_LABELS) {
        lines.push(`✗ ${FIELD_LABELS[field as FieldKey]}`);
      }
    }
  }
  lines.push("");
  lines.push("");

  lines.push(paint("Suggested maintainer reply", "bold"));
  lines.push("");
  lines.push(buildSuggestedReply(report.missingFields));

  return `${lines.join("\n")}\n`;
}

// ---------------------------------------------------------------------------
// Markdown renderer
// ---------------------------------------------------------------------------

export type MarkdownVariant = "comment" | "report";

function checkField(report: ReproductionReport, field: FieldKey): boolean {
  switch (field) {
    case "problem_description":
      return report.problemDescription !== null;
    case "reproduction_steps":
      return report.reproduction.steps.length > 0;
    case "expected_behavior":
      return report.reproduction.expectedBehaviour !== null;
    case "actual_behavior":
      return report.reproduction.actualBehaviour !== null;
    case "app_version":
      return report.environment.appVersion !== null;
    case "environment":
      return report.environment.os !== null;
    case "os_version":
      return report.environment.os !== null && report.environment.osVersion !== null;
    case "logs":
      return report.evidence.logs.length > 0;
    case "screenshots":
      return report.evidence.screenshots.length > 0;
    case "regression":
      return report.regression.detected;
    case "minimal_reproduction":
      return report.evidence.links.length > 0;
    default:
      return false;
  }
}

/** All field keys tracked in the report, in display order. */
function trackedFields(report: ReproductionReport): FieldKey[] {
  const seen = new Set<FieldKey>();
  const fields: FieldKey[] = [];
  for (const field of report.missingFields as FieldKey[]) {
    if (field in FIELD_LABELS && !seen.has(field)) {
      seen.add(field);
      fields.push(field);
    }
  }
  return fields;
}

function listTrackedFields(report: ReproductionReport, all: FieldKey[]): FieldKey[] {
  const present = all.filter((field) => !report.missingFields.includes(field));
  const missing = trackedFields(report);
  const combined: FieldKey[] = [];
  for (const field of [...present, ...missing]) {
    if (!combined.includes(field)) combined.push(field);
  }
  return combined;
}

export interface MarkdownRenderOptions {
  /** `comment` (GitHub issue comment) or `report` (standalone file). */
  variant?: MarkdownVariant;
}

export function renderMarkdown(
  report: ReproductionReport,
  options: MarkdownRenderOptions = {},
): string {
  const variant = options.variant ?? "comment";
  const allFields = listTrackedFields(report, [
    "problem_description",
    "reproduction_steps",
    "expected_behavior",
    "actual_behavior",
    "app_version",
    "environment",
    "os_version",
    "logs",
    "screenshots",
    "regression",
    "minimal_reproduction",
  ]);

  const lines: string[] = [];
  lines.push("## 🔎 Issue2Repro");
  lines.push("");
  lines.push(`**Reproduction readiness: ${report.readinessScore}%**`);
  lines.push("");
  lines.push(`Status: **${STATUS_LABELS[report.readinessStatus]}**`);
  lines.push("");

  lines.push("### Available information");
  lines.push("");
  for (const field of allFields) {
    lines.push(`- ${checkField(report, field) ? "✅" : "❌"} ${FIELD_LABELS[field]}`);
  }
  lines.push("");

  const missing = trackedFields(report);
  if (missing.length > 0) {
    lines.push("### Missing information");
    lines.push("");
    for (const field of missing) {
      lines.push(`- [ ] ${FIELD_LABELS[field]}`);
    }
    lines.push("");
  }

  // Details found in the issue.
  const details: string[] = [];
  if (report.problemDescription !== null) {
    details.push(`**Problem:** ${report.problemDescription}`);
  }
  const envParts = [
    report.environment.os
      ? `OS: ${report.environment.os}${report.environment.osVersion ? ` ${report.environment.osVersion}` : ""}`
      : null,
    report.environment.appVersion ? `Application version: ${report.environment.appVersion}` : null,
    report.environment.browser
      ? `Browser: ${report.environment.browser}${report.environment.browserVersion ? ` ${report.environment.browserVersion}` : ""}`
      : null,
    report.environment.runtime
      ? `Runtime: ${report.environment.runtime}${report.environment.runtimeVersion ? ` ${report.environment.runtimeVersion}` : ""}`
      : null,
  ].filter((part): part is string => part !== null);
  if (envParts.length > 0) {
    details.push(`**Environment:** ${envParts.join(" · ")}`);
  }
  if (report.reproduction.steps.length > 0) {
    details.push("**Detected steps:**");
    for (const [index, step] of report.reproduction.steps.entries()) {
      details.push(`${index + 1}. ${step}`);
    }
  }
  if (report.regression.detected && report.regression.description) {
    details.push(`**Regression:** ${report.regression.description}`);
  }
  if (report.evidence.links.length > 0) {
    details.push(`**Reproduction links:** ${report.evidence.links.join(", ")}`);
  }
  if (details.length > 0) {
    lines.push("### Detected details");
    lines.push("");
    lines.push(...details);
    lines.push("");
  }

  lines.push("### Suggested next step");
  lines.push("");
  if (missing.length === 0) {
    lines.push("This issue contains enough information to attempt reproduction.");
  } else {
    lines.push(
      "Please add the missing information above to help maintainers reproduce the issue.",
    );
  }
  lines.push("");

  if (variant === "report") {
    lines.push("### Suggested maintainer reply");
    lines.push("");
    lines.push("> " + buildSuggestedReply(report.missingFields).replace(/\n/g, "\n> "));
    lines.push("");
  }

  lines.push("---");
  lines.push("");
  lines.push("Generated by Issue2Repro.");
  lines.push("");
  lines.push(COMMENT_MARKER);

  return `${lines.join("\n")}\n`;
}

// ---------------------------------------------------------------------------
// JSON renderer
// ---------------------------------------------------------------------------

export function renderJson(report: ReproductionReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}
