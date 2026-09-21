/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */
import { existsSync, readFileSync } from "fs";

// Node is a real dependency of this repo even though Bun is the package
// manager: every bunx tool and the Tailwind step of the build run on it.
// Its version is declared once, in .tool-versions, and everything else has
// to follow that file. These tests pin the wiring so the declarations
// cannot drift apart; an undeclared Node is how the local Node 26 versus CI
// Node 22 split behind #388 happened.

const url = (path: string): URL => new URL(`../${path}`, import.meta.url);
const read = (path: string): string => readFileSync(url(path), "utf8");

// Verbatim from actions/setup-node v7.0.0 (src/util.ts,
// getNodeVersionFromFile): for a non-JSON version file it takes the FIRST
// line that is one bare token, optionally prefixed by "node"/"nodejs". A
// mise.toml therefore resolves to garbage (a lone "#" comment line, or
// "[tools]"), which is why the declaration lives in .tool-versions.
const SETUP_NODE_VERSION_LINE = /^(?:node(js)?\s+)?v?(?<version>[^\s]+)$/m;

const WORKFLOWS = [".github/workflows/ci.yml", ".github/workflows/release.yml"];

describe("declared Node version", () => {
  it("is read by setup-node's parser as a bare major line", () => {
    const resolved = SETUP_NODE_VERSION_LINE.exec(read(".tool-versions"))
      ?.groups?.version;
    expect(resolved).toMatch(/^\d+$/);
  });

  it("is the node entry mise and asdf read from the same file", () => {
    const entry = /^node\s+(\S+)$/m.exec(read(".tool-versions"))?.[1];
    const resolved = SETUP_NODE_VERSION_LINE.exec(read(".tool-versions"))
      ?.groups?.version;
    expect(entry).toBeDefined();
    expect(entry).toBe(resolved);
  });

  it("matches the major of package.json engines.node", () => {
    const { engines } = JSON.parse(read("package.json"));
    const major = /^\^(\d+)\.\d+\.\d+$/.exec(engines.node)?.[1];
    const declared = /^node\s+(\S+)$/m.exec(read(".tool-versions"))?.[1];
    expect(major).toBe(declared);
  });

  it.each(WORKFLOWS)(
    "%s installs Node from .tool-versions in every job that installs Bun",
    (workflow) => {
      const yaml = read(workflow);
      const bunSteps = yaml.match(/uses: oven-sh\/setup-bun@/g) ?? [];
      const nodeSteps =
        yaml.match(
          /uses: actions\/setup-node@[0-9a-f]{40} # v\d+\.\d+\.\d+\n\s+with:\n\s+node-version-file: \.tool-versions\n/g
        ) ?? [];
      expect(bunSteps.length).toBeGreaterThan(0);
      expect(nodeSteps).toHaveLength(bunSteps.length);
    }
  );

  it.each(WORKFLOWS)("%s never hard-codes a Node version", (workflow) => {
    expect(read(workflow)).not.toMatch(/^\s*node-version:/m);
  });

  it("has no second source of truth", () => {
    // mise ignores these two by default, so they would silently disagree.
    expect(existsSync(url(".node-version"))).toBe(false);
    expect(existsSync(url(".nvmrc"))).toBe(false);
    // A mise.toml may appear later for other tools, but never for node.
    if (existsSync(url("mise.toml"))) {
      expect(read("mise.toml")).not.toMatch(/^\s*node(js)?\s*=/m);
    }
  });
});
