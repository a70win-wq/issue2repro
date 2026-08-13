# Contributing to Issue2Repro

Thanks for your interest. Issue2Repro is intentionally small and easy to
hack on.

## Getting started

```bash
git clone https://github.com/a70win-wq/issue2repro.git
cd issue2repro
npm install
```

Useful commands:

```bash
npm run dev -- examples/incomplete-issue.md   # run the CLI from source (tsx)
npm test                                       # run the test suite once
npm run test:watch                             # run tests in watch mode
npm run lint                                   # ESLint
npm run typecheck                              # tsc --noEmit
npm run build                                  # compile to dist/
```

Analyze a sample issue while developing:

```bash
npm run dev -- examples/good-issue.md
npm run dev -- examples/incomplete-issue.md --format json
```

## Project layout

```text
src/
  cli.ts        command-line entry point
  parser.ts     deterministic Markdown parsing
  analyzer.ts   information extraction
  scoring.ts    readiness score (isolated so it is easy to tune)
  renderer.ts   terminal / Markdown / JSON output
  config.ts     .issue2repro.yml handling (Zod)
  github.ts     issue fetching (Octokit)
  action.ts     GitHub Action entry point
  types.ts      shared data model
```

## Ways to contribute

Good first contributions:

- Add detection for another OS or distribution (e.g. Fedora, openSUSE).
- Add detection for another browser (e.g. Brave, Opera).
- Improve Windows version parsing.
- Add GitLab reproduction-link detection.
- Add heading spellings in other languages (e.g. French "Comportement attendu").
- Improve CLI formatting.

## Guidelines

- Keep extraction deterministic. No network calls, no AI, no heuristics that
  invent information. If a value is unknown, leave it `null`.
- Treat issue content as untrusted input. Never execute, evaluate, or fetch
  anything found inside an issue.
- Add tests for any new detection in `tests/`. Fixtures live in
  `tests/fixtures/`.
- Run `npm run lint`, `npm run typecheck`, and `npm test` before opening a
  pull request. CI runs all three plus `npm run build`.

## Releasing

Tags trigger `.github/workflows/release.yml`, which builds, bundles the
GitHub Action, and publishes. Version numbers follow the roadmap in the
README.
