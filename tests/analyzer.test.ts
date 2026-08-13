import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { analyzeIssue } from "../src/analyzer.js";
import { DEFAULT_CONFIG } from "../src/config.js";
import type { IssueInput, ReproductionReport } from "../src/types.js";

function fixture(name: string): string {
  return readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
}

function analyze(body: string, title = "Test issue"): ReproductionReport {
  const input: IssueInput = { title, body, source: { type: "markdown" } };
  return analyzeIssue(input, DEFAULT_CONFIG);
}

describe("fixtures", () => {
  it("scores a complete issue as excellent (good-issue.md)", () => {
    const report = analyze(fixture("good-issue.md"), "Login fails after updating to v2.1.0");

    expect(report.readinessScore).toBe(100);
    expect(report.readinessStatus).toBe("excellent");
    expect(report.problemDescription).toContain("logging in with valid credentials");
    expect(report.reproduction.steps).toHaveLength(3);
    expect(report.reproduction.expectedBehaviour).toContain("signed in");
    expect(report.reproduction.actualBehaviour).toContain("error banner");
    expect(report.environment.os).toBe("macOS");
    expect(report.environment.osVersion).toBe("15");
    expect(report.environment.browser).toBe("Chrome");
    expect(report.environment.appVersion).toBe("2.1.0");
    expect(report.environment.runtime).toBe("Node.js");
    expect(report.evidence.logs.length).toBeGreaterThan(0);
    expect(report.evidence.screenshots).toHaveLength(1);
    expect(report.evidence.links).toContain("https://stackblitz.com/edit/login-bug-repro");
    expect(report.regression.detected).toBe(true);
    expect(report.missingFields).toEqual([]);
  });

  it("scores an incomplete issue as insufficient (incomplete-issue.md)", () => {
    const report = analyze(fixture("incomplete-issue.md"), "Login broken");

    expect(report.readinessScore).toBe(25);
    expect(report.readinessStatus).toBe("insufficient");
    expect(report.problemDescription).toBe("Login broken.");
    expect(report.environment.os).toBe("macOS");
    expect(report.environment.osVersion).toBeNull();
    expect(report.reproduction.steps).toEqual([]);
    expect(report.missingFields).toContain("reproduction_steps");
    expect(report.missingFields).toContain("expected_behavior");
    expect(report.missingFields).toContain("app_version");
    expect(report.missingFields).toContain("os_version");
  });

  it("detects logs and explicit versions (logs-issue.md)", () => {
    const report = analyze(fixture("logs-issue.md"), "Build fails");

    expect(report.environment.os).toBe("Windows");
    expect(report.environment.osVersion).toBe("11");
    expect(report.environment.appVersion).toBe("3.2.1");
    expect(report.evidence.logs.some((log) => log.includes("Cannot find module"))).toBe(true);
  });

  it("detects regressions (regression-issue.md)", () => {
    const report = analyze(fixture("regression-issue.md"), "Search results are empty");

    expect(report.regression.detected).toBe(true);
    expect(report.regression.description).toContain("broken after upgrading");
    expect(report.reproduction.steps).toHaveLength(3);
    expect(report.reproduction.expectedBehaviour).toBe("results are listed.");
    expect(report.reproduction.actualBehaviour).toBe("the results list stays empty.");
    expect(report.environment.appVersion).not.toBeNull();
  });
});

describe("environment detection", () => {
  it.each([
    ["I'm using a Mac.", "macOS"],
    ["Running on macOS 15.", "macOS"],
    ["Happens on Windows 11.", "Windows"],
    ["Reproduces on Ubuntu 24.04.", "Linux"],
    ["Seen on iOS 19 on my iPhone.", "iOS"],
    ["Android 16, Pixel device.", "Android"],
  ])("detects %s as %s", (body, os) => {
    expect(analyze(body).environment.os).toBe(os);
  });

  it("extracts OS versions", () => {
    expect(analyze("macOS 15.2 here").environment.osVersion).toBe("15.2");
    expect(analyze("Windows 11 machine").environment.osVersion).toBe("11");
    expect(analyze("Ubuntu 24.04 LTS").environment.osVersion).toBe("24.04");
    expect(analyze("iOS 19 beta").environment.osVersion).toBe("19");
    expect(analyze("Android 16").environment.osVersion).toBe("16");
  });

  it("returns Unknown fields as null when nothing matches", () => {
    const report = analyze("Something is wrong with the button.");
    expect(report.environment.os).toBeNull();
    expect(report.environment.browser).toBeNull();
    expect(report.environment.runtime).toBeNull();
  });

  it("detects browsers", () => {
    expect(analyze("Happens in Chrome 126 only.").environment.browser).toBe("Chrome");
    expect(analyze("Safari issue on macOS.").environment.browser).toBe("Safari");
    expect(analyze("Only Firefox shows this.").environment.browser).toBe("Firefox");
    expect(analyze("Edge renders this wrongly.").environment.browser).toBe("Edge");
  });

  it("detects runtimes and versions", () => {
    const node = analyze("Running Node 22.4 locally.");
    expect(node.environment.runtime).toBe("Node.js");
    expect(node.environment.runtimeVersion).toBe("22.4");

    const python = analyze("Python 3.13 script crashes.");
    expect(python.environment.runtime).toBe("Python");
    expect(python.environment.runtimeVersion).toBe("3.13");

    const go = analyze("Built with Go 1.25.");
    expect(go.environment.runtime).toBe("Go");
    expect(go.environment.runtimeVersion).toBe("1.25");
  });
});

describe("version detection", () => {
  it("detects v-prefixed versions", () => {
    expect(analyze("This broke in v1.2.3 for me.").environment.appVersion).toBe("1.2.3");
  });

  it("detects bare semver versions", () => {
    expect(analyze("Using 1.2.3 on my machine.").environment.appVersion).toBe("1.2.3");
  });

  it("detects labelled versions", () => {
    expect(analyze("version 2.4 is affected").environment.appVersion).toBe("2.4");
    expect(analyze("Version: 3.2.1").environment.appVersion).toBe("3.2.1");
  });

  it("does not treat Node versions as the application version", () => {
    const report = analyze("Using Node 22.4 to run the app.");
    expect(report.environment.runtime).toBe("Node.js");
    expect(report.environment.appVersion).toBeNull();
  });
});

describe("reproduction steps", () => {
  it("extracts numbered lists", () => {
    const report = analyze("1. Open Settings\n2. Click Profile\n3. Application crashes");
    expect(report.reproduction.steps).toEqual([
      "Open Settings",
      "Click Profile",
      "Application crashes",
    ]);
  });

  it("extracts bulleted lists", () => {
    const report = analyze("- launch the app\n- sign in\n- click upload");
    expect(report.reproduction.steps).toEqual(["launch the app", "sign in", "click upload"]);
  });

  it("extracts steps from a heading section", () => {
    const report = analyze("## Steps to reproduce\n\n1. Start\n2. Stop");
    expect(report.reproduction.steps).toEqual(["Start", "Stop"]);
  });

  it("extracts steps from Step N headings", () => {
    const report = analyze(
      "### Step 1: Open the app\n\nDetails here.\n\n### Step 2: Click save\n\nMore details.",
    );
    expect(report.reproduction.steps).toEqual(["Open the app", "Click save"]);
  });

  it("does not treat expected-behaviour bullets as steps", () => {
    const report = analyze("## Expected behaviour\n\n- the app saves\n- a toast appears");
    expect(report.reproduction.steps).toEqual([]);
    expect(report.reproduction.expectedBehaviour).toContain("the app saves");
  });
});

describe("expected and actual behaviour", () => {
  it.each([
    ["## Expected behaviour\n\nIt saves.", "It saves."],
    ["## Expected behavior\n\nIt saves.", "It saves."],
    ["## Expected\n\nIt saves.", "It saves."],
    ["## What should happen\n\nIt saves.", "It saves."],
  ])("detects expected heading: %s", (body, expected) => {
    expect(analyze(body).reproduction.expectedBehaviour).toBe(expected);
  });

  it.each([
    ["## Actual behaviour\n\nIt crashes.", "It crashes."],
    ["## Actual behavior\n\nIt crashes.", "It crashes."],
    ["## What happened\n\nIt crashes.", "It crashes."],
    ["## Result\n\nIt crashes.", "It crashes."],
  ])("detects actual heading: %s", (body, expected) => {
    expect(analyze(body).reproduction.actualBehaviour).toBe(expected);
  });

  it("detects inline expected/actual labels", () => {
    const report = analyze("Expected: a dialog opens.\n\nActual: nothing happens.");
    expect(report.reproduction.expectedBehaviour).toBe("a dialog opens.");
    expect(report.reproduction.actualBehaviour).toBe("nothing happens.");
  });
});

describe("evidence detection", () => {
  it("treats fenced code blocks as logs", () => {
    const report = analyze("Broken.\n\n```\nSIGABRT\n```\n");
    expect(report.evidence.logs.some((log) => log.includes("SIGABRT"))).toBe(true);
  });

  it("detects Error: lines in prose", () => {
    const report = analyze("It fails.\n\nError: ENOENT no such file");
    expect(report.evidence.logs.some((log) => log.includes("ENOENT"))).toBe(true);
  });

  it("detects Markdown images as screenshots", () => {
    const report = analyze("![error](https://example.test/error.png)");
    expect(report.evidence.screenshots).toEqual(["https://example.test/error.png"]);
  });

  it("detects GitHub-hosted attachments as screenshots", () => {
    const report = analyze(
      "See https://github.com/owner/repo/files/123/log.png attached above.",
    );
    expect(report.evidence.screenshots).toEqual([
      "https://github.com/owner/repo/files/123/log.png",
    ]);
  });

  it("detects reproduction links from known hosts only", () => {
    const report = analyze(
      "Repro: https://codesandbox.io/s/abc and https://example.test/page",
    );
    expect(report.evidence.links).toContain("https://codesandbox.io/s/abc");
    expect(report.evidence.links).not.toContain("https://example.test/page");
  });
});

describe("regression detection", () => {
  it.each([
    "This worked before yesterday's change.",
    "It started after update to the new build.",
    "Broken after upgrading to the latest release.",
    "The previous version worked fine.",
    "Failing since version 2.0.",
    "I think this is a regression.",
    "It worked in v1.3 but not now.",
  ])("detects regression phrase: %s", (body) => {
    const report = analyze(body);
    expect(report.regression.detected).toBe(true);
    expect(report.regression.description).not.toBeNull();
  });

  it("does not report regressions without a matching phrase", () => {
    expect(analyze("The button is blue.").regression.detected).toBe(false);
  });
});

describe("security", () => {
  it("never executes content and treats hostile issues as data", () => {
    const report = analyze(
      "To reproduce run:\n\n```bash\nrm -rf /\n```\n\nThen it crashes on macOS 15.",
    );
    // The command is recorded as inert log evidence, nothing more.
    expect(report.evidence.logs.some((log) => log.includes("rm -rf /"))).toBe(true);
    expect(report.environment.os).toBe("macOS");
  });

  it("ignores quoted bot markers in issue bodies", () => {
    const report = analyze(
      "Still broken.\n\n<!-- issue2repro-report -->\n- [ ] Application version\n",
    );
    expect(report.reproduction.steps).toEqual([]);
    expect(report.problemDescription).toBe("Still broken.");
  });
});

describe("missing fields and configuration", () => {
  it("lists missing fields required-first", () => {
    const report = analyze("Broken thing.");
    const requiredIndex = report.missingFields.indexOf("reproduction_steps");
    const optionalIndex = report.missingFields.indexOf("logs");
    expect(requiredIndex).toBeGreaterThanOrEqual(0);
    expect(optionalIndex).toBeGreaterThan(requiredIndex);
  });

  it("respects custom required fields from configuration", () => {
    const report = analyzeIssue(
      { title: "t", body: "Broken.", source: { type: "markdown" } },
      {
        ...DEFAULT_CONFIG,
        required: ["reproduction_steps"],
        optional: ["logs"],
      },
    );
    expect(report.missingFields).toEqual(["reproduction_steps", "logs"]);
  });
});
