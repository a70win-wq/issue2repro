/**
 * GitHub issue fetching via Octokit.
 *
 * Public repositories work without authentication where GitHub API rate
 * limits allow. Set `GITHUB_TOKEN` for authenticated requests.
 */

import { Octokit } from "@octokit/rest";

export interface IssueRef {
  owner: string;
  repo: string;
  issueNumber: number;
}

export interface FetchedIssue {
  title: string;
  body: string;
  url: string;
  repository: string;
  issueNumber: number;
}

const SHORT_REF_RE = /^([\w.-]+)\/([\w.-]+)#(\d+)$/;
const URL_REF_RE =
  /^https?:\/\/(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+)\/issues\/(\d+)(?:[/?#].*)?$/i;

/**
 * Parse `owner/repo#123` or a full GitHub issue URL into a reference.
 * Returns null when the input is not a GitHub issue reference.
 */
export function parseIssueRef(input: string): IssueRef | null {
  const trimmed = input.trim();

  const short = trimmed.match(SHORT_REF_RE);
  if (short && short[1] && short[2] && short[3]) {
    return { owner: short[1], repo: short[2], issueNumber: Number(short[3]) };
  }

  const url = trimmed.match(URL_REF_RE);
  if (url && url[1] && url[2] && url[3]) {
    return { owner: url[1], repo: url[2], issueNumber: Number(url[3]) };
  }

  return null;
}

export class GitHubFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GitHubFetchError";
  }
}

export interface FetchOptions {
  /** Defaults to the GITHUB_TOKEN environment variable. */
  token?: string;
  /** Defaults to the GITHUB_API_URL environment variable or the public API. */
  baseUrl?: string;
}

export async function fetchIssue(ref: IssueRef, options: FetchOptions = {}): Promise<FetchedIssue> {
  const token = options.token ?? process.env["GITHUB_TOKEN"];
  const baseUrl = options.baseUrl ?? process.env["GITHUB_API_URL"];

  const octokit = new Octokit({
    auth: token || undefined,
    baseUrl: baseUrl || undefined,
  });

  try {
    const { data } = await octokit.rest.issues.get({
      owner: ref.owner,
      repo: ref.repo,
      issue_number: ref.issueNumber,
    });

    return {
      title: data.title,
      body: data.body ?? "",
      url: data.html_url,
      repository: `${ref.owner}/${ref.repo}`,
      issueNumber: ref.issueNumber,
    };
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 404) {
      throw new GitHubFetchError(
        `Issue ${ref.owner}/${ref.repo}#${ref.issueNumber} was not found. ` +
          "Check the reference, or note that the repository may be private.",
      );
    }
    if (status === 403 || status === 429) {
      throw new GitHubFetchError(
        "GitHub API rate limit reached or access denied. " +
          "Set the GITHUB_TOKEN environment variable for authenticated requests.",
      );
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new GitHubFetchError(`Failed to fetch issue from GitHub: ${message}`);
  }
}
