/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */
import { spawnSync } from "child_process";
import {
  accessSync,
  constants,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { fileURLToPath } from "url";
import { RECIPES } from "./justfile-recipes";

// On macOS 27 a Firefox started as a child of another app's terminal is
// refused its own app-data folder and shows "Your Firefox profile cannot be
// loaded". Since #465 `just run_firefox` hands web-ext a wrapper that starts
// Firefox through `open` on macOS, and keeps the plain launch elsewhere.
// These checks run the recipe's body with `uname` and `bunx` stubbed, so
// they fail if macOS goes back to the plain launch.

const ROOT = fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "");
const WRAPPER = join(ROOT, "scripts", "firefox_via_open.sh");

// Runs the recipe body as just would, with just's justfile_directory()
// filled in, and returns the arguments the stubbed `bunx` was called with.
const bunxArgsOn = (system: string): string[] => {
  const body = RECIPES.get("run_firefox")?.body ?? [];
  const script = body.join("\n").replaceAll("{{justfile_directory()}}", ROOT);
  const stubs = mkdtempSync(join(tmpdir(), "run-firefox-"));
  const calls = join(stubs, "calls");
  writeFileSync(join(stubs, "uname"), `#!/bin/sh\necho ${system}\n`, {
    mode: 0o755,
  });
  writeFileSync(
    join(stubs, "bunx"),
    `#!/bin/sh\nfor arg in "$@"; do printf '%s\\n' "$arg" >> "${calls}"; done\n`,
    { mode: 0o755 }
  );
  const run = spawnSync("bash", ["-c", script], {
    cwd: ROOT,
    env: { ...process.env, PATH: `${stubs}:${process.env.PATH ?? ""}` },
    encoding: "utf8",
  });
  expect(run.status, run.stderr).toBe(0);
  return readFileSync(calls, "utf8").trimEnd().split("\n");
};

describe("just run_firefox", () => {
  it("is a bash script recipe that stops on errors", () => {
    expect(RECIPES.get("run_firefox")?.body.slice(0, 2)).toEqual([
      "#!/usr/bin/env bash",
      "set -euo pipefail",
    ]);
  });

  it("launches Firefox through the open wrapper on macOS", () => {
    const args = bunxArgsOn("Darwin");
    expect(args.slice(0, 2)).toEqual(["web-ext", "run"]);
    const firefox = args.indexOf("--firefox");
    expect(firefox, "passes --firefox to web-ext").toBeGreaterThan(-1);
    expect(args[firefox + 1]).toBe(WRAPPER);
  });

  it("keeps the plain launch elsewhere", () => {
    const args = bunxArgsOn("Linux");
    expect(args.slice(0, 2)).toEqual(["web-ext", "run"]);
    expect(args).not.toContain("--firefox");
  });
});

describe("scripts/firefox_via_open.sh", () => {
  it("is executable", () => {
    expect(() => accessSync(WRAPPER, constants.X_OK)).not.toThrow();
  });

  it("starts Firefox through open with web-ext's arguments", () => {
    const lines = readFileSync(WRAPPER, "utf8").split("\n");
    expect(lines[0]).toBe("#!/bin/sh");
    expect(lines).toContain('exec /usr/bin/open -W -n -a Firefox --args "$@"');
  });
});
