/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */
import { spawnSync } from "child_process";
import {
  accessSync,
  constants,
  mkdirSync,
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
//
// Since #465 `just e2e_firefox` and `just store_screenshots_firefox` hand
// geckodriver the same wrapper through FIREFOX_BIN. geckodriver probes the
// binary with --version first and rejects it unless the output reads
// "Mozilla Firefox <version>", so the wrapper answers that probe itself.

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
  return readFileSync(calls, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => line.trimEnd());
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

// Runs a recipe body with `uname` and `bunx` stubbed; the stub records the
// FIREFOX_BIN it saw ("unset" when absent).
const firefoxBinSeenBy = (
  recipe: string,
  system: string,
  env: Record<string, string> = {}
): string => {
  const body = RECIPES.get(recipe)?.body ?? [];
  const script = body.join("\n").replaceAll("{{justfile_directory()}}", ROOT);
  const stubs = mkdtempSync(join(tmpdir(), "e2e-firefox-"));
  const seen = join(stubs, "seen");
  writeFileSync(join(stubs, "uname"), `#!/bin/sh\necho ${system}\n`, {
    mode: 0o755,
  });
  writeFileSync(
    join(stubs, "bunx"),
    `#!/bin/sh\necho "\${FIREFOX_BIN-unset}" > "${seen}"\n`,
    { mode: 0o755 }
  );
  const childEnv: NodeJS.ProcessEnv = {
    ...process.env,
    PATH: `${stubs}:${process.env.PATH ?? ""}`,
    ...env,
  };
  if (!("FIREFOX_BIN" in env)) delete childEnv.FIREFOX_BIN;
  const run = spawnSync("bash", ["-c", script], {
    cwd: ROOT,
    env: childEnv,
    encoding: "utf8",
  });
  expect(run.status, run.stderr).toBe(0);
  return readFileSync(seen, "utf8").trim();
};

describe.each(["e2e_firefox", "store_screenshots_firefox"])(
  "just %s",
  (recipe) => {
    it("is a bash script recipe that stops on errors", () => {
      expect(RECIPES.get(recipe)?.body.slice(0, 2)).toEqual([
        "#!/usr/bin/env bash",
        "set -euo pipefail",
      ]);
    });

    it("points FIREFOX_BIN at the open wrapper on macOS", () => {
      expect(firefoxBinSeenBy(recipe, "Darwin")).toBe(WRAPPER);
    });

    it("keeps a FIREFOX_BIN the caller set on macOS", () => {
      expect(
        firefoxBinSeenBy(recipe, "Darwin", {
          FIREFOX_BIN: "/opt/firefox-esr/firefox",
        })
      ).toBe("/opt/firefox-esr/firefox");
    });

    it("leaves FIREFOX_BIN unset elsewhere", () => {
      expect(firefoxBinSeenBy(recipe, "Linux")).toBe("unset");
    });

    it("keeps a FIREFOX_BIN the caller set elsewhere", () => {
      expect(
        firefoxBinSeenBy(recipe, "Linux", { FIREFOX_BIN: "/usr/bin/firefox" })
      ).toBe("/usr/bin/firefox");
    });
  }
);

describe("scripts/firefox_via_open.sh", () => {
  it("is executable", () => {
    expect(() => accessSync(WRAPPER, constants.X_OK)).not.toThrow();
  });

  it("starts Firefox through open with web-ext's arguments", () => {
    const source = readFileSync(WRAPPER, "utf8");
    expect(source.split("\n")[0]).toBe("#!/bin/sh");
    expect(source).toContain('"$OPEN" -W -n -a Firefox --args "$@"');
    expect(source).toContain("OPEN=${FIREFOX_VIA_OPEN_OPEN:-/usr/bin/open}");
  });

  // Builds a fake Firefox.app, a stub `open` that logs each call, and a stub
  // `date` that returns the given seconds one per call, then runs the wrapper.
  const runWrapper = (
    args: string[],
    options: {
      binaryOutput?: string;
      plistVersion?: string;
      seconds?: number[];
    } = {}
  ) => {
    const dir = mkdtempSync(join(tmpdir(), "firefox-via-open-"));
    const app = join(dir, "Firefox.app");
    mkdirSync(join(app, "Contents", "MacOS"), { recursive: true });
    if (options.binaryOutput !== undefined) {
      writeFileSync(
        join(app, "Contents", "MacOS", "firefox"),
        `#!/bin/sh\necho "${options.binaryOutput}"\n`,
        { mode: 0o755 }
      );
    }
    if (options.plistVersion !== undefined) {
      writeFileSync(
        join(app, "Contents", "Info.plist"),
        `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict><key>CFBundleShortVersionString</key><string>${options.plistVersion}</string></dict></plist>
`
      );
    }
    const calls = join(dir, "open-calls");
    const open = join(dir, "open");
    writeFileSync(
      open,
      `#!/bin/sh\nfor arg in "$@"; do printf '%s ' "$arg" >> "${calls}"; done\necho >> "${calls}"\n`,
      { mode: 0o755 }
    );
    const stubs = join(dir, "bin");
    mkdirSync(stubs);
    const ticks = join(dir, "ticks");
    writeFileSync(ticks, (options.seconds ?? [100, 100]).join("\n") + "\n");
    writeFileSync(
      join(stubs, "date"),
      `#!/bin/sh\nhead -n 1 "${ticks}"\nsed -i.bak 1d "${ticks}"\n`,
      { mode: 0o755 }
    );
    const run = spawnSync("sh", [WRAPPER, ...args], {
      env: {
        ...process.env,
        PATH: `${stubs}:${process.env.PATH ?? ""}`,
        FIREFOX_VIA_OPEN_APP: app,
        FIREFOX_VIA_OPEN_OPEN: open,
      },
      encoding: "utf8",
    });
    let launches: string[] = [];
    try {
      launches = readFileSync(calls, "utf8")
        .split("\n")
        .filter(Boolean)
        .map((line) => line.trimEnd());
    } catch {
      // `open` was never called
    }
    return { run, launches };
  };

  describe.each(["-v", "--version"])("%s", (flag) => {
    it("prints the version of the Firefox binary, suffix included", () => {
      const { run, launches } = runWrapper([flag], {
        binaryOutput: "Mozilla Firefox 140.17.0esr",
      });
      expect(run.status, run.stderr).toBe(0);
      expect(run.stdout).toBe("Mozilla Firefox 140.17.0esr\n");
      expect(launches).toEqual([]);
    });

    it.skipIf(process.platform !== "darwin")(
      "falls back to the version in Info.plist",
      () => {
        const { run } = runWrapper([flag], { plistVersion: "157.0.1" });
        expect(run.status, run.stderr).toBe(0);
        expect(run.stdout).toBe("Mozilla Firefox 157.0.1\n");
      }
    );

    it("fails with a message when no version can be read", () => {
      const { run, launches } = runWrapper([flag]);
      expect(run.status).toBe(1);
      expect(run.stdout).toBe("");
      expect(run.stderr).toContain("cannot read the version");
      expect(launches).toEqual([]);
    });
  });

  it("answers the output geckodriver requires, not a pinned number", () => {
    const { run } = runWrapper(["--version"], {
      binaryOutput: "Mozilla Firefox 999.1",
    });
    expect(run.stdout).toMatch(/^Mozilla Firefox \d+\.\d+/);
    expect(run.stdout).toContain("999.1");
  });

  it("passes the launch arguments on to open, once for a long session", () => {
    const args = ["-marionette", "-profile", "/tmp/rust_mozprofile1"];
    const { run, launches } = runWrapper(args, { seconds: [100, 160] });
    expect(run.status, run.stderr).toBe(0);
    expect(launches).toEqual([
      "-W -n -a Firefox --args -marionette -profile /tmp/rust_mozprofile1",
    ]);
  });

  it("retries once when Firefox exits at once", () => {
    const { run, launches } = runWrapper(["-headless"], {
      seconds: [100, 100],
    });
    expect(run.status, run.stderr).toBe(0);
    expect(launches).toEqual([
      "-W -n -a Firefox --args -headless",
      "-W -n -a Firefox --args -headless",
    ]);
  });
});
