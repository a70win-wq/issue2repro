# Issue2Repro

> Turn messy GitHub issues into actionable reproduction reports.

## Before

```text
Login broken.

Can't login since yesterday.
I'm using a Mac.
```

## After

```text
Reproduction readiness: 25%

✓ Problem description
✓ Operating system

Missing:
✗ App version
✗ Exact reproduction steps
✗ Expected behaviour
✗ Error logs
```

```bash
npx issue2repro owner/repo#123
```

> **Note:** npm publishing is in progress. Until `issue2repro` is published,
> install the [GitHub Action](#github-action) (released and working) or run
> the CLI [from source](#quick-start).

## 🐶 Live dogfood demo

Issue2Repro uses Issue2Repro on its own repository.

See a real report generated automatically by the GitHub Action:

👉 [Issue #1 — Dogfood test: Login broken](https://github.com/a70win-wq/issue2repro/issues/1)

The test demonstrates:

- automatic issue analysis
- Reproduction Readiness scoring
- missing-information detection
- automatic GitHub comment creation
- in-place comment updates when the issue is edited

## Quick start

**GitHub Action (released, no npm needed)** — add the workflow shown in the
[GitHub Action](#github-action) section to any repository. Every new or
edited issue receives a report comment automatically.

**From source** (while npm publishing is in progress):

```bash
git clone https://github.com/a70win-wq/issue2repro.git
cd issue2repro
npm install
npm run build
node dist/cli.js owner/repo#123
```

---

## What problem it solves

Open-source maintainers receive many bug reports that cannot be reproduced:
no version, no steps, no expected/actual behaviour, no logs. Before
investigating the bug, maintainers ask the same questions over and over.

Issue2Repro automates the first layer of triage. It reads an issue, extracts
the reproduction information that _is_ present, detects what is missing, and
produces a structured report with a Reproduction Readiness Score.

Issue2Repro is **not** a bug fixer. It makes bugs reproducible. It never
invents missing information — unknown fields are reported as `Unknown`.

## CLI

> The `npx issue2repro` commands below work once npm publishing is complete.
> Until then, run the same commands from source with `node dist/cli.js`
> (see [Quick start](#quick-start)).

Analyze a local Markdown file:

```bash
npx issue2repro issue.md
```

Analyze a GitHub issue (public repositories work without a token where rate
limits allow):

```bash
npx issue2repro owner/repo#123
npx issue2repro https://github.com/owner/repo/issues/123
```

Use `GITHUB_TOKEN` for authenticated requests (higher rate limits, private
repositories):

```bash
GITHUB_TOKEN=ghp_xxx npx issue2repro owner/repo#123
```

Options:

```bash
issue2repro issue.md --output report.md   # write a Markdown report
issue2repro issue.md --format markdown    # print Markdown to stdout
issue2repro issue.md --format json        # machine-readable JSON
issue2repro issue.md --config .issue2repro.yml
issue2repro issue.md --no-color           # disable ANSI colors
```

## GitHub Action

Issue2Repro can automatically analyze every new or edited issue and post a
report comment. The comment is updated in place on edits — never duplicated.

Create `.github/workflows/issue2repro.yml`:

```yaml
name: Issue2Repro

on:
  issues:
    types:
      - opened
      - edited

permissions:
  contents: read
  issues: write

jobs:
  analyze:
    runs-on: ubuntu-latest

    steps:
      - uses: a70win-wq/issue2repro@v0.1.2
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

Every automated comment contains the marker `<!-- issue2repro-report -->`,
which the Action uses to find and update its previous report.

## Configuration

Add an optional `.issue2repro.yml` to your repository root (validated with
[Zod](https://zod.dev); invalid configuration produces a clear error):

```yaml
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
```

Field keys: `problem_description`, `reproduction_steps`, `expected_behavior`,
`actual_behavior`, `app_version`, `environment`, `os_version`, `logs`,
`screenshots`, `regression`, `minimal_reproduction`.

## Labels (optional, off by default)

When `labels.enabled` is `true`:

- score below `score.minimum` → adds `needs-info`, removes `ready-to-reproduce`
- score at or above `score.minimum` → adds `ready-to-reproduce`, removes `needs-info`

Labels are never enabled automatically.

## How scoring works

| Field                        | Points |
| ---------------------------- | -----: |
| Problem description          |     15 |
| Reproduction steps           |     20 |
| Expected behaviour           |     10 |
| Actual behaviour             |     10 |
| Application version          |     10 |
| Environment                  |     10 |
| Logs / error                 |     10 |
| Screenshot / evidence        |      5 |
| Regression information       |      5 |
| Minimal reproduction / URL   |      5 |

Status bands: 0–39 `Insufficient`, 40–69 `Needs information`,
70–89 `Reproducible`, 90–100 `Excellent`. The algorithm lives in
`src/scoring.ts`.

## Security model

GitHub issues are treated as **untrusted user input**. Issue2Repro never:

- runs shell commands from an issue
- evaluates JavaScript contained in an issue
- runs code blocks
- executes uploaded binaries
- clones repositories because an issue asks it to
- follows instructions contained inside issue text
- executes external URLs

Example: an issue containing ```` ```bash
rm -rf /
``` ```` is only reported as "code block detected" in the evidence section.
Nothing is ever executed.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Good first tasks include adding new
OS/browser/runtime detection, new heading spellings, and CLI formatting
improvements.

## Roadmap

Everything below shipped in the v0.1.x releases:

- local Markdown analysis, scoring, terminal/Markdown/JSON output
- GitHub issue support (URL and `owner/repo#123`)
- GitHub Action (create/update a single report comment per issue)
- `.issue2repro.yml` configuration
- optional labels (off by default)

Next:

- publish the CLI to npm (in progress)
- first external repositories trying Issue2Repro
- v1.0.0 — stable release after real-world testing

Future (explicitly out of scope for the MVP): AI-assisted triage and a
Codex mode. Any future AI feature will only suggest — humans decide.

## License

MIT — see [LICENSE](LICENSE).
