/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */
import { readFileSync } from "fs";

// Node is a real dependency of this repo even though Bun is the package
// manager: every bunx tool and the Tailwind step of the build run on it.
// Its version is declared once, in mise.toml, and everything else has to
// follow that file. These tests pin the wiring so the declarations cannot
// drift apart; an undeclared Node is how the local Node 26 versus CI Node
// 22 split behind #388 happened.

const read = (path: string): string =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const miseNode = (): string => {
  const tools = read("mise.toml").split(/^\[tools\]$/m)[1] ?? "";
  const match = /^node\s*=\s*"([^"]+)"/m.exec(tools);
  if (!match) {
    throw new Error("mise.toml declares no node version under [tools]");
  }
  return match[1];
};

const WORKFLOWS = [".github/workflows/ci.yml", ".github/workflows/release.yml"];

describe("declared Node version", () => {
  it("is declared in mise.toml as a bare major line", () => {
    expect(miseNode()).toMatch(/^\d+$/);
  });

  it("matches the major of package.json engines.node", () => {
    const { engines } = JSON.parse(read("package.json"));
    const major = /^\^(\d+)\.\d+\.\d+$/.exec(engines.node)?.[1];
    expect(major).toBe(miseNode());
  });

  it.each(WORKFLOWS)(
    "%s installs Node from mise.toml in every job that installs Bun",
    (workflow) => {
      const yaml = read(workflow);
      const bunSteps = yaml.match(/uses: oven-sh\/setup-bun@/g) ?? [];
      const nodeSteps =
        yaml.match(
          /uses: actions\/setup-node@[0-9a-f]{40} # v\d+\.\d+\.\d+\n\s+with:\n\s+node-version-file: mise\.toml\n/g
        ) ?? [];
      expect(bunSteps.length).toBeGreaterThan(0);
      expect(nodeSteps).toHaveLength(bunSteps.length);
    }
  );

  it.each(WORKFLOWS)("%s never hard-codes a Node version", (workflow) => {
    expect(read(workflow)).not.toMatch(/^\s*node-version:/m);
  });

  it("has no .node-version or .nvmrc, which mise would silently ignore", () => {
    for (const file of [".node-version", ".nvmrc"]) {
      expect(() => read(file)).toThrow();
    }
  });
});
