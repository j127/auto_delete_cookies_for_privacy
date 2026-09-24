/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */
import { readFileSync } from "fs";
import { PINNED_GECKODRIVER_VERSION } from "../e2e/helpers/firefox_driver";
import { FIREFOX_STRICT_MIN_VERSION } from "../scripts/firefox_manifest";
import { RECIPES } from "./justfile-recipes";

// `just ci` is the local check before a pull request, and it promises to
// run what the "ci" job in .github/workflows/ci.yml runs, in the same order.
// Until #393 it skipped the job's last three steps, among them
// `just lint_firefox`, the only step that runs Mozilla's add-on linter (the
// check AMO applies to every upload), so a change could pass locally and
// fail only once it reached CI. These tests hold the recipe and the job to
// one list.

const read = (path: string): string =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const WORKFLOW = read(".github/workflows/ci.yml");

// The "ci" job: every line after its header that is indented deeper than a
// job name (or blank), up to the comment or header of the next job.
const CI_JOB =
  /^ {2}ci:\n((?: {3,}\S.*\n|[ \t]*\n)*)/m.exec(WORKFLOW)?.[1] ?? "";

// The job's commands, in order. Only `run:` steps count: the `uses:` steps
// install the tools and upload the zips, which a local run does not need.
const CI_STEPS = [...CI_JOB.matchAll(/^[ \t]+(?:- )?run: (.*)$/gm)].map(
  (match) => match[1].trim()
);

// The recipe a step runs: `just <recipe>`, or a recipe whose whole body is
// that one command (CI calls `bun install --frozen-lockfile` directly).
const recipeFor = (step: string): string => {
  const called = /^just (\w+)$/.exec(step)?.[1];
  if (called) return called;
  const same = [...RECIPES].find(
    ([, { body }]) => body.length === 1 && body[0] === step
  );
  return same?.[0] ?? `(no recipe runs "${step}")`;
};

describe("just ci", () => {
  it("has a ci job in ci.yml to compare against", () => {
    expect(CI_STEPS.length).toBeGreaterThan(0);
  });

  it("runs the steps of the ci job, in the same order", () => {
    expect(RECIPES.get("ci")?.dependencies).toEqual(CI_STEPS.map(recipeFor));
  });

  it("runs nothing that the ci job does not", () => {
    expect(RECIPES.get("ci")?.body).toEqual([]);
  });
});

describe("CI workflow", () => {
  // The body of the top-level `on:` block, as in codeql-workflow.spec.ts.
  const TRIGGERS = /^on:\n((?:[ \t].*\n|\n)*)/m.exec(WORKFLOW)?.[1] ?? "";

  it.each(["push", "pull_request"])("runs on every %s to main", (event) => {
    expect(TRIGGERS).toMatch(
      new RegExp(
        `^ {2}${event}:\\n(?: {4}#.*\\n)* {4}branches: \\[[^\\]]*\\bmain\\b[^\\]]*\\]$`,
        "m"
      )
    );
  });
});

describe("e2e-firefox job", () => {
  // Same shape as CI_JOB above, for the job that runs the real-Firefox
  // suite. Since #398 it caches the geckodriver binary, and the cache key
  // has to follow the pin in e2e/helpers/firefox_driver.ts.
  const E2E_JOB =
    /^ {2}e2e-firefox:\n((?: {3,}\S.*\n|[ \t]*\n)*)/m.exec(WORKFLOW)?.[1] ?? "";

  it("has an e2e-firefox job in ci.yml to compare against", () => {
    expect(E2E_JOB).not.toBe("");
  });

  it("reads the driver pin out of the helper, with a pattern that still matches it", () => {
    const script = /sed -n '([^']*)'/.exec(E2E_JOB)?.[1] ?? "";
    expect(script, "no sed script left in the job to read the pin").not.toBe(
      ""
    );

    // Turn the sed substitution back into a JS regex: same pattern, the
    // BRE group escapes dropped. If the constant is ever renamed or
    // reformatted, the workflow step would silently yield an empty
    // version, and this is what catches that.
    const pattern = /^s\/(.*)\/\\1\/p$/.exec(script)?.[1] ?? "";
    expect(
      pattern,
      "the sed script is no longer a s/.../\\1/p substitution"
    ).not.toBe("");
    const asRegExp = new RegExp(
      pattern.replaceAll("\\(", "(").replaceAll("\\)", ")"),
      "m"
    );

    expect(
      asRegExp.exec(read("e2e/helpers/firefox_driver.ts"))?.[1],
      "the workflow step would not find the pin any more"
    ).toBe(PINNED_GECKODRIVER_VERSION);
  });

  it("keys the cache on that version, so a pin change fetches a fresh binary", () => {
    // node-geckodriver's cache path carries no version: a stale binary
    // would otherwise shadow a new pin.
    expect(E2E_JOB).toMatch(
      /key: geckodriver-\$\{\{ runner\.os \}\}-\$\{\{ steps\.geckodriver\.outputs\.version \}\}/
    );
  });

  describe("channels", () => {
    // Since #427 the job runs once per channel column of the manual
    // matrix (docs/testing-firefox.md), each on a pinned Firefox, so every
    // pull request fills the automated rows of both columns.
    const ENTRIES = [
      ...E2E_JOB.matchAll(/^ {10}- channel: (\S+)\n {12}firefox: "([^"]+)"$/gm),
    ].map(([, channel, firefox]) => ({ channel, firefox }));
    const versionOf = (channel: string): string =>
      ENTRIES.find((entry) => entry.channel === channel)?.firefox ?? "";
    const major = (version: string): number => Number.parseInt(version, 10);

    it("runs once per channel column of the manual test matrix", () => {
      const header =
        read("docs/testing-firefox.md")
          .split("\n")
          .find((line) => line.startsWith("| #")) ?? "";
      const columns = header
        .split("|")
        .map((cell) => cell.trim())
        .filter(Boolean);
      expect(columns.slice(-2)).toEqual(["ESR", "Rel"]);
      expect(ENTRIES.map((entry) => entry.channel)).toEqual(columns.slice(-2));
    });

    it("pins an ESR build for ESR and a release build for Rel", () => {
      expect(versionOf("ESR")).toMatch(/^\d+\.\d+(\.\d+)?esr$/);
      expect(versionOf("Rel")).toMatch(/^\d+\.\d+(\.\d+)?$/);
      expect(major(versionOf("Rel"))).toBeGreaterThan(major(versionOf("ESR")));
    });

    it("tests an ESR that the manifest still supports", () => {
      // A strict_min_version above the ESR pin would make the ESR run
      // test a Firefox that refuses to install the extension.
      expect(major(versionOf("ESR"))).toBeGreaterThanOrEqual(
        major(FIREFOX_STRICT_MIN_VERSION)
      );
    });

    it("installs the channel's pinned version, not a fixed one", () => {
      expect(E2E_JOB).toMatch(
        /^ {10}firefox-version: \$\{\{ matrix\.firefox \}\}$/m
      );
    });

    it("names each run after its channel and lets both finish", () => {
      expect(E2E_JOB).toMatch(
        /^ {4}name: e2e-firefox \(\$\{\{ matrix\.channel \}\}\)$/m
      );
      // Which channel broke is the signal; fail-fast would cancel the
      // other run and hide it.
      expect(E2E_JOB).toMatch(/^ {6}fail-fast: false$/m);
    });
  });

  it("caches the directory the suite actually downloads into", () => {
    const cached = /^ {10}path: (.*)$/m.exec(E2E_JOB)?.[1];
    const used = /^ {10}GECKODRIVER_CACHE_DIR: (.*)$/m.exec(E2E_JOB)?.[1];
    expect(cached, "no cache path in the e2e-firefox job").toBeDefined();
    expect(
      used,
      "the suite is not pointed at a stable cache directory"
    ).toBeDefined();
    expect(
      used,
      "the cached path and GECKODRIVER_CACHE_DIR must be one directory"
    ).toBe(cached);
  });
});
