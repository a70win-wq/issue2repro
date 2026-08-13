/**
 * Deterministic Markdown parsing.
 *
 * The parser is intentionally simple and defensive: issue content is
 * UNTRUSTED USER INPUT. We only tokenize text; nothing is ever executed,
 * evaluated, or fetched.
 */

export interface CodeBlock {
  /** Language info string of the fence, e.g. `js`. Null when absent. */
  lang: string | null;
  content: string;
}

export interface ListItem {
  text: string;
  ordered: boolean;
}

export interface Heading {
  /** 1-6 for real headings, 7 for bold pseudo-headings (`**Expected**`). */
  level: number;
  text: string;
}

export interface Section {
  heading: Heading | null;
  /** Prose lines belonging to this section. */
  lines: string[];
  /** Lists belonging to this section, grouped consecutively. */
  lists: ListItem[][];
  /** Prose and list text joined for regex-based extraction. */
  text: string;
}

export interface ParsedMarkdown {
  sections: Section[];
  headings: Heading[];
  codeBlocks: CodeBlock[];
  images: string[];
  links: string[];
  /** All prose text (outside code fences). */
  prose: string;
  /** Prose grouped into paragraphs. */
  paragraphs: string[];
}

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
const BOLD_PSEUDO_HEADING_RE = /^\s*(?:\*\*|__)([^*_\n]{1,80}?)(?:\*\*|__)\s*:?\s*$/;
const ORDERED_ITEM_RE = /^\s{0,3}\d+[.)]\s+(.+)$/;
const UNORDERED_ITEM_RE = /^\s{0,3}[-*+]\s+(.+)$/;
const CHECKBOX_RE = /^\[[ xX]\]\s*/;
const FENCE_OPEN_RE = /^\s*(`{3,}|~{3,})\s*([^\s`]*)\s*$/;
const IMAGE_RE = /!\[[^\]]*\]\(\s*<?([^)\s>]+)/g;
const HTML_IMG_RE = /<img[^>]*\ssrc=["']([^"']+)["']/gi;
const URL_RE = /https?:\/\/[^\s<>"'`)\]]+/g;
const HTML_COMMENT_RE = /<!--[\s\S]*?-->/g;

function stripInlineCode(line: string): string {
  return line.replace(/`([^`]*)`/g, "$1");
}

/**
 * Parse Markdown into sections, lists, code blocks, images and links.
 * HTML comments are removed before parsing so that quoted bot reports
 * cannot influence extraction.
 */
export function parseMarkdown(input: string): ParsedMarkdown {
  const text = input.replace(/\r\n/g, "\n").replace(HTML_COMMENT_RE, "");
  const lines = text.split("\n");

  const sections: Section[] = [];
  const headings: Heading[] = [];
  const codeBlocks: CodeBlock[] = [];
  const images: string[] = [];
  const links: string[] = [];
  const proseLines: string[] = [];

  let current: Section = { heading: null, lines: [], lists: [], text: "" };
  const sectionContent: string[][] = [[]];
  sections.push(current);

  let currentList: ListItem[] | null = null;
  let fenceChar: string | null = null;
  let fenceLang: string | null = null;
  let fenceBuffer: string[] = [];

  const flushList = (): void => {
    if (currentList && currentList.length > 0) {
      current.lists.push(currentList);
    }
    currentList = null;
  };

  const startSection = (heading: Heading): void => {
    flushList();
    current = { heading, lines: [], lists: [], text: "" };
    sectionContent.push([]);
    sections.push(current);
    headings.push(heading);
  };

  const pushContent = (line: string): void => {
    const bucket = sectionContent[sectionContent.length - 1];
    if (bucket) bucket.push(line);
  };

  const scanInline = (line: string): void => {
    for (const match of line.matchAll(IMAGE_RE)) {
      const url = match[1];
      if (url) images.push(url);
    }
    for (const match of line.matchAll(HTML_IMG_RE)) {
      const url = match[1];
      if (url) images.push(url);
    }
    for (const match of line.matchAll(URL_RE)) {
      const url = match[0];
      if (url && !links.includes(url)) links.push(url);
    }
  };

  for (const rawLine of lines) {
    // ---- fenced code blocks -------------------------------------------
    const fenceMatch = rawLine.match(FENCE_OPEN_RE);
    if (fenceChar === null) {
      if (fenceMatch) {
        flushList();
        fenceChar = fenceMatch[1] ? fenceMatch[1][0] ?? "`" : "`";
        fenceLang = fenceMatch[2] || null;
        fenceBuffer = [];
        continue;
      }
    } else {
      const closes =
        fenceMatch !== null &&
        fenceMatch[1] !== undefined &&
        fenceMatch[1][0] === fenceChar &&
        (fenceMatch[2] === undefined || fenceMatch[2] === "");
      if (closes) {
        codeBlocks.push({ lang: fenceLang, content: fenceBuffer.join("\n") });
        fenceChar = null;
        fenceLang = null;
        fenceBuffer = [];
      } else {
        fenceBuffer.push(rawLine);
      }
      continue;
    }

    const line = stripInlineCode(rawLine);

    // ---- headings ------------------------------------------------------
    const headingMatch = line.match(HEADING_RE);
    if (headingMatch) {
      const heading: Heading = {
        level: headingMatch[1]?.length ?? 1,
        text: headingMatch[2]?.trim() ?? "",
      };
      scanInline(line);
      startSection(heading);
      continue;
    }

    const pseudoMatch = line.match(BOLD_PSEUDO_HEADING_RE);
    if (pseudoMatch) {
      const heading: Heading = { level: 7, text: pseudoMatch[1]?.trim() ?? "" };
      scanInline(line);
      startSection(heading);
      continue;
    }

    // ---- list items ------------------------------------------------------
    const orderedMatch = line.match(ORDERED_ITEM_RE);
    const unorderedMatch = orderedMatch ? null : line.match(UNORDERED_ITEM_RE);
    if (orderedMatch || unorderedMatch) {
      const ordered = orderedMatch !== null;
      let itemText = (ordered ? orderedMatch?.[1] : unorderedMatch?.[1]) ?? "";
      itemText = itemText.replace(CHECKBOX_RE, "").trim();
      if (itemText.length > 0) {
        if (!currentList || currentList[0]?.ordered !== ordered) {
          flushList();
          currentList = [];
        }
        currentList.push({ text: itemText, ordered });
        scanInline(line);
        pushContent(itemText);
      }
      continue;
    }

    // ---- prose -----------------------------------------------------------
    flushList();
    if (line.trim() === "") {
      continue;
    }
    scanInline(line);
    current.lines.push(line.trim());
    pushContent(line.trim());
    proseLines.push(line.trim());
  }

  // Unterminated fence: keep whatever was collected.
  if (fenceChar !== null && fenceBuffer.length > 0) {
    codeBlocks.push({ lang: fenceLang, content: fenceBuffer.join("\n") });
  }
  flushList();

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const bucket = sectionContent[i];
    if (section && bucket) {
      section.text = bucket.join("\n");
    }
  }

  const paragraphs: string[] = [];
  let buffer: string[] = [];
  let inFence = false;
  let fenceCh: string | null = null;
  for (const rawLine of lines) {
    const fm = rawLine.match(FENCE_OPEN_RE);
    if (!inFence && fm) {
      inFence = true;
      fenceCh = fm[1] ? fm[1][0] ?? "`" : "`";
      if (buffer.length > 0) {
        paragraphs.push(buffer.join(" "));
        buffer = [];
      }
      continue;
    }
    if (inFence) {
      const closes =
        fm !== null && fm[1] !== undefined && fm[1][0] === fenceCh && (!fm[2] || fm[2] === "");
      if (closes) {
        inFence = false;
        fenceCh = null;
      }
      continue;
    }
    const stripped = stripInlineCode(rawLine).trim();
    if (
      stripped === "" ||
      HEADING_RE.test(stripped) ||
      BOLD_PSEUDO_HEADING_RE.test(rawLine) ||
      ORDERED_ITEM_RE.test(rawLine) ||
      UNORDERED_ITEM_RE.test(rawLine)
    ) {
      if (buffer.length > 0) {
        paragraphs.push(buffer.join(" "));
        buffer = [];
      }
      continue;
    }
    buffer.push(stripped);
  }
  if (buffer.length > 0) {
    paragraphs.push(buffer.join(" "));
  }

  // Images should not appear in the generic link list.
  const filteredLinks = links.filter((url) => !images.includes(url));

  return {
    sections,
    headings,
    codeBlocks,
    images,
    links: filteredLinks,
    prose: proseLines.join("\n"),
    paragraphs,
  };
}
