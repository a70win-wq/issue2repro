import { describe, expect, it } from "vitest";
import { parseMarkdown } from "../src/parser.js";

describe("parseMarkdown", () => {
  it("extracts fenced code blocks with language", () => {
    const parsed = parseMarkdown("Intro\n\n```console\nError: boom\n```\n\nAfter");
    expect(parsed.codeBlocks).toHaveLength(1);
    expect(parsed.codeBlocks[0]?.lang).toBe("console");
    expect(parsed.codeBlocks[0]?.content).toBe("Error: boom");
    expect(parsed.prose).not.toContain("Error: boom");
  });

  it("supports tilde fences", () => {
    const parsed = parseMarkdown("~~~\nlog line\n~~~");
    expect(parsed.codeBlocks).toHaveLength(1);
    expect(parsed.codeBlocks[0]?.content).toBe("log line");
  });

  it("strips HTML comments before parsing", () => {
    const parsed = parseMarkdown("Before <!-- hidden: ![img](https://x.test/a.png) --> after");
    expect(parsed.images).toHaveLength(0);
    expect(parsed.prose).not.toContain("hidden");
  });

  it("extracts ordered and unordered lists", () => {
    const parsed = parseMarkdown("1. Open app\n2. Click login\n\n- launch\n- sign in");
    const lists = parsed.sections[0]?.lists ?? [];
    expect(lists).toHaveLength(2);
    expect(lists[0]?.map((item) => item.text)).toEqual(["Open app", "Click login"]);
    expect(lists[0]?.[0]?.ordered).toBe(true);
    expect(lists[1]?.map((item) => item.text)).toEqual(["launch", "sign in"]);
    expect(lists[1]?.[0]?.ordered).toBe(false);
  });

  it("strips checkbox markers from list items", () => {
    const parsed = parseMarkdown("- [ ] Application version\n- [x] Logs");
    const items = parsed.sections[0]?.lists.flat() ?? [];
    expect(items.map((item) => item.text)).toEqual(["Application version", "Logs"]);
  });

  it("does not treat horizontal rules as list items", () => {
    const parsed = parseMarkdown("text\n\n---\n\nmore");
    expect(parsed.sections[0]?.lists).toHaveLength(0);
  });

  it("creates sections from headings and bold pseudo-headings", () => {
    const parsed = parseMarkdown(
      "# Title\n\nIntro text\n\n**Expected behaviour**\n\nShould work.",
    );
    expect(parsed.headings.map((heading) => heading.text)).toEqual([
      "Title",
      "Expected behaviour",
    ]);
    const pseudo = parsed.sections.find((s) => s.heading?.text === "Expected behaviour");
    expect(pseudo?.text).toContain("Should work.");
  });

  it("extracts images and links", () => {
    const parsed = parseMarkdown(
      "![error](https://example.test/error.png)\n\nSee https://stackblitz.com/edit/demo for details.",
    );
    expect(parsed.images).toEqual(["https://example.test/error.png"]);
    expect(parsed.links).toContain("https://stackblitz.com/edit/demo");
    expect(parsed.links).not.toContain("https://example.test/error.png");
  });

  it("groups prose into paragraphs", () => {
    const parsed = parseMarkdown("First paragraph line one\nline two.\n\nSecond paragraph.");
    expect(parsed.paragraphs).toEqual([
      "First paragraph line one line two.",
      "Second paragraph.",
    ]);
  });

  it("collects list text into section text for extraction", () => {
    const parsed = parseMarkdown("## Environment\n\n- macOS 15\n- Chrome 126");
    const section = parsed.sections.find((s) => s.heading?.text === "Environment");
    expect(section?.text).toContain("macOS 15");
    expect(section?.text).toContain("Chrome 126");
  });
});
