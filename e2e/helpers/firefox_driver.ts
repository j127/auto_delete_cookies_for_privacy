/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * Real-Firefox driver for the E2E suite: starts geckodriver, launches a
 * fresh headless profile with caller-supplied prefs, temporarily installs
 * the packaged Firefox artifact, and exposes a privileged "probe" that
 * runs code inside the extension's own settings page — the only place
 * with full browser.cookies visibility (partitioned, container, and FPI
 * cookies included). Nothing test-related ships in the artifact; the
 * probe rides entirely on the real settings page.
 */

import { readdirSync, statSync } from "fs";
import { join, resolve } from "path";
import {
  download as downloadGeckodriver,
  start as startGeckodriver,
} from "geckodriver";
import { Builder, WebDriver } from "selenium-webdriver";
import firefox from "selenium-webdriver/firefox";
import { FIREFOX_ADDON_ID } from "../../scripts/firefox_manifest";

const GECKODRIVER_PORT = 4447;

/**
 * node-geckodriver downloads the driver binary at run time and, left
 * unpinned, resolves "latest" — which broke CI on 2026-07-21 when
 * geckodriver 0.37.1 shipped. Pin the binary so the suite tests one
 * known browser/driver pair (bump together with `firefox-version` in
 * ci.yml, which since #427 takes one pinned Firefox per channel from the
 * e2e-firefox job's matrix). GECKODRIVER_VERSION overrides the pin (node-geckodriver's own
 * env knob, honored here too). The download cache is a versionless path,
 * so wipe the cache (GECKODRIVER_CACHE_DIR, default OS temp dir) if a
 * stale local binary shadows a pin change. CI points that variable at a
 * directory it caches between runs and keys on this constant, so there a
 * pin change fetches a fresh binary on its own (.github/workflows/ci.yml).
 */
export const PINNED_GECKODRIVER_VERSION = "0.37.1";

/**
 * The driver version to download. || not ??: an empty
 * GECKODRIVER_VERSION must fall back to the pin, not reach
 * node-geckodriver as "" (which it treats as "fetch latest").
 */
export const geckodriverDownloadVersion = (): string =>
  process.env.GECKODRIVER_VERSION || PINNED_GECKODRIVER_VERSION;

/**
 * node-geckodriver forwards arbitrary camelCase params as --kebab-case
 * CLI flags, but 6.1.1's GeckodriverParameters type doesn't declare
 * allowSystemAccess yet; widen the type instead of casting the call.
 */
type GeckodriverStartParams = Parameters<typeof startGeckodriver>[0] & {
  allowSystemAccess?: boolean;
};

/**
 * Exported for the unit spec, which guards two contracts:
 *
 * - The chrome-context script (the UUID pref read) needs system access,
 *   which recent Firefox gates behind a startup flag — and as of
 *   geckodriver 0.37.1 that flag may no longer be set via capabilities
 *   ("Argument --remote-allow-system-access can't be set via
 *   capabilities"). It must be granted at the driver process with
 *   --allow-system-access, which geckodriver passes down to Firefox.
 *
 * - geckoDriverVersion must NOT appear here: start() forwards every
 *   param except cacheDir/customGeckoDriverPath/spawnOpts onto the
 *   geckodriver command line, and the binary exits on the unknown
 *   --gecko-driver-version flag (readiness poll then times out). The
 *   pin is applied by downloading first and starting the downloaded
 *   binary via customGeckoDriverPath (see ensureGeckodriver).
 */
export const geckodriverStartParams = (): GeckodriverStartParams => ({
  port: GECKODRIVER_PORT,
  allowSystemAccess: true,
});

export interface FirefoxSession {
  driver: WebDriver;
  /** moz-extension://<uuid> origin of the installed extension. */
  extensionOrigin: string;
  /** Window handle of the kept-open probe (settings) tab. */
  probeHandle: string;
  quit: () => Promise<void>;
}

/**
 * The packaged artifact to install. package_zip_firefox names zips by git
 * describe, so pick the newest matching zip rather than hardcoding one.
 */
const newestFirefoxZip = (): string => {
  // vitest runs the suite from the repo root; resolve from cwd rather
  // than module URL games (ESM has no __dirname).
  const dir = resolve("builds");
  let newest: { path: string; mtimeMs: number } | undefined;
  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch {
    // fall through to the error below
  }
  for (const entry of entries) {
    if (!entry.endsWith("_Firefox.zip")) continue;
    const path = join(dir, entry);
    const { mtimeMs } = statSync(path);
    if (!newest || mtimeMs > newest.mtimeMs) newest = { path, mtimeMs };
  }
  if (!newest) {
    throw new Error(
      "no packaged Firefox zip found; run `just package_zip_firefox` first (the e2e_firefox recipe does)"
    );
  }
  return newest.path;
};

/**
 * Attempts for the driver download. GitHub's release download answers
 * with a transient 5xx now and then — a 504 failed the e2e-firefox job on
 * 2026-09-21 (#398) — and the binary is fetched once per run, before the
 * first spec file, so one bad response used to fail the whole suite.
 */
export const DOWNLOAD_ATTEMPTS = 3;

/** Backoff before retrying: 500ms after the first failure, 1s after the second. */
export const downloadRetryDelayMs = (attempt: number): number => attempt * 500;

/** The part of node-geckodriver's download() that downloadWithRetry needs. */
type DownloadGeckodriver = (version: string) => Promise<string>;

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Download the pinned driver, retrying a transient failure. Its
 * collaborators are injected so the unit spec can drive the retry path
 * without touching the network; ensureGeckodriver passes the real ones.
 * The last error surfaces unchanged once the attempts run out.
 */
export const downloadWithRetry = async (
  download: DownloadGeckodriver,
  version: string,
  sleep: (ms: number) => Promise<void> = wait
): Promise<string> => {
  for (let attempt = 1; ; attempt++) {
    try {
      return await download(version);
    } catch (error) {
      if (attempt >= DOWNLOAD_ATTEMPTS) throw error;
      await sleep(downloadRetryDelayMs(attempt));
    }
  }
};

let geckodriverProcess: { kill: () => void } | undefined;

const ensureGeckodriver = async (): Promise<string> => {
  if (!geckodriverProcess) {
    // Download the pinned driver up front and start that exact binary;
    // passing geckoDriverVersion to start() instead would leak it onto
    // the binary's own command line (see geckodriverStartParams).
    const binaryPath = await downloadWithRetry(
      downloadGeckodriver,
      geckodriverDownloadVersion()
    );
    geckodriverProcess = (await startGeckodriver({
      ...geckodriverStartParams(),
      customGeckoDriverPath: binaryPath,
    })) as unknown as { kill: () => void };
    // geckodriver has no readiness signal on stdout we can await through
    // this API; poll the status endpoint instead.
    const deadline = Date.now() + 15000;
    for (;;) {
      try {
        const res = await fetch(`http://127.0.0.1:${GECKODRIVER_PORT}/status`);
        if (res.ok) break;
      } catch {
        // not up yet
      }
      if (Date.now() > deadline) {
        throw new Error("geckodriver did not become ready within 15s");
      }
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  return `http://127.0.0.1:${GECKODRIVER_PORT}`;
};

export const stopGeckodriver = (): void => {
  geckodriverProcess?.kill();
  geckodriverProcess = undefined;
};

/**
 * Builds the Firefox launch options. Exported for the unit spec, which
 * guards the geckodriver ≥0.37.1 contract: system access is granted via
 * the driver's --allow-system-access flag (see geckodriverStartParams),
 * so no *-remote-allow-system-access argument may appear here — passing
 * it via capabilities fails session creation.
 */
export const buildFirefoxOptions = (
  prefs: Record<string, string | number | boolean> = {}
): firefox.Options => {
  const options = new firefox.Options();
  if (process.env.E2E_HEADED !== "1") options.addArguments("-headless");
  const binary = process.env.FIREFOX_BIN;
  if (binary) options.setBinary(binary);
  // The suite talks to localhost fixtures; disable the captive-portal and
  // similar background noise so logs stay readable.
  options.setPreference("network.captive-portal-service.enabled", false);
  options.setPreference("browser.shell.checkDefaultBrowser", false);
  for (const [name, value] of Object.entries(prefs)) {
    options.setPreference(name, value);
  }
  return options;
};

/**
 * Launches Firefox with the extension installed and the probe tab open.
 * FIREFOX_BIN overrides the binary (e.g. Firefox ESR for the ESR column).
 */
export const launchFirefox = async (
  prefs: Record<string, string | number | boolean> = {}
): Promise<FirefoxSession> => {
  const serverUrl = await ensureGeckodriver();
  const options = buildFirefoxOptions(prefs);

  const driver = (await new Builder()
    .forBrowser("firefox")
    .setFirefoxOptions(options)
    .usingServer(serverUrl)
    .build()) as firefox.Driver;

  const zipPath = newestFirefoxZip();
  await driver.installAddon(zipPath, true);

  // The internal UUID is minted per profile; it lives in a pref only
  // chrome-context script can read.
  await driver.setContext(firefox.Context.CHROME);
  const uuidJson = (await driver.executeScript(
    'return Services.prefs.getStringPref("extensions.webextensions.uuids");'
  )) as string;
  await driver.setContext(firefox.Context.CONTENT);
  const uuid = (JSON.parse(uuidJson) as Record<string, string>)[
    FIREFOX_ADDON_ID
  ];
  if (!uuid) {
    throw new Error(
      `extension uuid not found for ${FIREFOX_ADDON_ID} in ${uuidJson}`
    );
  }
  const extensionOrigin = `moz-extension://${uuid}`;

  // The initial window stays parked on about:blank as an anchor so the
  // probe tab is never the session's last window (a session whose last
  // window closed cannot open a new one).
  await driver.get("about:blank");
  await driver.switchTo().newWindow("tab");
  await driver.get(`${extensionOrigin}/settings/settings.html`);
  const probeHandle = await driver.getWindowHandle();

  return {
    driver,
    extensionOrigin,
    probeHandle,
    quit: async () => {
      await driver.quit();
    },
  };
};

/**
 * Runs a privileged command in the settings-page context. The page's CSP
 * does not apply to webdriver-injected script, and the script runs with
 * the extension principal, so browser.* is fully available.
 */
export const probe = async (
  session: FirefoxSession,
  op:
    | { kind: "getAllCookies"; details: Record<string, unknown> }
    | { kind: "getState" }
    | { kind: "updateSettings"; settings: Record<string, unknown> }
    | { kind: "diagnostics" }
    | { kind: "getSessionStorage" }
    | {
        kind: "browsingDataRemove";
        options: Record<string, unknown>;
        dataTypes: Record<string, boolean>;
      }
): Promise<unknown> => {
  const { driver, probeHandle } = session;
  await driver.switchTo().window(probeHandle);
  return driver.executeAsyncScript(
    `
    const [op, done] = [arguments[0], arguments[arguments.length - 1]];
    (async () => {
      if (op.kind === "getAllCookies") {
        return browser.cookies.getAll(op.details);
      }
      if (op.kind === "getState") {
        const stored = await browser.storage.local.get("state");
        return JSON.parse(stored.state ?? "{}");
      }
      if (op.kind === "diagnostics") {
        const stored = await browser.storage.local.get("state");
        const state = JSON.parse(stored.state ?? "{}");
        return {
          pendingCleanup: await browser.storage.session.get("pendingCleanup"),
          alarms: await browser.alarms.getAll(),
          activeMode: state.settings?.activeMode?.value,
          delay: state.settings?.delayBeforeClean?.value,
          activityLog: (state.activityLog ?? []).slice(0, 2),
        };
      }
      if (op.kind === "updateSettings") {
        // Dispatch through the real UI store bridge, exactly like the
        // settings page does: the background store updates live and
        // persists itself. No extension reload, so no window teardown,
        // and no race against the background's own persist debounce.
        for (const [name, value] of Object.entries(op.settings)) {
          await browser.runtime.sendMessage({
            type: "@@STORE_DISPATCH",
            action: { type: "UPDATE_SETTING", payload: { name, value } },
          });
        }
        // The background persists its store on a 1s debounce; poll the
        // persisted copy so callers get a confirmed read-back.
        const readBack = async () => {
          const stored = await browser.storage.local.get("state");
          const state = JSON.parse(stored.state ?? "{}");
          return Object.fromEntries(
            Object.keys(op.settings).map((name) => [
              name,
              state.settings?.[name]?.value,
            ])
          );
        };
        const deadline = Date.now() + 8000;
        for (;;) {
          const values = await readBack();
          const allApplied = Object.entries(op.settings).every(
            ([name, value]) => values[name] === value
          );
          if (allApplied || Date.now() > deadline) return values;
          await new Promise((r) => setTimeout(r, 300));
        }
      }
      if (op.kind === "getSessionStorage") {
        return browser.storage.session.get(null);
      }
      if (op.kind === "browsingDataRemove") {
        try {
          await browser.browsingData.remove(op.options, op.dataTypes);
          return { ok: true };
        } catch (e) {
          return { ok: false, error: String(e) };
        }
      }
      throw new Error("unknown probe op: " + op.kind);
    })().then(done, (e) => done({ probeError: String(e) }));
    `,
    op
  );
};

/** Opens url in a new tab, waits for load, returns its handle. */
export const openTab = async (
  session: FirefoxSession,
  url: string
): Promise<string> => {
  const { driver } = session;
  await driver.switchTo().newWindow("tab");
  await driver.get(url);
  return driver.getWindowHandle();
};

/** Closes the given tab and returns focus to the probe tab. */
export const closeTab = async (
  session: FirefoxSession,
  handle: string
): Promise<void> => {
  const { driver, probeHandle } = session;
  await driver.switchTo().window(handle);
  await driver.close();
  await driver.switchTo().window(probeHandle);
};

/** Polls fn until it returns true or the timeout elapses. */
export const waitUntil = async (
  fn: () => Promise<boolean>,
  timeoutMs = 30000,
  intervalMs = 500
): Promise<boolean> => {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await fn()) return true;
    if (Date.now() > deadline) return false;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
};
