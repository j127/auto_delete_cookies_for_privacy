/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * Matrix rows 11 and 12: private windows with the extension's private
 * access on and off. Each row runs in its own session, because the access
 * is decided at install: row 11 installs the add-on with private access
 * (the "Allow this extension to run in private windows" box at the install
 * prompt), row 12 without it (a fresh install's default, and the state
 * that revoking the access in about:addons returns to).
 *
 * Private cookies are read from chrome context (the cookie service with
 * privateBrowsingId 1), so the check does not depend on the access under
 * test. Every private window keeps one tab open on about:blank: closing a
 * session's last private window makes Firefox drop all private cookies
 * itself, which would pass any cleanup check without the extension.
 *
 * What stays manual: keeping a site from the popup in a private window
 * (webdriver cannot click the toolbar popup; the rule is dispatched into
 * the Private list the popup writes to), and the about:addons toggle that
 * revokes the access while the extension runs.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  backgroundConsoleErrors,
  closeTab,
  extensionScriptErrors,
  FirefoxSession,
  inChrome,
  inProbe,
  launchFirefox,
  openTab,
  probe,
  stopGeckodriver,
  tapBackgroundConsoleErrors,
  waitUntil,
} from "../helpers/firefox_driver";
import { FixtureServer, startFixtureServer } from "../helpers/fixture_server";

interface StoredExpression {
  expression: string;
  listType: string;
}

interface ActivityEntry {
  storeIds?: Record<string, { cookie: { hostname: string } }[]>;
  browsingDataCleanup?: Record<string, string[] | undefined>;
}

interface PersistedState {
  lists?: Record<string, StoredExpression[]>;
  activityLog?: ActivityEntry[];
}

/** Every store key a private cookie could be logged under. */
const PRIVATE_STORE_KEYS = ["firefox-private", "private", "1"];

let session: FirefoxSession;
let fixture: FixtureServer;

/** Cookie names Firefox holds for host in private browsing. */
const privateCookieNames = async (host: string): Promise<string[]> =>
  (await inChrome(
    session,
    `return Services.cookies
       .getCookiesFromHost(args[0], { privateBrowsingId: 1 })
       .map((c) => c.name);`,
    host
  )) as string[];

const hasPrivateFixtureCookies = async (host: string): Promise<boolean> => {
  const names = await privateCookieNames(host);
  return names.includes("e2e_header") && names.includes("e2e_js");
};

const hasNoPrivateFixtureCookies = async (host: string): Promise<boolean> =>
  !(await privateCookieNames(host)).some((n) => n.startsWith("e2e_"));

const normalCookieNames = async (domain: string): Promise<string[]> =>
  (
    (await probe(session, {
      kind: "getAllCookies",
      details: {
        firstPartyDomain: null,
        partitionKey: {},
        storeId: "firefox-default",
        domain,
      },
    })) as { name: string }[]
  ).map((c) => c.name);

const persistedState = async (): Promise<PersistedState> =>
  (await probe(session, { kind: "getState" })) as PersistedState;

const applySettings = async (
  settings: Record<string, unknown>
): Promise<void> => {
  const applied = (await probe(session, {
    kind: "updateSettings",
    settings,
  })) as Record<string, unknown>;
  for (const [name, value] of Object.entries(settings)) {
    if (applied[name] !== value) {
      throw new Error(`settings not applied: ${JSON.stringify(applied)}`);
    }
  }
};

const incognitoAccess = async (): Promise<boolean> =>
  (await inProbe(
    session,
    "return browser.extension.isAllowedIncognitoAccess();"
  )) as boolean;

/**
 * Whether an activity-log entry names host anywhere, or logs any private
 * store at all. Exact comparisons on purpose: CodeQL reads includes() with
 * a host-like literal as URL substring checking.
 */
const entryLeaksPrivate = (entry: ActivityEntry, host: string): boolean =>
  Object.keys(entry.storeIds ?? {}).some((key) =>
    PRIVATE_STORE_KEYS.some((p) => p === key)
  ) ||
  Object.values(entry.storeIds ?? {}).some((cleaned) =>
    cleaned.some((o) => o.cookie.hostname === host)
  ) ||
  Object.values(entry.browsingDataCleanup ?? {}).some((hosts) =>
    (hosts ?? []).some((h) => h === host)
  );

beforeAll(async () => {
  fixture = await startFixtureServer();
}, 30000);

afterAll(async () => {
  stopGeckodriver();
  await fixture?.stop();
});

describe("row 11: private windows, access on", () => {
  let privateWindowId: number;

  /** Opens url in the private window and waits for it to load. */
  const openPrivateTab = async (url: string): Promise<number> =>
    (await inProbe(
      session,
      `const tab = await browser.tabs.create({
         windowId: args[0],
         url: args[1],
         active: false,
       });
       const deadline = Date.now() + 15000;
       for (;;) {
         const current = await browser.tabs.get(tab.id);
         if (current.status === "complete" && current.url === args[1]) {
           return tab.id;
         }
         if (Date.now() > deadline) throw new Error("private tab did not load: " + args[1]);
         await new Promise((r) => setTimeout(r, 200));
       }`,
      privateWindowId,
      url
    )) as number;

  const closePrivateTab = async (tabId: number): Promise<void> => {
    await probe(session, { kind: "closeTabById", tabId });
  };

  beforeAll(async () => {
    session = await launchFirefox({}, { allowPrivateBrowsing: true });
    if (!(await incognitoAccess())) {
      throw new Error("the add-on was installed without private access");
    }
    await applySettings({ activeMode: true, delayBeforeClean: 1 });
    // The Private list, where the popup keeps a site for a private tab
    // (firefox-private, sanitized to "private" like the popup's write).
    await probe(session, {
      kind: "dispatch",
      action: {
        type: "ADD_EXPRESSION",
        payload: {
          expression: "localhost",
          listType: "WHITE",
          storeId: "firefox-private",
        },
      },
    });
    const kept = await waitUntil(async () =>
      ((await persistedState()).lists?.private ?? []).some(
        (e) => e.expression === "localhost" && e.listType === "WHITE"
      )
    );
    if (!kept) throw new Error("localhost never reached the Private list");
    await probe(session, {
      kind: "dispatch",
      action: { type: "CLEAR_ACTIVITY_LOG" },
    });
    const emptied = await waitUntil(
      async () => ((await persistedState()).activityLog ?? []).length === 0
    );
    if (!emptied) throw new Error("activity log was not cleared");
    privateWindowId = (await inProbe(
      session,
      `const w = await browser.windows.create({ incognito: true, url: "about:blank" });
       return w.id;`
    )) as number;
    await tapBackgroundConsoleErrors(session);
  }, 120000);

  afterAll(async () => {
    await session?.quit();
  });

  it("keeps the Private list's site, cleans the others, and logs no private domain", async () => {
    // Two rounds of open, close and clean: the kept site's private cookies
    // must survive both, the unkept site's must go each time.
    for (let round = 1; round <= 2; round++) {
      const tabs = [
        await openPrivateTab(`${fixture.primary}/cookies`),
        await openPrivateTab(`${fixture.thirdParty}/cookies`),
      ];
      try {
        const appeared = await waitUntil(
          async () =>
            (await hasPrivateFixtureCookies("localhost")) &&
            (await hasPrivateFixtureCookies("127.0.0.1")),
          15000
        );
        expect(appeared, `round ${round}: private cookies set`).toBe(true);
      } finally {
        for (const tabId of tabs) await closePrivateTab(tabId);
      }

      const cleaned = await waitUntil(
        () => hasNoPrivateFixtureCookies("127.0.0.1"),
        45000
      );
      if (!cleaned) {
        console.log(
          "row11 diagnostics:",
          JSON.stringify(await probe(session, { kind: "diagnostics" }))
        );
      }
      expect(cleaned, `round ${round}: unkept private site cleaned`).toBe(true);
      expect(
        await hasPrivateFixtureCookies("localhost"),
        `round ${round}: kept private site survived`
      ).toBe(true);
    }

    // Every private store is scrubbed from a cleanup's results, and a
    // cleanup left with nothing to show adds no entry at all, so these
    // private-only cleanups should leave the log empty. 127.0.0.1 was only
    // ever visited in the private window: any mention of it is a private
    // domain leaking. Read past the persist debounce, so every cleanup
    // above is in the stored copy.
    await new Promise((r) => setTimeout(r, 2000));
    const log = (await persistedState()).activityLog ?? [];
    const leaks = log.filter((e) => entryLeaksPrivate(e, "127.0.0.1"));
    expect(leaks, JSON.stringify(leaks)).toEqual([]);

    expect(await extensionScriptErrors(session)).toEqual([]);
    expect(await backgroundConsoleErrors(session)).toEqual([]);
  }, 180000);

  it("erases the Private list when the last private window closes (#468)", async () => {
    // Still there while the private session lasts.
    expect(
      ((await persistedState()).lists?.private ?? []).some(
        (e) => e.expression === "localhost"
      )
    ).toBe(true);
    await inProbe(
      session,
      "await browser.windows.remove(args[0]);",
      privateWindowId
    );
    // Read from storage, past the save debounce: the stored settings must
    // keep no record of the private session once it ends.
    const erased = await waitUntil(
      async () => ((await persistedState()).lists?.private ?? []).length === 0,
      15000
    );
    expect(erased, "Private list erased from storage").toBe(true);
    expect(await extensionScriptErrors(session)).toEqual([]);
    expect(await backgroundConsoleErrors(session)).toEqual([]);
  }, 60000);
});

describe("row 12: private windows, access off", () => {
  beforeAll(async () => {
    session = await launchFirefox();
    if (await incognitoAccess()) {
      throw new Error("the add-on was installed with private access");
    }
    await applySettings({ activeMode: true, delayBeforeClean: 1 });
    await tapBackgroundConsoleErrors(session);
  }, 120000);

  afterAll(async () => {
    await session?.quit();
  });

  it("leaves private cookies alone, raises no errors, and still cleans normal windows", async () => {
    const { driver } = session;
    // Without private access the extension cannot open a private window,
    // so Firefox's own window opener does it, like File > New Private
    // Window.
    const before = new Set(await driver.getAllWindowHandles());
    const opened = (await inChrome(
      session,
      `const w = OpenBrowserWindow({ private: true });
       return PrivateBrowsingUtils.isWindowPrivate(w);`
    )) as boolean;
    expect(opened).toBe(true);
    let privateAnchor: string | undefined;
    await waitUntil(async () => {
      privateAnchor = (await driver.getAllWindowHandles()).find(
        (h) => !before.has(h)
      );
      return privateAnchor !== undefined;
    }, 10000);
    if (!privateAnchor) throw new Error("the private window never appeared");

    // A second tab in the private window visits the site and closes; the
    // window's first tab stays, so Firefox keeps its private cookies.
    await driver.switchTo().window(privateAnchor);
    await driver.switchTo().newWindow("tab");
    await driver.get(`${fixture.thirdParty}/cookies`);
    const privateTab = await driver.getWindowHandle();
    try {
      const appeared = await waitUntil(
        () => hasPrivateFixtureCookies("127.0.0.1"),
        15000
      );
      expect(appeared).toBe(true);
    } finally {
      await closeTab(session, privateTab);
    }

    // A normal-window visit and close: its cleanup runs after the private
    // visit, over every store the extension may touch.
    const normalTab = await openTab(session, `${fixture.primary}/cookies`);
    try {
      const appeared = await waitUntil(async () => {
        const names = await normalCookieNames("localhost");
        return names.includes("e2e_header") && names.includes("e2e_js");
      }, 15000);
      expect(appeared).toBe(true);
    } finally {
      await closeTab(session, normalTab);
    }
    const normalCleaned = await waitUntil(
      async () =>
        !(await normalCookieNames("localhost")).some((n) =>
          n.startsWith("e2e_")
        ),
      45000
    );
    expect(normalCleaned).toBe(true);

    // The unkept private cookies are still there: nothing reached into
    // the private store.
    expect(await hasPrivateFixtureCookies("127.0.0.1")).toBe(true);
    expect(await extensionScriptErrors(session)).toEqual([]);
    expect(await backgroundConsoleErrors(session)).toEqual([]);
  }, 120000);
});
