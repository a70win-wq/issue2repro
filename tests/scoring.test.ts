import { describe, expect, it } from "vitest";
import {
  calculateScore,
  MAX_SCORE,
  readinessStatusFor,
  SCORE_WEIGHTS,
  type ScoreInput,
} from "../src/scoring.js";

function emptyInput(): ScoreInput {
  return {
    hasProblemDescription: false,
    hasReproductionSteps: false,
    hasExpectedBehaviour: false,
    hasActualBehaviour: false,
    hasAppVersion: false,
    hasEnvironment: false,
    hasLogs: false,
    hasScreenshots: false,
    hasRegressionInfo: false,
    hasReproductionLink: false,
  };
}

describe("calculateScore", () => {
  it("weights match the PRD", () => {
    expect(SCORE_WEIGHTS.hasProblemDescription).toBe(15);
    expect(SCORE_WEIGHTS.hasReproductionSteps).toBe(20);
    expect(SCORE_WEIGHTS.hasExpectedBehaviour).toBe(10);
    expect(SCORE_WEIGHTS.hasActualBehaviour).toBe(10);
    expect(SCORE_WEIGHTS.hasAppVersion).toBe(10);
    expect(SCORE_WEIGHTS.hasEnvironment).toBe(10);
    expect(SCORE_WEIGHTS.hasLogs).toBe(10);
    expect(SCORE_WEIGHTS.hasScreenshots).toBe(5);
    expect(SCORE_WEIGHTS.hasRegressionInfo).toBe(5);
    expect(SCORE_WEIGHTS.hasReproductionLink).toBe(5);
  });

  it("returns 0 for an empty report", () => {
    expect(calculateScore(emptyInput())).toBe(0);
  });

  it("returns 100 when everything is present", () => {
    const input = emptyInput();
    for (const key of Object.keys(input) as (keyof ScoreInput)[]) {
      input[key] = true;
    }
    expect(calculateScore(input)).toBe(MAX_SCORE);
  });

  it("adds each component independently", () => {
    for (const key of Object.keys(SCORE_WEIGHTS) as (keyof ScoreInput)[]) {
      const input = emptyInput();
      input[key] = true;
      expect(calculateScore(input)).toBe(SCORE_WEIGHTS[key]);
    }
  });

  it("combines components deterministically", () => {
    const input = emptyInput();
    input.hasProblemDescription = true; // 15
    input.hasEnvironment = true; // 10
    expect(calculateScore(input)).toBe(25);

    input.hasReproductionSteps = true; // +20
    input.hasLogs = true; // +10
    expect(calculateScore(input)).toBe(55);
  });
});

describe("readinessStatusFor", () => {
  it("applies the PRD bands", () => {
    expect(readinessStatusFor(0)).toBe("insufficient");
    expect(readinessStatusFor(39)).toBe("insufficient");
    expect(readinessStatusFor(40)).toBe("needs-information");
    expect(readinessStatusFor(69)).toBe("needs-information");
    expect(readinessStatusFor(70)).toBe("reproducible");
    expect(readinessStatusFor(89)).toBe("reproducible");
    expect(readinessStatusFor(90)).toBe("excellent");
    expect(readinessStatusFor(100)).toBe("excellent");
  });
});
