/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * Chromium driver for the e2e suite (#473): launches Chrome for Testing
 * with the unpacked Chrome build loaded, and drives it over the Chrome
 * DevTools Protocol through a small hand-written client. No driver binary
 * and no automation library: one websocket to the browser target, with
 * flat sessions for the pages it opens.
 *
 * Chrome for Testing, not branded Chrome: since Chrome 137 the branded
 * builds ignore --load-extension. The privileged "probe" is the
 * extension's own settings page, as in the Firefox driver: code evaluated
 * there sees chrome.cookies and talks to the background store through the
 * same store bridge the UI uses. Nothing test-related ships in the build.
 */

import { ChildProcess, spawn } from "child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "fs";
import { homedir, tmpdir } from "os";
import { join, resolve } from "path";

/**
 * The Chrome for Testing build the suite runs on. CI installs exactly this
 * build (the e2e-chromium job reads the constant out of this file, which
 * __tests__/ci-workflow.spec.ts checks), and a local run looks for it in
 * the cache that `bunx @puppeteer/browsers install chrome@<version>`
 * fills. Bump it deliberately, like the Firefox pins, after a green run on
 * the new build. CHROME_BIN overrides it with any Chrome for Testing
 * binary.
 */
export const PINNED_CHROME_VERSION = "155.0.8059.39";

/** Where @puppeteer/browsers puts the executable, per platform. */
const CHROME_FOR_TESTING_LAYOUT: Record<
  string,
  { folder: string; executable: string }
> = {
  "darwin-arm64": {
    folder: "mac_arm",
    executable:
      "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
  },
  "darwin-x64": {
    folder: "mac",
    executable:
      "chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
  },
  "linux-x64": {
    folder: "linux",
    executable: "chrome-linux64/chrome",
  },
};

/**
 * The Chrome binary to launch: CHROME_BIN when set, otherwise the pinned
 * build in @puppeteer/browsers' default cache. Exported for the unit spec;
 * its collaborators are parameters so the spec needs no real install.
 */
export const resolveChromeBinary = ({
  env = process.env,
  home = homedir(),
  platform = `${process.platform}-${process.arch}`,
  exists = existsSync,
}: {
  env?: Record<string, string | undefined>;
  home?: string;
  platform?: string;
  exists?: (path: string) => boolean;
} = {}): string => {
  // A truthiness test, not `!== undefined`: an empty CHROME_BIN means
  // "not set", as with FIREFOX_BIN.
  if (env.CHROME_BIN) return env.CHROME_BIN;
  const install = `bunx @puppeteer/browsers install chrome@${PINNED_CHROME_VERSION} --path ~/.cache/puppeteer`;
  const layout = CHROME_FOR_TESTING_LAYOUT[platform];
  if (!layout) {
    throw new Error(
      `no Chrome for Testing layout known for ${platform}; set CHROME_BIN to a Chrome for Testing binary`
    );
  }
  const path = join(
    home,
    ".cache/puppeteer/chrome",
    `${layout.folder}-${PINNED_CHROME_VERSION}`,
    layout.executable
  );
  if (!exists(path)) {
    throw new Error(
      `Chrome for Testing ${PINNED_CHROME_VERSION} not found at ${path}; install it with \`${install}\` or set CHROME_BIN`
    );
  }
  return path;
};

export interface ChromeLaunchOptions {
  /** The unpacked extension to load. */
  extensionDir: string;
  /** A fresh, throwaway profile directory. */
  profileDir: string;
  /** Chrome's --host-resolver-rules value, e.g. "MAP *.adcp.test 127.0.0.1:1234". */
  hostResolverRules: string;
  /**
   * Plain-http origins to treat as secure contexts, so the fixture's pages
   * get Cache Storage (window.caches exists only in secure contexts).
   */
  secureOrigins: string[];
  /** Show the browser window instead of running headless. */
  headed?: boolean;
  /**
   * Chrome features to switch on, e.g. EnableSchemeBoundCookies, which
   * Edge can run with while Chrome for Testing leaves it off (#464).
   */
  enableFeatures?: string[];
}

/**
 * The command line for one run. Exported for the unit spec, which guards
 * the pieces the suite depends on: the extension loads (and is the only
 * one), DevTools picks a free port and reports it in the profile, and the
 * fixture hostnames resolve to the local server without a port in the
 * origin, so Chrome clears their storage like a real site's.
 */
export const chromeLaunchArgs = (options: ChromeLaunchOptions): string[] => [
  `--user-data-dir=${options.profileDir}`,
  // Port 0: Chrome picks a free port and writes it to DevToolsActivePort
  // in the profile, so parallel runs never collide.
  "--remote-debugging-port=0",
  `--load-extension=${options.extensionDir}`,
  `--disable-extensions-except=${options.extensionDir}`,
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-background-networking",
  "--disable-component-update",
  "--disable-sync",
  // On macOS, Chrome otherwise asks for the login keychain password to
  // reach "Chromium Safe Storage". The throwaway profile needs no real
  // keychain, so these keep the prompt from popping up on every run.
  "--use-mock-keychain",
  "--password-store=basic",
  `--host-resolver-rules=${options.hostResolverRules}`,
  `--unsafely-treat-insecure-origin-as-secure=${options.secureOrigins.join(",")}`,
  ...(options.enableFeatures?.length
    ? [`--enable-features=${options.enableFeatures.join(",")}`]
    : []),
  ...(options.headed ? [] : ["--headless"]),
  "about:blank",
];

/**
 * Reads the DevToolsActivePort file Chrome writes into the profile: the
 * port on the first line, the browser target's websocket path on the
 * second. Returns the websocket URL, or undefined while the file is not
 * complete. Exported for the unit spec.
 */
export const devToolsUrlFromActivePort = (text: string): string | undefined => {
  const [port, path] = text.split("\n").map((line) => line.trim());
  if (!/^\d+$/.test(port ?? "") || !path?.startsWith("/devtools/")) {
    return undefined;
  }
  return `ws://127.0.0.1:${port}${path}`;
};

/** The subset of Target.TargetInfo the suite reads. */
export interface TargetInfo {
  targetId: string;
  type: string;
  url: string;
}

/**
 * The extension's id, from its background service worker's target, or
 * undefined until that worker is up. Exported for the unit spec.
 */
export const extensionIdFromTargets = (
  targets: TargetInfo[],
  backgroundPath = "/bundles/background.js"
): string | undefined => {
  const worker = targets.find(
    (target) =>
      target.type === "service_worker" &&
      target.url.startsWith("chrome-extension://") &&
      new URL(target.url).pathname === backgroundPath
  );
  return worker ? new URL(worker.url).host : undefined;
};

/** What CdpClient needs from a websocket; the unit spec passes a fake. */
export interface CdpSocket {
  send: (data: string) => void;
  close: () => void;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: ((event: unknown) => void) | null;
}

interface Pending {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  method: string;
}

/**
 * A minimal CDP client: numbered requests matched to their responses,
 * with an optional flat-mode sessionId to address an attached page.
 * Events are not needed by the suite and are dropped.
 */
export class CdpClient {
  private nextId = 0;
  private readonly pending = new Map<number, Pending>();

  constructor(private readonly socket: CdpSocket) {
    socket.onmessage = (event) => this.receive(String(event.data));
    socket.onclose = () => {
      for (const { reject, method } of this.pending.values()) {
        reject(new Error(`${method}: the DevTools connection closed`));
      }
      this.pending.clear();
    };
  }

  /** Opens the browser-target websocket at url. */
  static connect = (url: string): Promise<CdpClient> =>
    new Promise((resolve, reject) => {
      const socket = new WebSocket(url);
      // A thin adapter: the client only needs these four members, and
      // keeping them on CdpSocket lets the unit spec pass a fake.
      const adapter: CdpSocket = {
        send: (data) => socket.send(data),
        close: () => socket.close(),
        onmessage: null,
        onclose: null,
      };
      socket.onmessage = (event) => adapter.onmessage?.(event);
      socket.onclose = (event) => adapter.onclose?.(event);
      socket.onopen = () => resolve(new CdpClient(adapter));
      socket.onerror = () =>
        reject(new Error(`could not connect to DevTools at ${url}`));
    });

  send = <T = any>(
    method: string,
    params: Record<string, unknown> = {},
    sessionId?: string
  ): Promise<T> => {
    const id = ++this.nextId;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve, reject, method });
      this.socket.send(
        JSON.stringify({
          id,
          method,
          params,
          ...(sessionId ? { sessionId } : {}),
        })
      );
    });
  };

  close = (): void => {
    this.socket.close();
  };

  private receive(data: string): void {
    const message = JSON.parse(data) as {
      id?: number;
      result?: unknown;
      error?: { message?: string };
    };
    if (message.id === undefined) return;
    const pending = this.pending.get(message.id);
    if (!pending) return;
    this.pending.delete(message.id);
    if (message.error) {
      pending.reject(
        new Error(`${pending.method}: ${JSON.stringify(message.error)}`)
      );
    } else {
      pending.resolve(message.result);
    }
  }
}

export const sleep = (ms: number): Promise<void> =>
  new Promise((done) => setTimeout(done, ms));

/**
 * Polls check until it returns a truthy value, and returns that value, or
 * undefined once timeoutMs has passed. A throwing check counts as "not
 * yet": pages and workers come up asynchronously.
 */
export const waitFor = async <T>(
  check: () => Promise<T | undefined | null | false>,
  timeoutMs: number,
  intervalMs = 250
): Promise<T | undefined> => {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const value = await check();
      if (value) return value;
    } catch {
      // not ready yet
    }
    if (Date.now() > deadline) return undefined;
    await sleep(intervalMs);
  }
};

/** A page target the suite opened and attached to. */
export interface ChromeTab {
  targetId: string;
  sessionId: string;
}

/** What a page on an origin can see of that origin's storage. */
export interface OriginStorage {
  origin: string;
  localStorage: string[];
  indexedDB: string[];
  cacheStorage: string[];
}

export interface ChromeSession {
  cdp: CdpClient;
  extensionId: string;
  /** The extension's settings page, kept open as the probe. */
  probe: ChromeTab;
  /** Opens url in a new tab and attaches to it. */
  openTab: (url: string) => Promise<ChromeTab>;
  closeTab: (tab: ChromeTab) => Promise<void>;
  /** Evaluates expression in tab and returns its (awaited) value. */
  evaluate: <T = unknown>(tab: ChromeTab, expression: string) => Promise<T>;
  /** Evaluates expression in the extension's settings page. */
  probeEval: <T = unknown>(expression: string) => Promise<T>;
  quit: () => Promise<void>;
}

/**
 * The unpacked Chrome build: `just build` writes the bundles into
 * extension/, which is what `just package_zip` zips.
 */
export const chromeExtensionDir = (): string => resolve("extension");

/**
 * Launches Chrome for Testing with the extension loaded and its settings
 * page open as the probe. The profile is a fresh directory under the OS
 * temp dir (TMPDIR moves it), removed again by quit().
 */
export const launchChrome = async ({
  hostResolverRules,
  secureOrigins,
  enableFeatures,
}: Pick<
  ChromeLaunchOptions,
  "hostResolverRules" | "secureOrigins" | "enableFeatures"
>): Promise<ChromeSession> => {
  const extensionDir = chromeExtensionDir();
  if (!existsSync(join(extensionDir, "bundles", "background.js"))) {
    throw new Error(
      "the extension is not built; run `just build` first (the e2e_chromium recipe does)"
    );
  }
  const profileDir = mkdtempSync(join(tmpdir(), "adcp-e2e-chromium-"));
  const binary = resolveChromeBinary();
  const browser: ChildProcess = spawn(
    binary,
    chromeLaunchArgs({
      extensionDir,
      profileDir,
      hostResolverRules,
      secureOrigins,
      enableFeatures,
      headed: process.env.E2E_HEADED === "1",
    }),
    { stdio: ["ignore", "ignore", "pipe"] }
  );
  // The end of Chrome's stderr, for the error when it fails to start
  // (a missing library, a sandbox the host refuses).
  let stderrTail = "";
  browser.stderr?.setEncoding("utf8");
  browser.stderr?.on("data", (chunk: string) => {
    stderrTail = (stderrTail + chunk).slice(-4000);
  });
  const exited = new Promise<void>((done) =>
    browser.once("exit", () => done())
  );
  const startupReport = (): string =>
    [
      browser.exitCode !== null ? `exit code ${browser.exitCode}` : "",
      browser.signalCode ? `signal ${browser.signalCode}` : "",
      stderrTail ? `stderr:\n${stderrTail}` : "",
    ]
      .filter(Boolean)
      .join("; ");

  const removeProfile = (): void =>
    rmSync(profileDir, { recursive: true, force: true });
  const kill = async (): Promise<void> => {
    if (browser.exitCode === null && browser.signalCode === null) {
      browser.kill("SIGKILL");
      await Promise.race([exited, sleep(5000)]);
    }
    removeProfile();
  };

  try {
    const url = await waitFor(
      async () =>
        devToolsUrlFromActivePort(
          readFileSync(join(profileDir, "DevToolsActivePort"), "utf8")
        ),
      20000
    );
    if (!url) {
      throw new Error(
        `Chrome (${binary}) did not open DevTools; ${startupReport()}`
      );
    }
    const cdp = await CdpClient.connect(url);

    const extensionId = await waitFor(async () => {
      const { targetInfos } = await cdp.send<{ targetInfos: TargetInfo[] }>(
        "Target.getTargets"
      );
      return extensionIdFromTargets(targetInfos);
    }, 20000);
    if (!extensionId) {
      throw new Error("the extension's service worker never started");
    }

    const attach = async (pageUrl: string): Promise<ChromeTab> => {
      const { targetId } = await cdp.send<{ targetId: string }>(
        "Target.createTarget",
        { url: pageUrl }
      );
      const { sessionId } = await cdp.send<{ sessionId: string }>(
        "Target.attachToTarget",
        { targetId, flatten: true }
      );
      return { targetId, sessionId };
    };
    const evaluate = async <T>(tab: ChromeTab, expression: string) => {
      const reply = await cdp.send<{
        result: { value?: T };
        exceptionDetails?: unknown;
      }>(
        "Runtime.evaluate",
        { expression, awaitPromise: true, returnByValue: true },
        tab.sessionId
      );
      if (reply.exceptionDetails) {
        throw new Error(
          `evaluate failed: ${JSON.stringify(reply.exceptionDetails).slice(0, 500)}`
        );
      }
      return reply.result.value as T;
    };

    const probe = await attach(
      `chrome-extension://${extensionId}/settings/settings.html`
    );
    // The store bridge answers once the page and the worker are both up.
    const bridged = await waitFor(
      () =>
        evaluate<boolean>(
          probe,
          `chrome.runtime.sendMessage({ type: "@@STORE_UPDATE_STATE" }).then((s) => Boolean(s && s.settings))`
        ),
      20000
    );
    if (!bridged) throw new Error("the settings page never reached the store");

    return {
      cdp,
      extensionId,
      probe,
      openTab: attach,
      closeTab: async (tab) => {
        await cdp.send("Target.closeTarget", { targetId: tab.targetId });
      },
      evaluate,
      probeEval: (expression) => evaluate(probe, expression),
      quit: async () => {
        try {
          await Promise.race([cdp.send("Browser.close"), sleep(5000)]);
        } catch {
          // already gone
        }
        cdp.close();
        await Promise.race([exited, sleep(5000)]);
        await kill();
      },
    };
  } catch (error) {
    await kill();
    throw error;
  }
};

/**
 * Waits for a fixture page to report that it has written its storage
 * (document.title "ready"), and fails with what the page reported instead.
 */
export const waitForReady = async (
  session: ChromeSession,
  tab: ChromeTab,
  timeoutMs = 20000
): Promise<void> => {
  let title = "";
  const ready = await waitFor(async () => {
    title = await session.evaluate<string>(tab, "document.title");
    return title === "ready";
  }, timeoutMs);
  if (!ready) throw new Error(`fixture page not ready, title: ${title}`);
};

/**
 * Reads origin's localStorage keys, IndexedDB database names and Cache
 * Storage cache names from a plain-text page on that origin. The page is
 * opened only to read and is closed again; it writes nothing.
 */
export const readOriginStorage = async (
  session: ChromeSession,
  origin: string,
  path = "/plain"
): Promise<OriginStorage> => {
  const tab = await session.openTab(`${origin}${path}`);
  try {
    const loaded = await waitFor(
      async () =>
        (await session.evaluate<string>(tab, "document.readyState")) ===
          "complete" &&
        (await session.evaluate<string>(tab, "location.origin")) === origin,
      15000
    );
    if (!loaded) throw new Error(`could not open ${origin}${path}`);
    return await session.evaluate<OriginStorage>(
      tab,
      `(async () => ({
        origin: location.origin,
        localStorage: Object.keys(localStorage).sort(),
        indexedDB: (await indexedDB.databases()).map((d) => d.name).sort(),
        cacheStorage: self.caches ? (await caches.keys()).sort() : ["(no caches API)"],
      }))()`
    );
  } finally {
    await session.closeTab(tab);
  }
};

/** A cookie as chrome.cookies reports it, the fields the suite reads. */
export interface ProbeCookie {
  name: string;
  domain: string;
}

/** Every cookie on domain or its subdomains, in the regular store. */
export const cookiesFor = (
  session: ChromeSession,
  domain: string
): Promise<ProbeCookie[]> =>
  session.probeEval<ProbeCookie[]>(
    `chrome.cookies.getAll({ domain: ${JSON.stringify(domain)} }).then((cs) => cs.map(({ name, domain }) => ({ name, domain })))`
  );

/** The background store's state, through the store bridge. */
export const storeState = <T = any>(session: ChromeSession): Promise<T> =>
  session.probeEval<T>(
    `chrome.runtime.sendMessage({ type: "@@STORE_UPDATE_STATE" })`
  );

/** Dispatches one action through the store bridge, as the UI does. */
export const dispatch = async (
  session: ChromeSession,
  action: Record<string, unknown>
): Promise<void> => {
  await session.probeEval(
    `chrome.runtime.sendMessage({ type: "@@STORE_DISPATCH", action: ${JSON.stringify(action)} }).then(() => true)`
  );
};

/**
 * Changes settings through the store bridge, then waits until the store
 * reports every value, and returns what it reports.
 */
export const updateSettings = async (
  session: ChromeSession,
  settings: Record<string, unknown>
): Promise<Record<string, unknown>> => {
  for (const [name, value] of Object.entries(settings)) {
    await dispatch(session, {
      type: "UPDATE_SETTING",
      payload: { name, value },
    });
  }
  let values: Record<string, unknown> = {};
  await waitFor(async () => {
    const state = await storeState<{
      settings: Record<string, { value: unknown }>;
    }>(session);
    values = Object.fromEntries(
      Object.keys(settings).map((name) => [name, state.settings[name]?.value])
    );
    return Object.entries(settings).every(
      ([name, value]) => values[name] === value
    );
  }, 10000);
  return values;
};

/** How many entries the cleanup log holds. */
export const activityLogLength = async (
  session: ChromeSession
): Promise<number> =>
  (await storeState<{ activityLog?: unknown[] }>(session)).activityLog
    ?.length ?? 0;
