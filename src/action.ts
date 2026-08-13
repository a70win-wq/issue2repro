/**
 * GitHub Action entry point.
 *
 * Triggered on `issues.opened` / `issues.edited`. The action analyzes the
 * issue and posts (or updates) a single report comment identified by the
 * `<!-- issue2repro-report -->` marker. It never executes issue content.
 */

import { appendFileSync, readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Octokit } from "@octokit/rest";
import { analyzeIssue } from "./analyzer.js";
import { ConfigError, DEFAULT_CONFIG, parseConfigString, type Issue2ReproConfig } from "./config.js";
import { COMMENT_MARKER, renderMarkdown } from "./renderer.js";

interface IssueEvent {
  action?: string;
  issue?: {
    number: number;
    title: string;
    body: string | null;
    pull_request?: unknown;
  };
  repository?: {
    full_name: string;
    default_branch?: string;
  };
}

function getInput(name: string): string | undefined {
  const key = `INPUT_${name.toUpperCase()}`;
  return process.env[key] ?? process.env[key.replace(/-/g, "_")];
}

function setOutput(name: string, value: string): void {
  const outputFile = process.env["GITHUB_OUTPUT"];
  if (outputFile) {
    appendFileSync(outputFile, `${name}=${value}\n`, "utf8");
  }
}

async function fetchRepoConfig(
  octokit: Octokit,
  owner: string,
  repo: string,
  ref: string | undefined,
): Promise<Issue2ReproConfig> {
  for (const path of [".issue2repro.yml", ".issue2repro.yaml"]) {
    try {
      const { data } = await octokit.rest.repos.getContent({ owner, repo, path, ref });
      if (!Array.isArray(data) && data.type === "file" && typeof data.content === "string") {
        const text = Buffer.from(data.content, "base64").toString("utf8");
        return parseConfigString(text, `${owner}/${repo}/${path}`);
      }
    } catch (error) {
      const status = (error as { status?: number }).status;
      if (status === 404) continue;
      console.warn(`Warning: could not read ${path} (${String(status)}); using defaults.`);
      return DEFAULT_CONFIG;
    }
  }
  return DEFAULT_CONFIG;
}

async function applyLabels(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number,
  config: Issue2ReproConfig,
  score: number,
): Promise<void> {
  const ready = score >= config.score.minimum;
  const addName = ready ? config.labels.ready : config.labels.incomplete;
  const removeName = ready ? config.labels.incomplete : config.labels.ready;

  try {
    await octokit.rest.issues.addLabels({
      owner,
      repo,
      issue_number: issueNumber,
      labels: [addName],
    });
  } catch (error) {
    console.warn(`Warning: could not add label "${addName}": ${describeError(error)}`);
  }

  try {
    await octokit.rest.issues.removeLabel({
      owner,
      repo,
      issue_number: issueNumber,
      name: removeName,
    });
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status !== 404) {
      console.warn(`Warning: could not remove label "${removeName}": ${describeError(error)}`);
    }
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function run(): Promise<void> {
  const eventPath = process.env["GITHUB_EVENT_PATH"];
  const repository = process.env["GITHUB_REPOSITORY"];
  const token = getInput("github-token") ?? process.env["GITHUB_TOKEN"];

  if (!eventPath) throw new Error("GITHUB_EVENT_PATH is not set. Run this as a GitHub Action.");
  if (!repository) throw new Error("GITHUB_REPOSITORY is not set. Run this as a GitHub Action.");
  if (!token) {
    throw new Error(
      "No token provided. Pass `github-token` input (usually ${{ secrets.GITHUB_TOKEN }}).",
    );
  }

  const event = JSON.parse(readFileSync(eventPath, "utf8")) as IssueEvent;
  const [owner, repo] = repository.split("/");
  if (!owner || !repo) throw new Error(`Invalid GITHUB_REPOSITORY value: ${repository}`);

  if (!event.issue || event.issue.pull_request !== undefined) {
    console.log("No issue found in the event payload; nothing to do.");
    setOutput("comment-action", "skipped");
    return;
  }
  if (event.action !== "opened" && event.action !== "edited") {
    console.log(`Skipping issue action "${event.action ?? "unknown"}".`);
    setOutput("comment-action", "skipped");
    return;
  }

  const octokit = new Octokit({
    auth: token,
    baseUrl: process.env["GITHUB_API_URL"] || undefined,
  });

  let config: Issue2ReproConfig;
  try {
    config = await fetchRepoConfig(octokit, owner, repo, event.repository?.default_branch);
  } catch (error) {
    if (error instanceof ConfigError) {
      throw new Error(`Invalid .issue2repro.yml configuration:\n${error.message}`);
    }
    throw error;
  }

  const report = analyzeIssue(
    {
      title: event.issue.title,
      body: event.issue.body ?? "",
      source: {
        type: "github",
        repository,
        issueNumber: event.issue.number,
      },
    },
    config,
  );

  setOutput("score", String(report.readinessScore));
  setOutput("status", report.readinessStatus);

  if (config.labels.enabled) {
    await applyLabels(octokit, owner, repo, event.issue.number, config, report.readinessScore);
  }

  if (!config.comment.enabled) {
    console.log("Comments are disabled in the configuration; skipping.");
    setOutput("comment-action", "skipped");
    return;
  }

  const body = renderMarkdown(report, { variant: "comment" });

  // Find an existing Issue2Repro comment so we can update it instead of
  // posting duplicates on every edit.
  let existingCommentId: number | null = null;
  for (let page = 1; page <= 10; page++) {
    const { data: comments } = await octokit.rest.issues.listComments({
      owner,
      repo,
      issue_number: event.issue.number,
      per_page: 100,
      page,
    });
    for (const comment of comments) {
      if (comment.body && comment.body.includes(COMMENT_MARKER)) {
        existingCommentId = comment.id;
      }
    }
    if (comments.length < 100) break;
  }

  if (existingCommentId !== null) {
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existingCommentId,
      body,
    });
    console.log(`Updated existing report comment ${existingCommentId}.`);
    setOutput("comment-action", "updated");
  } else {
    const { data: created } = await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: event.issue.number,
      body,
    });
    console.log(`Created report comment ${created.id}.`);
    setOutput("comment-action", "created");
  }
}

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
  run().catch((error) => {
    console.error(`::error::${describeError(error)}`);
    process.exit(1);
  });
}
