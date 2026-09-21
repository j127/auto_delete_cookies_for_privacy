/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */
import { existsSync, readdirSync, readFileSync } from "fs";

// Bun installs the dependencies, writes bun.lock, bundles the extension and
// runs scripts/, so its exact version decides both the lockfile and the bytes
// of the bundles that store reviewers rebuild from README-BUILD.md. It is
// declared once, on the bun line of .tool-versions, and everything else has
// to follow that file. These tests pin the wiring: before #391 the version
// was spelled four ways (.bun-version, "1.3.x" in the workflows, @types/bun,
// and whichever Bun happened to be installed locally), and none of them
// agreed.

const url = (path: string): URL => new URL(`../${path}`, import.meta.url);
const read = (path: string): string => readFileSync(url(path), "utf8");

// Verbatim from oven-sh/setup-bun v2.2.0 (src/utils.ts, the ".tool-versions"
// entry of FILE_VERSION_READERS): the first line that starts with "bun", and
// everything after it becomes the version, trailing comments included. When
// it finds nothing, setup-bun falls back to package.json and then quietly
// installs the latest Bun.
const SETUP_BUN_VERSION_LINE = /^bun\s*(?<version>.*?)$/m;

const DECLARED = SETUP_BUN_VERSION_LINE.exec(
  read(".tool-versions")
)?.groups?.version?.trim();

const WORKFLOWS = readdirSync(url(".github/workflows"))
  .filter((name) => /\.ya?ml$/.test(name))
  .map((name) => `.github/workflows/${name}`);

describe("declared Bun version", () => {
  it("is an exact version that setup-bun reads from .tool-versions", () => {
    expect(DECLARED).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("is the bun entry mise and asdf read from the same file", () => {
    const entry = /^bun\s+(\S+)$/m.exec(read(".tool-versions"))?.[1];
    expect(entry).toBeDefined();
    expect(entry).toBe(DECLARED);
  });

  it("matches @types/bun, which tsconfig.json loads for every file", () => {
    const { devDependencies } = JSON.parse(read("package.json"));
    expect(
      devDependencies["@types/bun"],
      "@types/bun must equal the bun line in .tool-versions. On a Dependabot PR that bumps @types/bun, move the bun line to the same version on that branch (then run `mise install` locally)."
    ).toBe(DECLARED);
  });

  it.each(["ci.yml", "release.yml"])("%s installs Bun", (workflow) => {
    expect(read(`.github/workflows/${workflow}`)).toMatch(
      /uses: oven-sh\/setup-bun@/
    );
  });

  it.each(WORKFLOWS)("%s installs Bun only from .tool-versions", (workflow) => {
    const yaml = read(workflow);
    const bunSteps = yaml.match(/uses: oven-sh\/setup-bun@/g) ?? [];
    const fileSteps =
      yaml.match(
        /uses: oven-sh\/setup-bun@[0-9a-f]{40} # v\d+\.\d+\.\d+\n\s+with:\n\s+bun-version-file: \.tool-versions\n/g
      ) ?? [];
    expect(fileSteps).toHaveLength(bunSteps.length);
    // setup-bun's bun-version input wins over bun-version-file, so a single
    // stray pin would quietly override the declaration.
    expect(yaml).not.toMatch(/^\s*bun-version:/m);
  });

  it("has no second source of truth", () => {
    // Each of these can carry a Bun version that some tool reads instead:
    // setup-bun reads .bun-version when pointed at it and falls back to
    // package.json's packageManager and engines.bun, and mise prefers a
    // mise.toml entry over .tool-versions.
    expect(existsSync(url(".bun-version"))).toBe(false);
    const { packageManager, engines } = JSON.parse(read("package.json"));
    expect(packageManager).toBeUndefined();
    expect(engines?.bun).toBeUndefined();
    // A mise.toml may appear later for other tools, but never for bun.
    if (existsSync(url("mise.toml"))) {
      expect(read("mise.toml")).not.toMatch(/^\s*bun\s*=/m);
    }
  });
});
