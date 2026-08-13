/**
 * Core data model for Issue2Repro.
 *
 * Issue2Repro never invents missing information. If a value cannot be
 * extracted deterministically from the issue content, it stays `null`
 * (or `Unknown` when rendered).
 */

export type ReadinessStatus =
  | "insufficient"
  | "needs-information"
  | "reproducible"
  | "excellent";

export interface ReportSource {
  type: "github" | "markdown";
  /** GitHub issue URL, when the source is a GitHub issue. */
  url?: string;
  /** `owner/repo`, when the source is a GitHub issue. */
  repository?: string;
  /** Issue number, when the source is a GitHub issue. */
  issueNumber?: number;
  /** Local file path, when the source is a Markdown file. */
  file?: string;
}

export interface EnvironmentInfo {
  os: string | null;
  osVersion: string | null;
  browser: string | null;
  browserVersion: string | null;
  appVersion: string | null;
  runtime: string | null;
  runtimeVersion: string | null;
}

export interface ReproductionInfo {
  steps: string[];
  expectedBehaviour: string | null;
  actualBehaviour: string | null;
}

export interface EvidenceInfo {
  logs: string[];
  screenshots: string[];
  links: string[];
}

export interface RegressionInfo {
  detected: boolean;
  description: string | null;
}

export interface ReproductionReport {
  source: ReportSource;
  title: string;
  problemDescription: string | null;
  environment: EnvironmentInfo;
  reproduction: ReproductionInfo;
  evidence: EvidenceInfo;
  regression: RegressionInfo;
  missingFields: string[];
  readinessScore: number;
  readinessStatus: ReadinessStatus;
}

/** Input accepted by the analyzer. */
export interface IssueInput {
  title?: string;
  body: string;
  source: ReportSource;
}

/**
 * Canonical field keys used for missing-field tracking and configuration.
 */
export const FIELD_KEYS = [
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
] as const;

export type FieldKey = (typeof FIELD_KEYS)[number];

/** Human readable labels used in terminal output and reports. */
export const FIELD_LABELS: Record<FieldKey, string> = {
  problem_description: "Problem description",
  reproduction_steps: "Exact reproduction steps",
  expected_behavior: "Expected behaviour",
  actual_behavior: "Actual behaviour",
  app_version: "Application version",
  environment: "Operating system",
  os_version: "Operating system version",
  logs: "Error logs",
  screenshots: "Screenshots",
  regression: "Regression information",
  minimal_reproduction: "Minimal reproduction link",
};

/** Lower-case phrases used in the deterministic suggested maintainer reply. */
export const FIELD_REQUEST_PHRASES: Record<FieldKey, string> = {
  problem_description: "a clearer description of the problem",
  reproduction_steps: "exact steps to reproduce",
  expected_behavior: "expected behaviour",
  actual_behavior: "actual behaviour",
  app_version: "application version",
  environment: "operating system",
  os_version: "operating system version",
  logs: "any relevant error logs",
  screenshots: "screenshots",
  regression: "whether a previous version worked",
  minimal_reproduction: "a minimal reproduction link (CodeSandbox, StackBlitz, gist, ...)",
};
