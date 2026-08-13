#!/usr/bin/env node
/**
 * Issue2Repro CLI.
 *
 * Usage:
 *   issue2repro issue.md
 *   issue2repro owner/repo#123
 *   issue2repro https://github.com/owner/repo/issues/123
 *
 * Options:
 *   -o, --output <file>     write the report to a file
 *   -f, --format <format>   terminal | markdown | json
 *   -c, --config <path>     path to .issue2repro.yml
 *       --no-color          disable colored output
 */

import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { basename, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { analyzeIssue } from "./analyzer.js";
import { ConfigError, resolveConfig, type ResolvedConfig } from "./config.js";
import { fetchIssue, GitHubFetchError, parseIssueRef } from "./github.js";
import { parseMarkdown } from "./parser.js";
import { buildSuggestedReply, renderJson, renderMarkdown, renderTerminal } from "./renderer.js";
import type { IssueInput } from "./types.js";

const FORMATS = ["terminal", "markdown", "json"] as const;
type Format = (typeof FORMATS)[number];

interface CliOptions {
  output?: string;
  format: string;
  config?: string;
  color: boolean;
}

function fail(message: string): never {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function looksLikeMarkdownFile(input: string): boolean {
  const extension = extname(input).toLowerCase();
  return extension === ".md" || extension === ".markdown";
}

function loadMarkdownInput(filePath: string): IssueInput {
  let body: string;
  try {
    body = readFileSync(filePath, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    fail(`Could not read file ${filePath}: ${message}`);
  }
  const parsed = parseMarkdown(body);
  const firstHeading = parsed.headings.find((heading) => heading.level <= 2);
  const title = firstHeading?.text ?? basename(filePath, extname(filePath));
  return {
    title,
    body,
    source: { type: "markdown", file: filePath },
  };
}

export async function runCli(argv: string[]): Promise<void> {
  const program = new Command();
  program
    .name("issue2repro")
    .description(
      "Turn incomplete GitHub bug reports into structured, actionable reproduction reports.",
    )
    .argument("<input>", "Markdown file, owner/repo#123, or GitHub issue URL")
    .option("-o, --output <file>", "write the report to a file")
    .option("-f, --format <format>", "output format: terminal, markdown or json", "terminal")
    .option("-c, --config <path>", "path to .issue2repro.yml")
    .option("--no-color", "disable colored output")
    .version("0.1.0");

  program.parse(argv);
  const options = program.opts<CliOptions>();
  const input = program.args[0];
  if (!input) fail("Missing input. Provide a Markdown file, owner/repo#123 or an issue URL.");

  if (!FORMATS.includes(options.format as Format)) {
    fail(`Unknown format "${options.format}". Supported formats: ${FORMATS.join(", ")}.`);
  }
  const format = options.format as Format;

  let config: ResolvedConfig;
  try {
    config = resolveConfig(options.config);
  } catch (error) {
    if (error instanceof ConfigError) fail(error.message);
    throw error;
  }

  let issueInput: IssueInput;
  const ref = parseIssueRef(input);
  if (looksLikeMarkdownFile(input) || (existsSync(input) && ref === null)) {
    issueInput = loadMarkdownInput(input);
  } else if (ref !== null) {
    try {
      const fetched = await fetchIssue(ref);
      issueInput = {
        title: fetched.title,
        body: fetched.body,
        source: {
          type: "github",
          url: fetched.url,
          repository: fetched.repository,
          issueNumber: fetched.issueNumber,
        },
      };
    } catch (error) {
      if (error instanceof GitHubFetchError) fail(error.message);
      throw error;
    }
  } else {
    fail(
      `Unrecognised input "${input}". ` +
        "Provide an existing Markdown file, owner/repo#123, or a GitHub issue URL.",
    );
  }

  const report = analyzeIssue(issueInput, config.config);

  const color = options.color && !process.env["NO_COLOR"];

  if (options.output) {
    const content =
      format === "json" ? renderJson(report) : renderMarkdown(report, { variant: "report" });
    writeFileSync(options.output, content, "utf8");
    console.error(`Report written to ${options.output}`);
  }

  if (format === "terminal") {
    process.stdout.write(renderTerminal(report, { color }));
  } else if (format === "markdown" && !options.output) {
    process.stdout.write(renderMarkdown(report, { variant: "report" }));
  } else if (format === "json" && !options.output) {
    process.stdout.write(renderJson(report));
  }
}

// Keep the helper exported for tests and library consumers.
export { buildSuggestedReply };

function isDirectRun(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return realpathSync(entry) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isDirectRun()) {
  runCli(process.argv).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    process.exit(1);
  });
}
