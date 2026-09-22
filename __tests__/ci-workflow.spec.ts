/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */
import { readFileSync } from "fs";
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
