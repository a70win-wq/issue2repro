import { describe, expect, it } from "vitest";
import { parseIssueRef } from "../src/github.js";

describe("parseIssueRef", () => {
  it("parses owner/repo#123 syntax", () => {
    expect(parseIssueRef("owner/repo#123")).toEqual({
      owner: "owner",
      repo: "repo",
      issueNumber: 123,
    });
  });

  it("trims surrounding whitespace", () => {
    expect(parseIssueRef("  owner/repo#7  ")).toEqual({
      owner: "owner",
      repo: "repo",
      issueNumber: 7,
    });
  });

  it("parses full issue URLs", () => {
    expect(parseIssueRef("https://github.com/owner/repo/issues/123")).toEqual({
      owner: "owner",
      repo: "repo",
      issueNumber: 123,
    });
  });

  it("parses issue URLs with fragments and query strings", () => {
    expect(parseIssueRef("https://github.com/owner/repo/issues/123#issuecomment-1")).toEqual({
      owner: "owner",
      repo: "repo",
      issueNumber: 123,
    });
    expect(parseIssueRef("https://www.github.com/owner/repo/issues/9?ref=mail")).toEqual({
      owner: "owner",
      repo: "repo",
      issueNumber: 9,
    });
  });

  it("returns null for non-references", () => {
    expect(parseIssueRef("issue.md")).toBeNull();
    expect(parseIssueRef("https://example.com/issues/1")).toBeNull();
    expect(parseIssueRef("owner/repo")).toBeNull();
    expect(parseIssueRef("")).toBeNull();
  });
});
