/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * Guards the harness's geckodriver ≥0.37.1 contract (the 2026-07-21 CI
 * breakage): system access is granted with the driver-process
 * --allow-system-access flag and the driver binary is pinned, and no
 * *-remote-allow-system-access argument may ride in via capabilities —
 * geckodriver rejects the session with "Argument
 * --remote-allow-system-access can't be set via capabilities".
 */

import {
  buildFirefoxOptions,
  geckodriverDownloadVersion,
  geckodriverStartParams,
  PINNED_GECKODRIVER_VERSION,
} from "../../e2e/helpers/firefox_driver";

/**
 * The moz:firefoxOptions capability blob selenium would send at session
 * creation — exactly what geckodriver 0.37.1 validates.
 */
const mozFirefoxOptions = (
  options: ReturnType<typeof buildFirefoxOptions>
): { args?: string[]; prefs?: Record<string, unknown>; binary?: string } =>
  options.get("moz:firefoxOptions") as {
    args?: string[];
    prefs?: Record<string, unknown>;
    binary?: string;
  };

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("geckodriverStartParams", () => {
  it("grants system access at the driver process, not via capabilities", () => {
    expect(geckodriverStartParams().allowSystemAccess).toBe(true);
  });

  it("keeps geckoDriverVersion off the start params", () => {
    // start() would forward it as an unknown --gecko-driver-version CLI
    // flag, which the geckodriver binary rejects at startup.
    expect(geckodriverStartParams()).not.toHaveProperty("geckoDriverVersion");
  });
});

describe("geckodriverDownloadVersion", () => {
  it("pins the driver download instead of floating on latest", () => {
    vi.stubEnv("GECKODRIVER_VERSION", "");
    expect(PINNED_GECKODRIVER_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(geckodriverDownloadVersion()).toBe(PINNED_GECKODRIVER_VERSION);
  });

  it("lets GECKODRIVER_VERSION override the pin", () => {
    vi.stubEnv("GECKODRIVER_VERSION", "0.99.0");
    expect(geckodriverDownloadVersion()).toBe("0.99.0");
  });
});

describe("buildFirefoxOptions", () => {
  it("never passes a *-remote-allow-system-access argument via capabilities", () => {
    vi.stubEnv("E2E_HEADED", "1");
    const headed = mozFirefoxOptions(buildFirefoxOptions()).args ?? [];
    vi.stubEnv("E2E_HEADED", "");
    const headless = mozFirefoxOptions(buildFirefoxOptions()).args ?? [];
    for (const arg of [...headed, ...headless]) {
      expect(arg).not.toMatch(/remote-allow-system-access/);
    }
  });

  it("runs headless unless E2E_HEADED=1", () => {
    vi.stubEnv("E2E_HEADED", "");
    expect(mozFirefoxOptions(buildFirefoxOptions()).args).toContain(
      "-headless"
    );
    vi.stubEnv("E2E_HEADED", "1");
    expect(mozFirefoxOptions(buildFirefoxOptions()).args ?? []).not.toContain(
      "-headless"
    );
  });

  it("honors FIREFOX_BIN", () => {
    vi.stubEnv("FIREFOX_BIN", "/opt/firefox-esr/firefox");
    expect(mozFirefoxOptions(buildFirefoxOptions()).binary).toBe(
      "/opt/firefox-esr/firefox"
    );
  });

  it("applies the noise-reduction prefs plus caller prefs", () => {
    const prefs = mozFirefoxOptions(
      buildFirefoxOptions({ "privacy.firstparty.isolate": true })
    ).prefs;
    expect(prefs).toMatchObject({
      "network.captive-portal-service.enabled": false,
      "browser.shell.checkDefaultBrowser": false,
      "privacy.firstparty.isolate": true,
    });
  });
});
