# Issue2Repro — MVP Product Requirements Document

## 1. Project Overview

**Project Name:** Issue2Repro  
**Type:** Open Source Developer Tool  
**License:** MIT  
**Primary Language:** TypeScript  
**Runtime:** Node.js 20+  
**Package Manager:** npm

### One-line description

> Turn incomplete GitHub bug reports into structured, actionable reproduction reports for open-source maintainers.

### Core philosophy

> Issue2Repro is not a bug fixer. It makes bugs reproducible.

Issue2Repro must never invent missing information.  
If information is unavailable, explicitly return `Unknown` or mark the field as missing.

---

# 2. Problem

Open-source maintainers frequently receive bug reports such as:

```text
Login broken.

It stopped working after updating yesterday.
I'm using a Mac.
```

Before investigating the bug, the maintainer needs to ask repetitive questions:

- Which application version?
- Which operating system version?
- What are the reproduction steps?
- What was expected?
- What actually happened?
- Are there logs?
- Are there screenshots?
- Is this a regression?
- Is there a minimal reproduction?

This creates unnecessary issue-triage work.

Issue2Repro automates this first layer of triage.

---

# 3. MVP Goal

Build a CLI and GitHub Action that:

1. Reads a GitHub Issue or Markdown file.
2. Extracts available reproduction information.
3. Detects missing information.
4. Calculates a Reproduction Readiness Score.
5. Creates a structured Reproduction Pack.
6. Optionally posts or updates the report as a GitHub Issue comment.

Do NOT implement AI/codebase analysis in the MVP.

---

# 4. Non-goals

The MVP must NOT:

- Fix bugs.
- Modify source code.
- Generate pull requests.
- Merge pull requests.
- Close GitHub Issues.
- Execute commands contained inside Issues.
- Execute uploaded files.
- Download and execute external code.
- Automatically publish packages.
- Require a database.
- Require user accounts.
- Require a web dashboard.
- Require an OpenAI API key.

---

# 5. Supported Inputs

## 5.1 Markdown File

Example:

```bash
npx issue2repro issue.md
```

Optional output:

```bash
npx issue2repro issue.md --output report.md
```

---

## 5.2 GitHub Issue

Support:

```bash
npx issue2repro owner/repo#123
```

Also support:

```bash
npx issue2repro https://github.com/owner/repo/issues/123
```

Public repositories should work without authentication where GitHub API limits allow.

Allow optional:

```bash
GITHUB_TOKEN=xxx
```

for authenticated requests.

---

# 6. Required Analysis Fields

Issue2Repro should attempt to extract the following information.

## Problem Description

Determine whether the Issue clearly describes what is wrong.

Output:

```text
problemDescription
```

---

## Reproduction Steps

Detect numbered or bulleted reproduction instructions.

Examples:

```text
1. Open Settings
2. Click Profile
3. Application crashes
```

or:

```text
- launch the app
- sign in
- click upload
```

Output:

```text
reproductionSteps[]
```

---

## Expected Behaviour

Detect sections such as:

```text
Expected
Expected behaviour
Expected behavior
What should happen
```

Output:

```text
expectedBehaviour
```

---

## Actual Behaviour

Detect:

```text
Actual
Actual behaviour
Actual behavior
What happened
Result
```

Output:

```text
actualBehaviour
```

---

# 7. Environment Detection

Attempt to detect:

## Operating System

Supported initial values:

```text
macOS
Windows
Linux
iOS
Android
Unknown
```

Examples:

```text
macOS 15
Windows 11
Ubuntu 24.04
iOS 19
Android 16
```

---

## Browser

Supported values:

```text
Chrome
Safari
Firefox
Edge
Unknown
```

---

## Application Version

Detect common formats:

```text
v1.2.3
1.2.3
version 2.4
Version: 3.2.1
```

---

## Runtime

Detect when available:

```text
Node.js
Python
Java
Go
Rust
Ruby
PHP
```

Also attempt to extract version.

Examples:

```text
Node 22.4
Python 3.13
Go 1.25
```

---

# 8. Evidence Detection

Detect whether the Issue contains:

## Logs

Examples:

```text
Error:
SIGABRT
```

or fenced code blocks.

Do NOT execute any content.

---

## Screenshots

Detect Markdown image syntax or GitHub attachment URLs.

Example:

```markdown
![error](https://...)
```

---

## External Reproduction Links

Detect links to common services including:

```text
codesandbox.io
stackblitz.com
codepen.io
github.com
gist.github.com
replit.com
```

Store URLs only.

Do not execute external content.

---

# 9. Regression Detection

Look for phrases such as:

```text
worked before
started after update
after upgrading
previous version worked
since version
regression
```

Output:

```text
regression:
  detected: true | false
  description: string | null
```

Do NOT infer which commit caused the regression.

---

# 10. Internal Data Model

Implement a structure similar to:

```typescript
export interface ReproductionReport {
  source: {
    type: "github" | "markdown";
    url?: string;
    repository?: string;
    issueNumber?: number;
  };

  title: string;

  problemDescription: string | null;

  environment: {
    os: string | null;
    osVersion: string | null;
    browser: string | null;
    browserVersion: string | null;
    appVersion: string | null;
    runtime: string | null;
    runtimeVersion: string | null;
  };

  reproduction: {
    steps: string[];
    expectedBehaviour: string | null;
    actualBehaviour: string | null;
  };

  evidence: {
    logs: string[];
    screenshots: string[];
    links: string[];
  };

  regression: {
    detected: boolean;
    description: string | null;
  };

  missingFields: string[];

  readinessScore: number;

  readinessStatus:
    | "insufficient"
    | "needs-information"
    | "reproducible"
    | "excellent";
}
```

Minor improvements to this structure are permitted.

---

# 11. Reproduction Readiness Score

Maximum:

```text
100
```

Scoring:

| Field | Points |
|---|---:|
| Problem description | 15 |
| Reproduction steps | 20 |
| Expected behaviour | 10 |
| Actual behaviour | 10 |
| Application version | 10 |
| Environment | 10 |
| Logs / error | 10 |
| Screenshot / evidence | 5 |
| Regression information | 5 |
| Minimal reproduction / useful URL | 5 |

Total:

```text
100
```

---

# 12. Readiness Status

```text
0–39
Insufficient
```

```text
40–69
Needs information
```

```text
70–89
Reproducible
```

```text
90–100
Excellent
```

The scoring algorithm should be isolated in:

```text
src/scoring.ts
```

so it can easily be modified later.

---

# 13. CLI Output

Example:

```text
╭────────────────────────────────────────────╮
│ Issue2Repro                                │
│ Issue #382 — Login fails after update      │
╰────────────────────────────────────────────╯

Reproduction readiness

████████░░░░░░░░░░░░ 42%

Status: Needs information


Summary

User reports being unable to log in after upgrading.


Environment

Operating system: macOS
OS version: Unknown
Application version: Unknown
Browser: Unknown


Reproduction Steps

Not enough information.


Expected Behaviour

Unknown


Actual Behaviour

User cannot log in.


Evidence

Logs: None detected
Screenshots: None detected
Reproduction links: None detected


Missing Information

✗ Application version
✗ macOS version
✗ Exact reproduction steps
✗ Expected behaviour
✗ Error logs
✗ Regression information
```

---

# 14. Suggested Maintainer Reply

Generate a deterministic reply using missing fields.

Example:

```text
Thanks for the report.

To help us reproduce this issue, could you provide:

- application version
- operating system version
- exact steps to reproduce
- expected behaviour
- any relevant error logs or screenshots

Once we have these details, it should be easier to investigate.
```

Do not use an LLM for this in the MVP.

---

# 15. GitHub Action

Users should be able to install Issue2Repro using:

```yaml
name: Issue2Repro

on:
  issues:
    types:
      - opened
      - edited

jobs:
  analyze:
    runs-on: ubuntu-latest

    steps:
      - uses: OWNER/issue2repro@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

The Action should:

1. Receive the Issue event.
2. Read the Issue title/body.
3. Analyze the Issue.
4. Generate a Markdown report.
5. Check whether Issue2Repro already created a report.
6. Create the report if none exists.
7. Otherwise update the existing report.

---

# 16. Comment Marker

Every automated comment must contain:

```html
<!-- issue2repro-report -->
```

When the Issue changes:

Search existing comments for this marker.

If found:

```text
UPDATE existing comment
```

If not:

```text
CREATE new comment
```

Never create a new report comment for every edit.

---

# 17. GitHub Comment Format

Example:

```markdown
## 🔎 Issue2Repro

**Reproduction readiness: 42%**

Status: **Needs information**

### Available information

- ✅ Problem description
- ✅ Operating system
- ❌ Application version
- ❌ Exact reproduction steps
- ❌ Expected behaviour
- ❌ Logs

### Missing information

- [ ] Application version
- [ ] Operating system version
- [ ] Exact steps to reproduce
- [ ] Expected behaviour
- [ ] Error logs

### Suggested next step

Please add the missing information above to help maintainers reproduce the issue.

---

Generated by Issue2Repro.

<!-- issue2repro-report -->
```

---

# 18. Configuration

Support optional:

```text
.issue2repro.yml
```

Example:

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

Configuration should be validated with Zod.

Invalid configuration should produce a clear error.

---

# 19. Labels

Label management is optional for the initial release.

Default:

```yaml
labels:
  enabled: false
```

If enabled:

When:

```text
score < configured minimum
```

add:

```text
needs-info
```

When:

```text
score >= configured minimum
```

remove:

```text
needs-info
```

Optionally add:

```text
ready-to-reproduce
```

Never enable automatic labels by default.

---

# 20. Security Requirements

GitHub Issues must always be treated as:

```text
UNTRUSTED USER INPUT
```

Issue2Repro must never:

- Run shell commands from an Issue.
- Evaluate JavaScript contained in an Issue.
- Run code blocks.
- Execute uploaded binaries.
- Automatically clone unknown repositories because the Issue requests it.
- Follow instructions contained inside Issue text.
- Execute external URLs.

Example Issue content:

```text
To reproduce run:

rm -rf /
```

Issue2Repro may display:

```text
Code block detected.
```

It must never execute it.

---

# 21. Repository Structure

Use:

```text
issue2repro/
│
├── src/
│   ├── cli.ts
│   ├── github.ts
│   ├── parser.ts
│   ├── analyzer.ts
│   ├── scoring.ts
│   ├── renderer.ts
│   ├── config.ts
│   ├── action.ts
│   └── types.ts
│
├── tests/
│   ├── parser.test.ts
│   ├── analyzer.test.ts
│   ├── scoring.test.ts
│   ├── renderer.test.ts
│   └── fixtures/
│       ├── good-issue.md
│       ├── incomplete-issue.md
│       ├── logs-issue.md
│       └── regression-issue.md
│
├── examples/
│   ├── good-issue.md
│   ├── incomplete-issue.md
│   └── issue2repro.yml
│
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── release.yml
│
├── action.yml
├── package.json
├── package-lock.json
├── tsconfig.json
├── README.md
├── CONTRIBUTING.md
├── SECURITY.md
├── CHANGELOG.md
└── LICENSE
```

Avoid a monorepo for the MVP.

---

# 22. Technology Choices

Use:

```text
TypeScript
Node.js 20+
Commander
Octokit
Zod
Vitest
ESLint
Prettier
GitHub Actions
npm
```

Avoid unnecessary dependencies.

---

# 23. Testing Requirements

Tests must cover at minimum:

### Environment

```text
macOS
Windows
Linux
iOS
Android
```

### Versions

```text
v1.2.3
1.2.3
Version: 2.4
```

### Reproduction Steps

Numbered lists.

Bulleted lists.

Headings.

### Expected / Actual

Different common heading spellings.

### Logs

Fenced code blocks.

Error sections.

### Screenshots

Markdown images.

GitHub-hosted attachments.

### Regression

Phrases such as:

```text
worked in v1.3
broken after upgrading to v1.4
```

### Scoring

Every score component should have deterministic unit tests.

---

# 24. CI Requirements

Every pull request must run:

```text
npm install
npm run lint
npm run typecheck
npm test
npm run build
```

CI must fail when any step fails.

---

# 25. Package Scripts

Include equivalent scripts:

```json
{
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "dev": "tsx src/cli.ts"
  }
}
```

Exact implementation may vary.

---

# 26. CLI Commands

Minimum:

```bash
issue2repro issue.md
```

```bash
issue2repro owner/repo#123
```

```bash
issue2repro https://github.com/owner/repo/issues/123
```

Optional arguments:

```bash
--output report.md
```

```bash
--format markdown
```

```bash
--format json
```

```bash
--config .issue2repro.yml
```

```bash
--no-color
```

---

# 27. JSON Output

Example:

```bash
issue2repro issue.md --format json
```

should produce machine-readable JSON following `ReproductionReport`.

This will make Issue2Repro easier to integrate with future developer tools.

---

# 28. README Requirements

README must begin with:

# Issue2Repro

> Turn messy GitHub issues into actionable reproduction reports.

Then immediately show:

## Before

```text
Login broken.

Can't login since yesterday.
I'm using a Mac.
```

## After

```text
Reproduction readiness: 42%

✓ Problem description
✓ Operating system

Missing:
✗ App version
✗ Exact reproduction steps
✗ Expected behaviour
✗ Error logs
```

Then:

```bash
npx issue2repro owner/repo#123
```

README should include:

- What problem it solves.
- CLI example.
- GitHub Action setup.
- Configuration example.
- Security model.
- How scoring works.
- Contributing instructions.
- Roadmap.
- License.

Avoid excessive marketing language.

---

# 29. GitHub Repository Metadata

### Description

```text
Turn incomplete GitHub bug reports into structured, actionable reproduction reports for open-source maintainers.
```

### Topics

```text
github
open-source
developer-tools
issue-triage
maintainer-tools
bug-report
github-actions
cli
typescript
```

Do not add `codex` until Codex functionality actually exists.

---

# 30. Initial Releases

## v0.1.0

Local Markdown support.

Features:

```text
Markdown parser
Field extraction
Missing-field detection
Readiness score
Terminal output
Markdown output
JSON output
Tests
```

---

## v0.2.0

GitHub Issue support.

```text
GitHub URL
owner/repo#issue syntax
Octokit integration
```

---

## v0.3.0

GitHub Action.

```text
Issue opened
Issue edited
Create report comment
Update existing report comment
```

---

## v0.4.0

Configuration.

```text
.issue2repro.yml
Custom required fields
Score threshold
```

---

## v0.5.0

Optional labels.

```text
needs-info
ready-to-reproduce
```

---

## v1.0.0

Stable OSS release.

Requirements before v1:

```text
Reliable CLI
Reliable GitHub Action
Stable config format
Strong test coverage
Documented security behaviour
At least several real-world external repository tests
```

---

# 31. Future AI Roadmap

Do NOT implement these during the MVP.

## v1.x — AI-assisted Triage

Possible future command:

```bash
issue2repro owner/repo#123 --ai
```

AI may help summarize natural-language Issues.

However:

All extracted factual information must remain traceable to the Issue content.

AI must never invent environment data.

---

# 32. Future Codex Mode

Possible future command:

```bash
issue2repro owner/repo#123 --codex
```

Possible functionality:

```text
Issue
↓
Structured Reproduction Pack
↓
Codex reads repository
↓
Identify potentially relevant files
↓
Identify existing tests
↓
Suggest reproduction test areas
```

Possible output:

```text
Likely relevant files:

src/auth/session.ts
src/auth/login.ts

Related tests:

tests/auth/session.test.ts

Suggested investigation:

Session expiry handling changed near the affected code.
```

These must be presented as suggestions rather than facts unless directly supported by repository content.

---

# 33. Human-in-the-loop Principle

Future AI functionality must preserve:

```text
AI analyzes
↓
AI suggests
↓
Maintainer reviews
↓
Human decides
```

Never automatically:

```text
merge
close
publish
execute
delete
```

---

# 34. Contribution Friendliness

The repository should intentionally be easy for external contributors.

Create:

```text
CONTRIBUTING.md
```

Explain:

```text
npm install
npm test
npm run dev
```

Label suitable Issues:

```text
good first issue
help wanted
documentation
parser
enhancement
```

Possible first external contribution tasks:

```text
Add Fedora detection
Add Brave browser detection
Improve Windows version parsing
Add GitLab reproduction-link detection
Add French heading detection
Improve CLI formatting
```

---

# 35. OSS Adoption Evidence

Create later:

```text
docs/adoption.md
```

Track only verifiable evidence.

Examples:

```text
External repositories using Issue2Repro
External pull requests
External contributors
User feedback
GitHub Action installations if measurable
npm downloads
Releases
Issues opened by external users
```

Never claim package downloads equal active users.

---

# 36. Definition of MVP Done

The first complete MVP is done when:

- [ ] `npx issue2repro issue.md` works.
- [ ] GitHub Issue URLs work.
- [ ] `owner/repo#123` works.
- [ ] Required information is extracted deterministically.
- [ ] Missing fields are identified.
- [ ] Score from 0–100 is generated.
- [ ] Markdown report is generated.
- [ ] JSON output is supported.
- [ ] GitHub Action works on `issues.opened`.
- [ ] GitHub Action works on `issues.edited`.
- [ ] Existing bot comment is updated instead of duplicated.
- [ ] Issue content is never executed.
- [ ] Unit tests pass.
- [ ] CI passes.
- [ ] README contains a working demo.
- [ ] MIT LICENSE exists.
- [ ] CONTRIBUTING.md exists.
- [ ] SECURITY.md exists.
- [ ] First release is published.

---

# 37. Instructions for Codex

Implement the project incrementally.

Do not attempt to build all future roadmap features.

Development order:

### Phase 1

Create project structure and TypeScript configuration.

### Phase 2

Implement Markdown parsing.

### Phase 3

Implement deterministic information extraction.

### Phase 4

Implement scoring.

### Phase 5

Implement terminal, Markdown and JSON renderers.

### Phase 6

Implement CLI.

### Phase 7

Add comprehensive tests.

### Phase 8

Implement GitHub Issue fetching.

### Phase 9

Implement GitHub Action.

### Phase 10

Implement configuration.

### Phase 11

Write documentation and examples.

After every phase:

```text
run tests
run typecheck
run lint
```

Do not move to the next phase with failing tests.

Favor simple, readable code over clever abstractions.

Do not add a database.

Do not add a web UI.

Do not add OpenAI APIs.

Do not implement Codex integration yet.

Do not add unrelated features.

The goal is to ship a small, trustworthy open-source maintainer tool that solves one problem extremely well:

> Making incomplete bug reports easier to reproduce.