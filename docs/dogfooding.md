# Issue2Repro Dogfooding Log

Issue2Repro analyses issues in its own repository using its own GitHub
Action. This log records what the self-test found, how each problem was
fixed, and the final verified result.

## Setup

- Dogfood workflow: `.github/workflows/issue2repro.yml`
- Live test issue: https://github.com/a70win-wq/issue2repro/issues/1
- Trigger events: `issues.opened` and `issues.edited`
- Comment marker: `<!-- issue2repro-report -->`

## Timeline

```text
Initial self-test
↓
GitHub Action failed
↓
Root cause discovered
↓
Action bundle/runtime fixed (v0.1.1)
↓
Retested — new problem: silent no-op
↓
Root cause discovered
↓
Action bundle fixed again (v0.1.2)
↓
Retested
↓
Success
```

## Problem 1 — bundle crashed at runtime (found in v0.1.0)

**What happened.** The first dogfood run failed after ~6 seconds:

```text
ReferenceError: module is not defined in ES module scope
This file is being treated as an ES module because it has a '.js' file
extension and '…/package.json' contains "type": "module".
```

Failed run:
https://github.com/a70win-wq/issue2repro/actions/runs/31664564587

**How it was discovered.** The failure was visible immediately in the
workflow log of the `issues.opened` event.

**Root cause.** esbuild emitted the action bundle as CommonJS
(`module.exports = …`), but the file was named `action-dist/index.js`.
Because the repository's `package.json` declares `"type": "module"`, Node
loaded the file as an ES module, where `module` does not exist.

**Fix (v0.1.1).** The bundle was emitted with a `.cjs` extension, which
Node always treats as CommonJS. The action runtime was also upgraded from
the deprecated `node20` to `node24`.

## Problem 2 — bundle silently did nothing (found in v0.1.1)

**What happened.** After the v0.1.1 fix the workflow step succeeded, but no
report comment appeared and the step log contained no output from the
action at all.

Run that exposed it:
https://github.com/a70win-wq/issue2repro/actions/runs/31664827888

**How it was discovered.** By comparing the run log (only the step inputs,
nothing else) with the issue's comment list (still empty). A green step
with zero effect is itself the symptom.

**Root cause.** The action only starts when its direct-run detection
matches `process.argv[1]` against `import.meta.url`. esbuild shims
`import.meta` to an empty object (`{}`) in CommonJS output, so
`import.meta.url` was `undefined`, the detection always failed, and `run()`
was never called — a silent exit with code 0.

**Fix (v0.1.2).** The bundle is now built with `--format=esm` and written
to `action-dist/index.js`, a genuine ES module consistent with
`"type": "module"`. `import.meta.url` survives bundling, so the direct-run
detection works. Verified locally before release:

```bash
$ node action-dist/index.js
::error::GITHUB_EVENT_PATH is not set. Run this as a GitHub Action.
```

(an error is the correct outcome outside GitHub Actions — it proves the
entry point now executes).

## Final result — verified end to end

First analysis of the deliberately incomplete test issue body
("Login doesn't work since yesterday. / I'm using a Mac."):

- Run: https://github.com/a70win-wq/issue2repro/actions/runs/31665001777
- Comment created: yes (comment id `5275716177`)
- Score: **25% — Insufficient**
- Detected: problem description, operating system (macOS)
- Missing: steps, expected/actual behaviour, app version, OS version,
  logs, screenshots, regression, minimal reproduction link

After editing the issue to include steps, environment, versions, expected
and actual behaviour, and an error message:

- Run: https://github.com/a70win-wq/issue2repro/actions/runs/31665054679
- Log line: `Updated existing report comment 5275716177.`
- Score: **85% — Reproducible**
- Same comment updated in place; the issue still has exactly one
  Issue2Repro comment. No duplicates.

## Lessons for maintainers

- A green workflow step does not guarantee the action did anything — check
  its outputs (comments, logs, step outputs).
- When a package declares `"type": "module"`, every bundled `.js` file is
  ESM; name CommonJS bundles `.cjs` or bundle as ESM.
- esbuild's CJS output does not preserve `import.meta`; code that relies
  on `import.meta.url` must ship as ESM.
