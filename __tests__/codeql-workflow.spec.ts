/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */
import { readFileSync } from "fs";

// CodeQL is the repo's only code scanner, and it can be switched off without
// anything failing: from 2026-07-05 until #392 its triggers sat commented out,
// so the workflow could only be started by hand and nothing ran it. These
// tests pin the wiring, so turning the scan off or dropping a language takes
// a deliberate edit here too.

const WORKFLOW = readFileSync(
  new URL("../.github/workflows/codeql-analysis.yml", import.meta.url),
  "utf8"
);

// The body of the top-level `on:` block: every indented or blank line up to
// the next unindented key. A commented-out trigger stays in the body, but as
// a "# push:" line, which the patterns below do not accept.
const TRIGGERS = /^on:\n((?:[ \t].*\n|\n)*)/m.exec(WORKFLOW)?.[1] ?? "";

describe("CodeQL workflow", () => {
  it("has an on: block to inspect", () => {
    expect(TRIGGERS).not.toBe("");
  });

  it.each(["push", "pull_request"])("scans every %s to main", (event) => {
    expect(TRIGGERS).toMatch(
      new RegExp(
        `^  ${event}:\\n    branches: \\[[^\\]]*\\bmain\\b[^\\]]*\\]$`,
        "m"
      )
    );
  });

  it("scans on a schedule", () => {
    expect(TRIGGERS).toMatch(/^ {2}schedule:\n {4}- cron: "(\S+ ){4}\S+"$/m);
  });

  it("can still be started by hand", () => {
    expect(TRIGGERS).toMatch(/^ {2}workflow_dispatch:$/m);
  });

  it("scans the workflow files as well as the extension's code", () => {
    const languages = /^\s+language: \[([^\]]*)\]$/m
      .exec(WORKFLOW)?.[1]
      .split(",")
      .map((language) => language.trim().replace(/^"|"$/g, ""));
    // "actions" is the CodeQL language for the files in .github/workflows/;
    // "javascript" also covers TypeScript.
    expect(languages).toEqual(
      expect.arrayContaining(["actions", "javascript"])
    );
  });
});
