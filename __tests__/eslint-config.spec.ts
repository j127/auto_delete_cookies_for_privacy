/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */
import { ESLint } from "eslint";

// `just lint` proves the config loads and the repo is clean, but it cannot
// prove the React rules are active: a plugin that contributes no rules also
// lints clean. That gap matters because a lint-stack upgrade can break a
// plugin outright. eslint-plugin-react 7.37.5 crashed ESLint 10 while
// loading its first rule, which is why @eslint-react/eslint-plugin replaced
// it (#396, stage 3). These tests lint small probes through the real
// eslint.config.mjs and expect the rules that guard real bug classes to
// fire as errors.

const ERROR = 2;

const errorRules = async (code: string, filePath: string) => {
  const eslint = new ESLint({ cwd: process.cwd() });
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages
    .filter((message) => message.severity === ERROR)
    .map((message) => message.ruleId);
};

describe("eslint.config.mjs", () => {
  it("reports a list rendered without keys", async () => {
    const code = `export const Probe = ({ items }: { items: string[] }) => (
  <ul>
    {items.map((item) => (
      <li>{item}</li>
    ))}
  </ul>
);
`;
    expect(await errorRules(code, "src/ui/probe.tsx")).toContain(
      "@eslint-react/no-missing-key"
    );
  }, 30000);

  it("reports a hook called conditionally", async () => {
    const code = `import * as React from "react";

export const Probe = ({ on }: { on: boolean }) => {
  if (on) {
    React.useEffect(() => undefined, []);
  }
  return null;
};
`;
    expect(await errorRules(code, "src/ui/probe.tsx")).toContain(
      "@eslint-react/rules-of-hooks"
    );
  }, 30000);

  it("applies the core rules ESLint 10 added to its recommended set", async () => {
    const code = `export const f = (): number => {
  let value = 1;
  value = 2;
  return value;
};
`;
    expect(await errorRules(code, "src/probe.ts")).toContain(
      "no-useless-assignment"
    );
  }, 30000);

  it("finds nothing to report in a clean component", async () => {
    const code = `export const Probe = ({ items }: { items: string[] }) => (
  <ul>
    {items.map((item) => (
      <li key={item}>{item}</li>
    ))}
  </ul>
);
`;
    expect(await errorRules(code, "src/ui/probe.tsx")).toEqual([]);
  }, 30000);
});
