# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `docs/adoption.md` — verifiable adoption evidence (dogfooding status,
  releases, evidence policy).
- `docs/dogfooding.md` — full log of the self-test: problems found, root
  causes, fixes and final verified result.

### Changed

- README: added live dogfood demo section, Quick start, honest npm
  publishing status note, and refreshed the roadmap to match what shipped.

## [0.1.2] - 2026-08-13

### Fixed

- The v0.1.1 CommonJS bundle silently exited without analysing the issue:
  esbuild shims `import.meta` to an empty object in CJS output, so the
  action's direct-run detection (`import.meta.url`) always failed and
  `run()` was never called. The bundle is now emitted as a genuine ESM
  bundle (`action-dist/index.js`, matching `"type": "module"`), which
  preserves `import.meta.url`.

### Verified

- Self-hosted dogfood test passed end-to-end with this release: report
  comment created on issue edit (25% — Insufficient) and updated in place
  after the issue gained details (85% — Reproducible), without duplicate
  comments (runs 31665001777 and 31665054679).

## [0.1.1] - 2026-08-13

### Fixed

- GitHub Action bundle crashed at runtime with
  `ReferenceError: module is not defined in ES module scope` because the
  CommonJS bundle was named `action-dist/index.js` while `package.json`
  declares `"type": "module"`. The bundle is now emitted as
  `action-dist/index.cjs`, which Node always treats as CommonJS.

### Changed

- GitHub Action runtime upgraded from `node20` (deprecated on GitHub-hosted
  runners) to `node24`.

## [0.1.0] - 2026-08-13

### Added

- Deterministic Markdown parser for GitHub issues and local files.
- Field extraction: problem description, reproduction steps, expected and
  actual behaviour, environment (OS/browser/runtime/app version), evidence
  (logs/screenshots/reproduction links), and regression detection.
- Missing-field detection with configurable required/optional fields.
- Reproduction Readiness Score (0-100) with readiness status bands.
- Terminal, Markdown, and JSON output formats.
- CLI supporting local files, `owner/repo#123`, and GitHub issue URLs.
- GitHub Action that creates/updates a single report comment per issue.
- `.issue2repro.yml` configuration validated with Zod.
- Optional label management (`needs-info`, `ready-to-reproduce`), off by default.
- MIT license.

[unreleased]: https://github.com/a70win-wq/issue2repro/compare/v0.1.2...HEAD
[0.1.2]: https://github.com/a70win-wq/issue2repro/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/a70win-wq/issue2repro/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/a70win-wq/issue2repro/releases/tag/v0.1.0
