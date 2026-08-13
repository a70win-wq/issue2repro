/**
 * Optional `.issue2repro.yml` configuration, validated with Zod.
 * Invalid configuration produces a clear error.
 */

import { readFileSync, existsSync } from "node:fs";
import yaml from "js-yaml";
import { z } from "zod";
import { FIELD_KEYS } from "./types.js";

export const FIELD_ENUM = FIELD_KEYS;

export const ConfigSchema = z
  .object({
    version: z.literal(1).default(1),
    required: z
      .array(z.enum(FIELD_ENUM))
      .default([
        "problem_description",
        "reproduction_steps",
        "expected_behavior",
        "actual_behavior",
        "app_version",
        "environment",
      ]),
    optional: z
      .array(z.enum(FIELD_ENUM))
      .default(["os_version", "logs", "screenshots", "regression", "minimal_reproduction"]),
    score: z
      .object({
        minimum: z.number().int().min(0).max(100).default(70),
      })
      .default({}),
    comment: z
      .object({
        enabled: z.boolean().default(true),
      })
      .default({}),
    labels: z
      .object({
        enabled: z.boolean().default(false),
        incomplete: z.string().min(1).default("needs-info"),
        ready: z.string().min(1).default("ready-to-reproduce"),
      })
      .default({}),
  })
  .strict();

export type Issue2ReproConfig = z.infer<typeof ConfigSchema>;

export const DEFAULT_CONFIG: Issue2ReproConfig = ConfigSchema.parse({});

export class ConfigError extends Error {
  readonly issues: string[];

  constructor(message: string, issues: string[] = []) {
    super(message);
    this.name = "ConfigError";
    this.issues = issues;
  }
}

/** Parse and validate a YAML configuration string. */
export function parseConfigString(text: string, sourceLabel = "config"): Issue2ReproConfig {
  let raw: unknown;
  try {
    raw = yaml.load(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ConfigError(`Invalid YAML in ${sourceLabel}: ${message}`);
  }

  if (raw === null || raw === undefined) {
    return DEFAULT_CONFIG;
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new ConfigError(`Invalid configuration in ${sourceLabel}: expected a YAML mapping.`);
  }

  const result = ConfigSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
      return `- ${path}: ${issue.message}`;
    });
    throw new ConfigError(
      `Invalid configuration in ${sourceLabel}:\n${issues.join("\n")}`,
      issues,
    );
  }
  return result.data;
}

/** Load and validate a configuration file from disk. */
export function loadConfigFile(path: string): Issue2ReproConfig {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ConfigError(`Could not read config file ${path}: ${message}`);
  }
  return parseConfigString(text, path);
}

export interface ResolvedConfig {
  config: Issue2ReproConfig;
  /** Path of the configuration file that was used, if any. */
  configPath: string | null;
}

/**
 * Resolve configuration:
 * 1. explicit `--config` path (must exist),
 * 2. `.issue2repro.yml` / `.issue2repro.yaml` in the working directory,
 * 3. built-in defaults.
 */
export function resolveConfig(explicitPath: string | undefined, cwd = process.cwd()): ResolvedConfig {
  if (explicitPath) {
    if (!existsSync(explicitPath)) {
      throw new ConfigError(`Config file not found: ${explicitPath}`);
    }
    return { config: loadConfigFile(explicitPath), configPath: explicitPath };
  }

  for (const candidate of [".issue2repro.yml", ".issue2repro.yaml"]) {
    const full = `${cwd.replace(/\/$/, "")}/${candidate}`;
    if (existsSync(full)) {
      return { config: loadConfigFile(full), configPath: full };
    }
  }

  return { config: DEFAULT_CONFIG, configPath: null };
}
