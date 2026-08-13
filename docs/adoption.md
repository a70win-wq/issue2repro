# Issue2Repro Adoption Evidence

This document tracks verifiable usage and feedback for Issue2Repro.

## Project

Repository:
https://github.com/a70win-wq/issue2repro

Current release:
v0.1.2

## Internal dogfooding

Issue2Repro currently runs Issue2Repro on its own repository.

Evidence:

- Dogfood workflow:
  `.github/workflows/issue2repro.yml`

- Live test issue:
  https://github.com/a70win-wq/issue2repro/issues/1

Verified behaviour:

- Issue opened triggers Issue2Repro
- Issue edited triggers Issue2Repro
- Readiness score generated
- Missing information detected
- GitHub comment created
- Existing comment updated instead of duplicated

## Bugs found through dogfooding

Dogfooding discovered two real GitHub Action packaging/runtime problems,
both fixed within the same day:

1. **v0.1.0 bundle crashed at runtime** — the CommonJS bundle was named
   `action-dist/index.js` while `package.json` declares `"type": "module"`,
   so Node treated it as ESM and failed with
   `ReferenceError: module is not defined in ES module scope`.
   Fixed in v0.1.1.

2. **v0.1.1 bundle silently did nothing** — renaming the bundle to `.cjs`
   removed the crash, but esbuild shims `import.meta` to an empty object in
   CJS output, so the action's direct-run detection always failed and the
   analysis never ran. Fixed in v0.1.2 by shipping a genuine ESM bundle.

Full details, run links and the fix timeline: [docs/dogfooding.md](dogfooding.md).

## External adoption

No verified external adoption yet.

This section will track:

| Repository | Maintainer | Evidence | Status |
| ---------- | ---------- | -------- | ------ |

## External feedback

No verified external feedback yet.

## External contributors

No verified external contributors yet.

## Releases

Actual releases only:

| Release | Date       | Notes                                                        |
| ------- | ---------- | ------------------------------------------------------------ |
| v0.1.0  | 2026-08-13 | Initial release: CLI, scoring, GitHub Action, configuration  |
| v0.1.1  | 2026-08-13 | Action bundle fix (CJS/ESM file format), node24 runtime      |
| v0.1.2  | 2026-08-13 | Action bundle switched to ESM; dogfood test passing end-to-end |

## Package usage

npm package name: `issue2repro`

Status: not yet published (publishing in progress).

No download counts are claimed until verifiable npm data exists.

## Evidence policy

Only verifiable evidence is recorded here.

Downloads must not automatically be described as active users.

Stars must not automatically be described as adoption.
