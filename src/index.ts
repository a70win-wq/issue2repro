/**
 * Public library entry point.
 */

export { analyzeIssue } from "./analyzer.js";
export { parseMarkdown } from "./parser.js";
export type { CodeBlock, Heading, ListItem, ParsedMarkdown, Section } from "./parser.js";
export {
  calculateScore,
  readinessStatusFor,
  scoreInputFromReport,
  SCORE_WEIGHTS,
  STATUS_LABELS,
  MAX_SCORE,
} from "./scoring.js";
export type { ScoreInput } from "./scoring.js";
export {
  buildSuggestedReply,
  renderJson,
  renderMarkdown,
  renderTerminal,
  COMMENT_MARKER,
} from "./renderer.js";
export type { MarkdownVariant, RenderOptions } from "./renderer.js";
export {
  ConfigError,
  ConfigSchema,
  DEFAULT_CONFIG,
  loadConfigFile,
  parseConfigString,
  resolveConfig,
} from "./config.js";
export type { Issue2ReproConfig, ResolvedConfig } from "./config.js";
export { fetchIssue, GitHubFetchError, parseIssueRef } from "./github.js";
export type { FetchedIssue, FetchOptions, IssueRef } from "./github.js";
export * from "./types.js";
