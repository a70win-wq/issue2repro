# Security Policy

## Security model

Issue2Repro is designed around a simple rule: **GitHub issues are untrusted
user input.** The tool only reads and analyzes text; it never performs any
action on behalf of issue content.

Issue2Repro never:

- runs shell commands from an issue
- evaluates JavaScript contained in an issue
- runs code blocks
- executes uploaded binaries or attachments
- clones repositories because an issue asks it to
- follows instructions contained inside issue text
- fetches or executes external URLs found in issues

Code blocks, commands, and links found in issues are reported as inert data
(evidence) only. The GitHub Action only posts or updates its own report
comment; it never closes issues, merges pull requests, or modifies code.

## Supported versions

Only the latest release receives security fixes.

## Reporting a vulnerability

Please do not open a public issue for security problems.

Use GitHub's **private vulnerability reporting** (Security tab → "Report a
vulnerability") on this repository. You should receive an initial
acknowledgement within a few days, and we will work with you on a fix and
coordinated disclosure before any public release.
