import { describe, expect, it } from "vitest";
import {
  ConfigError,
  DEFAULT_CONFIG,
  parseConfigString,
  resolveConfig,
} from "../src/config.js";

const VALID_CONFIG = `
version: 1

required:
  - reproduction_steps
  - expected_behavior
  - actual_behavior
  - environment
  - app_version

optional:
  - logs
  - screenshots
  - minimal_reproduction

score:
  minimum: 70

comment:
  enabled: true

labels:
  enabled: false
  incomplete: needs-info
  ready: ready-to-reproduce
`;

describe("parseConfigString", () => {
  it("parses a valid configuration", () => {
    const config = parseConfigString(VALID_CONFIG);
    expect(config.version).toBe(1);
    expect(config.required).toContain("reproduction_steps");
    expect(config.optional).toContain("logs");
    expect(config.score.minimum).toBe(70);
    expect(config.comment.enabled).toBe(true);
    expect(config.labels.enabled).toBe(false);
    expect(config.labels.incomplete).toBe("needs-info");
    expect(config.labels.ready).toBe("ready-to-reproduce");
  });

  it("applies defaults for empty input", () => {
    expect(parseConfigString("")).toEqual(DEFAULT_CONFIG);
  });

  it("fills in missing sections with defaults", () => {
    const config = parseConfigString("score:\n  minimum: 50\n");
    expect(config.score.minimum).toBe(50);
    expect(config.labels.enabled).toBe(false);
    expect(config.required).toEqual(DEFAULT_CONFIG.required);
  });

  it("rejects unknown fields with a clear error", () => {
    expect(() => parseConfigString("bogus: true\n")).toThrow(ConfigError);
    try {
      parseConfigString("bogus: true\n");
    } catch (error) {
      expect((error as ConfigError).message).toContain("bogus");
    }
  });

  it("rejects unknown field keys", () => {
    expect(() => parseConfigString("required:\n  - not_a_field\n")).toThrow(ConfigError);
  });

  it("rejects out-of-range score thresholds", () => {
    expect(() => parseConfigString("score:\n  minimum: 150\n")).toThrow(ConfigError);
  });

  it("rejects non-mapping YAML", () => {
    expect(() => parseConfigString("- a\n- b\n")).toThrow(ConfigError);
  });

  it("rejects invalid YAML syntax with a clear error", () => {
    expect(() => parseConfigString("version: [unclosed")).toThrow(ConfigError);
  });
});

describe("resolveConfig", () => {
  it("falls back to defaults when no file exists", () => {
    const resolved = resolveConfig(undefined, "/nonexistent-directory-for-issue2repro");
    expect(resolved.config).toEqual(DEFAULT_CONFIG);
    expect(resolved.configPath).toBeNull();
  });

  it("throws a clear error for a missing explicit path", () => {
    expect(() => resolveConfig("/nonexistent/.issue2repro.yml")).toThrow(
      /Config file not found/,
    );
  });
});
