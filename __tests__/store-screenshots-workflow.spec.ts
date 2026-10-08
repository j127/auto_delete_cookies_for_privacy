/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */
import { readFileSync } from "fs";
import { RECIPES } from "./justfile-recipes";

// The "Store screenshots" workflow (#486) takes the AMO listing's
// screenshots on Linux, because Firefox started from some local shells
// cannot open its profile (macOS 27). It must stay in step with the
// e2e-firefox job in ci.yml: the same Firefox release as the Rel channel,
// the same geckodriver pin and cache, and the same pinned actions. These
// tests hold the two files together.

const read = (path: string): string =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const WORKFLOW = read(".github/workflows/store-screenshots.yml");
const CI = read(".github/workflows/ci.yml");

const TRIGGERS = /^on:\n((?:[ \t].*\n|\n)*)/m.exec(WORKFLOW)?.[1] ?? "";

const usesOf = (yaml: string): string[] =>
  [...yaml.matchAll(/uses: (\S+)/g)].map((m) => m[1]);

describe("Store screenshots workflow", () => {
  it("can be started by hand", () => {
    expect(TRIGGERS).toMatch(/^ {2}workflow_dispatch:$/m);
  });

  it("runs on pull requests that change the screenshot script", () => {
    const paths = [...TRIGGERS.matchAll(/^ {6}- (\S+)$/gm)].map((m) => m[1]);
    expect(paths).toEqual(
      expect.arrayContaining([
        ".github/workflows/store-screenshots.yml",
        "e2e/store/**",
        "e2e/helpers/store_screenshots.ts",
        "vitest.store-screenshots.config.ts",
      ])
    );
    // Only those: the job is no part of every pull request's checks.
    expect(TRIGGERS).toMatch(/^ {4}paths:$/m);
  });

  it("only reads the repository", () => {
    expect(WORKFLOW).toMatch(/^permissions:\n {2}contents: read$/m);
    expect(WORKFLOW).not.toMatch(/pull_request_target/);
  });

  it("installs the Firefox release that ci.yml tests as Rel", () => {
    const rel = /^ {10}- channel: Rel\n {12}firefox: "([^"]+)"$/m.exec(CI)?.[1];
    expect(rel, "no Rel channel in ci.yml").toBeDefined();
    expect(WORKFLOW).toContain(`firefox-version: "${rel}"`);
  });

  it("reads the geckodriver pin and keys its cache the way ci.yml does", () => {
    const sedOf = (yaml: string) => /sed -n '([^']*)'/.exec(yaml)?.[1];
    expect(sedOf(WORKFLOW)).toBeDefined();
    expect(sedOf(WORKFLOW)).toBe(sedOf(CI));
    expect(WORKFLOW).toMatch(
      /key: geckodriver-\$\{\{ runner\.os \}\}-\$\{\{ steps\.geckodriver\.outputs\.version \}\}/
    );
    const cached = /^ {10}path: (.*geckodriver.*)$/m.exec(WORKFLOW)?.[1];
    const used = /^ {10}GECKODRIVER_CACHE_DIR: (.*)$/m.exec(WORKFLOW)?.[1];
    expect(cached).toBeDefined();
    expect(used).toBe(cached);
  });

  it("pins every action by commit SHA, to the commits ci.yml uses", () => {
    const ciUses = new Set(usesOf(CI));
    const uses = usesOf(WORKFLOW);
    expect(uses.length).toBeGreaterThan(0);
    for (const action of uses) {
      expect(action).toMatch(/@[0-9a-f]{40}$/);
      expect(ciUses, `${action} differs from ci.yml`).toContain(action);
    }
  });

  it("runs the just recipe on the installed Firefox and uploads what it wrote", () => {
    expect(WORKFLOW).toMatch(/^ {6}- run: just store_screenshots_firefox$/m);
    expect(WORKFLOW).toMatch(
      /^ {10}FIREFOX_BIN: \$\{\{ steps\.setup-firefox\.outputs\.firefox-path \}\}$/m
    );
    const dir = /^ {10}STORE_SHOT_DIR: (.*)$/m.exec(WORKFLOW)?.[1];
    expect(dir).toBeDefined();
    expect(WORKFLOW).toContain(`path: ${dir}/*.png`);
    expect(WORKFLOW).toMatch(/^ {10}if-no-files-found: error$/m);
  });
});

describe("store_screenshots_firefox recipe", () => {
  it("packages the Firefox zip first, then runs the screenshot config", () => {
    expect(RECIPES.get("store_screenshots_firefox")).toMatchObject({
      dependencies: ["package_zip_firefox"],
      body: ["bunx vitest run --config vitest.store-screenshots.config.ts"],
    });
  });

  it("is left out of the e2e suite, which would otherwise take shots", () => {
    const e2e = read("vitest.e2e.config.ts");
    const shots = read("vitest.store-screenshots.config.ts");
    expect(shots).toContain('include: ["e2e/store/**/*.shots.ts"]');
    expect(e2e).toContain('include: ["e2e/**/*.e2e.ts"]');
  });
});
