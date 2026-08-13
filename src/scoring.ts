/**
 * Reproduction Readiness Score.
 *
 * The scoring algorithm is intentionally isolated in this module so it can
 * be adjusted later without touching parsing or rendering.
 */

import type { ReadinessStatus, ReproductionReport } from "./types.js";

export interface ScoreInput {
  hasProblemDescription: boolean;
  hasReproductionSteps: boolean;
  hasExpectedBehaviour: boolean;
  hasActualBehaviour: boolean;
  hasAppVersion: boolean;
  hasEnvironment: boolean;
  hasLogs: boolean;
  hasScreenshots: boolean;
  hasRegressionInfo: boolean;
  hasReproductionLink: boolean;
}

/**
 * Score weights defined by the PRD. Maximum total: 100.
 *
 * | Field                          | Points |
 * | ------------------------------ | -----: |
 * | Problem description            |     15 |
 * | Reproduction steps             |     20 |
 * | Expected behaviour             |     10 |
 * | Actual behaviour               |     10 |
 * | Application version            |     10 |
 * | Environment                    |     10 |
 * | Logs / error                   |     10 |
 * | Screenshot / evidence          |      5 |
 * | Regression information         |      5 |
 * | Minimal reproduction / URL     |      5 |
 */
export const SCORE_WEIGHTS: Record<keyof ScoreInput, number> = {
  hasProblemDescription: 15,
  hasReproductionSteps: 20,
  hasExpectedBehaviour: 10,
  hasActualBehaviour: 10,
  hasAppVersion: 10,
  hasEnvironment: 10,
  hasLogs: 10,
  hasScreenshots: 5,
  hasRegressionInfo: 5,
  hasReproductionLink: 5,
};

export const MAX_SCORE = 100;

export function calculateScore(input: ScoreInput): number {
  let score = 0;
  for (const key of Object.keys(SCORE_WEIGHTS) as (keyof ScoreInput)[]) {
    if (input[key]) {
      score += SCORE_WEIGHTS[key];
    }
  }
  return Math.min(score, MAX_SCORE);
}

/**
 * Readiness status bands:
 *
 *   0-39   insufficient
 *   40-69  needs-information
 *   70-89  reproducible
 *   90-100 excellent
 */
export function readinessStatusFor(score: number): ReadinessStatus {
  if (score >= 90) return "excellent";
  if (score >= 70) return "reproducible";
  if (score >= 40) return "needs-information";
  return "insufficient";
}

export const STATUS_LABELS: Record<ReadinessStatus, string> = {
  insufficient: "Insufficient",
  "needs-information": "Needs information",
  reproducible: "Reproducible",
  excellent: "Excellent",
};

/** Derive the boolean score input from a completed report. */
export function scoreInputFromReport(
  report: Pick<
    ReproductionReport,
    "problemDescription" | "environment" | "reproduction" | "evidence" | "regression"
  >,
): ScoreInput {
  return {
    hasProblemDescription: report.problemDescription !== null,
    hasReproductionSteps: report.reproduction.steps.length > 0,
    hasExpectedBehaviour: report.reproduction.expectedBehaviour !== null,
    hasActualBehaviour: report.reproduction.actualBehaviour !== null,
    hasAppVersion: report.environment.appVersion !== null,
    hasEnvironment: report.environment.os !== null,
    hasLogs: report.evidence.logs.length > 0,
    hasScreenshots: report.evidence.screenshots.length > 0,
    hasRegressionInfo: report.regression.detected,
    hasReproductionLink: report.evidence.links.length > 0,
  };
}
