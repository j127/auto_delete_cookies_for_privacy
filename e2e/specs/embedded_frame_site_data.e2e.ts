/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * Matrix row 22: storage a cross-site frame keeps is cleaned once the site
 * that embeds it is closed (issue #504: the localStorage of a YouTube
 * player in a Reddit page stayed for good). Firefox clears storage by
 * host and only for the hosts it is given, and a frame host without a
 * cookie of its own was never among them. The extension now gives it a
 * marker cookie in the partition of the embedding site.
 *
 * Clearing by host empties that host everywhere, so the wipe waits while
 * another open site still embeds the same frame host; the second spec
 * closes one of two embedding sites and checks the other's frame.
 *
 * Firefox can limit a localStorage wipe to one container, so a container
 * that keeps the frame host keeps its storage there only: the third spec
 * checks that the wipe still reaches the frame outside that container
 * (the #504 report on 1.2.2: a YouTube rule in one container).
 *
 * Unlike rows 13 and 21, this row reads the storage itself. Gecko's wipe
 * skips origins that carry a port, so the session reaches the fixture
 * server through Firefox's proxy prefs: three port-less .test sites, two
 * pages embedding the same cookie-less frame. Each frame load notes on its
 * body whether its localStorage entry was already there.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  closeTab,
  FirefoxSession,
  launchFirefox,
  openTab,
  probe,
  stopGeckodriver,
  waitUntil,
} from "../helpers/firefox_driver";
import {
  EMBED_HOSTS,
  FixtureServer,
  proxyPrefs,
  startFixtureServer,
} from "../helpers/fixture_server";

const MARKER = "ADCPBrowsingDataCleanup";
const PAGE = `http://${EMBED_HOSTS.page}/embedder`;
const OTHER_PAGE = `http://${EMBED_HOSTS.otherPage}/embedder`;

interface ProbeCookie {
  name: string;
  domain: string;
  partitionKey?: { topLevelSite?: string } | null;
}

let session: FirefoxSession;
let fixture: FixtureServer;

const cookiesFor = async (domain: string): Promise<ProbeCookie[]> =>
  (await probe(session, {
    kind: "getAllCookies",
    details: { firstPartyDomain: null, partitionKey: {}, domain },
  })) as ProbeCookie[];

/** The top-level sites the frame host holds a partitioned marker under. */
const frameMarkerSites = async (): Promise<string[]> =>
  (await cookiesFor(EMBED_HOSTS.frame))
    .filter((c) => c.name === MARKER && c.partitionKey?.topLevelSite)
    .map((c) => String(c.partitionKey?.topLevelSite))
    .sort();

const hasSiteCookie = async (pageHost: string): Promise<boolean> =>
  (await cookiesFor(pageHost.replace(/^www\./, ""))).some(
    (c) => c.name === "e2e_site"
  );

/**
 * Whether the frame of the tab found its localStorage entry when it last
 * loaded: "true" or "false", or null while the frame has not run yet.
 */
const frameHadStorage = async (tab: string): Promise<string | null> => {
  const { driver } = session;
  await driver.switchTo().window(tab);
  let had: string | null = null;
  await waitUntil(async () => {
    try {
      await driver.switchTo().defaultContent();
      await driver.switchTo().frame(0);
      had = (await driver.executeScript(
        "return document.body && document.body.dataset.had || null;"
      )) as string | null;
    } catch {
      had = null;
    }
    return had !== null;
  }, 15000);
  await driver.switchTo().defaultContent();
  return had;
};

/**
 * Opens the frame host's own page in a tab of the container and returns
 * whether its localStorage entry was already there ("true"/"false"), then
 * closes the tab. Webdriver cannot pick a container for a tab, so the
 * probe page opens it and reads it through the scripting API.
 */
const containerFrameHad = async (
  cookieStoreId: string
): Promise<string | null> => {
  const { driver, probeHandle } = session;
  await driver.switchTo().window(probeHandle);
  return (await driver.executeAsyncScript(
    `
    const [url, cookieStoreId, done] = arguments;
    (async () => {
      const tab = await browser.tabs.create({ active: false, cookieStoreId, url });
      try {
        const deadline = Date.now() + 15000;
        for (;;) {
          const [result] = await browser.scripting
            .executeScript({
              target: { tabId: tab.id },
              func: () => (document.body && document.body.dataset.had) || null,
            })
            .catch(() => [{ result: null }]);
          if (result && result.result) return result.result;
          if (Date.now() > deadline) return null;
          await new Promise((r) => setTimeout(r, 200));
        }
      } finally {
        await browser.tabs.remove(tab.id);
      }
    })().then(done, (e) => done("error: " + e));
    `,
    `http://${EMBED_HOSTS.frame}/embedded-storage`,
    cookieStoreId
  )) as string | null;
};

/** How many cleanup log entries list the frame host's localStorage. */
const frameWipesLogged = async (): Promise<number> => {
  const state = (await probe(session, { kind: "getState" })) as {
    activityLog?: { browsingDataCleanup?: { LocalStorage?: string[] } }[];
  };
  return (state.activityLog ?? []).filter((entry) =>
    (entry.browsingDataCleanup?.LocalStorage ?? []).includes(EMBED_HOSTS.frame)
  ).length;
};

beforeAll(async () => {
  fixture = await startFixtureServer();
  session = await launchFirefox(proxyPrefs(fixture.port));
  const applied = (await probe(session, {
    kind: "updateSettings",
    settings: { activeMode: true, delayBeforeClean: 1, statLogging: true },
  })) as { activeMode?: unknown };
  if (applied.activeMode !== true) {
    throw new Error(`settings not applied: ${JSON.stringify(applied)}`);
  }
}, 120000);

afterAll(async () => {
  await session?.quit();
  stopGeckodriver();
  await fixture?.stop();
});

describe("row 22: cross-site frame site data", () => {
  it("clears a cookie-less cross-site frame's storage after the embedding site closes", async () => {
    let tab = await openTab(session, PAGE);
    try {
      expect(await frameHadStorage(tab)).toBe("false");
      // The frame host's marker sits in the embedding site's partition,
      // and it has none of its own.
      const marked = await waitUntil(
        async () => (await frameMarkerSites()).length === 1,
        15000
      );
      if (!marked) {
        // eslint-disable-next-line no-console
        console.log(
          "row 22 cookies:",
          JSON.stringify(await cookiesFor(EMBED_HOSTS.frame))
        );
      }
      expect(await frameMarkerSites()).toEqual(["http://adcp.test"]);
      expect(
        (await cookiesFor(EMBED_HOSTS.frame)).filter((c) => c.name === MARKER)
      ).toHaveLength(1);
    } finally {
      await closeTab(session, tab);
    }

    expect(
      await waitUntil(async () => (await frameWipesLogged()) === 1, 45000)
    ).toBe(true);
    expect(await frameMarkerSites()).toEqual([]);

    // The report's last step: back on the page, the entry must be gone.
    tab = await openTab(session, PAGE);
    try {
      expect(await frameHadStorage(tab)).toBe("false");
    } finally {
      await closeTab(session, tab);
    }
    // Leave nothing behind for the next spec.
    expect(
      await waitUntil(async () => (await frameWipesLogged()) === 2, 45000)
    ).toBe(true);
  }, 180000);

  it("leaves the frame's storage alone while another open site still embeds it", async () => {
    const wipesBefore = await frameWipesLogged();
    const tab = await openTab(session, PAGE);
    const otherTab = await openTab(session, OTHER_PAGE);
    let tabOpen = true;
    let otherTabOpen = true;
    try {
      expect(await frameHadStorage(tab)).toBe("false");
      expect(await frameHadStorage(otherTab)).toBe("false");
      expect(
        await waitUntil(
          async () => (await frameMarkerSites()).length === 2,
          15000
        )
      ).toBe(true);

      // Close the first site; its cleanup removes the site's own cookie.
      await closeTab(session, tab);
      tabOpen = false;
      expect(
        await waitUntil(
          async () => !(await hasSiteCookie(EMBED_HOSTS.page)),
          45000
        )
      ).toBe(true);
      // A wipe would follow the cookie removal within the same cleanup;
      // give its log entry (1 s persist debounce) time to land.
      await new Promise((r) => setTimeout(r, 3000));
      // The frame host is still in use, so nothing wiped it, and the
      // closed site's marker stays to ask again later.
      expect(await frameWipesLogged()).toBe(wipesBefore);
      expect(await frameMarkerSites()).toEqual([
        "http://adcp-news.test",
        "http://adcp.test",
      ]);
      // The still-open site's frame finds its entry after a reload.
      await session.driver.switchTo().window(otherTab);
      await session.driver.navigate().refresh();
      expect(await frameHadStorage(otherTab)).toBe("true");

      // Once the other site closes too, the frame host is wiped.
      await closeTab(session, otherTab);
      otherTabOpen = false;
      expect(
        await waitUntil(
          async () => (await frameWipesLogged()) === wipesBefore + 1,
          45000
        )
      ).toBe(true);
      expect(await frameMarkerSites()).toEqual([]);
    } finally {
      if (tabOpen) await closeTab(session, tab);
      if (otherTabOpen) await closeTab(session, otherTab);
    }

    const again = await openTab(session, PAGE);
    try {
      expect(await frameHadStorage(again)).toBe("false");
    } finally {
      await closeTab(session, again);
    }
  }, 240000);

  it("clears the frame's storage outside a container that keeps the frame host, and keeps it inside", async () => {
    const { cookieStoreId } = (await probe(session, {
      kind: "createContainer",
      name: "Video",
    })) as { cookieStoreId: string };
    expect(cookieStoreId).toMatch(/^firefox-container-/);
    await probe(session, {
      kind: "updateSettings",
      settings: { contextualIdentities: true },
    });
    await probe(session, {
      kind: "dispatch",
      action: {
        type: "ADD_EXPRESSION",
        payload: {
          expression: "*.adcp-embed.test",
          listType: "WHITE",
          storeId: cookieStoreId,
        },
      },
    });
    expect(
      await waitUntil(async () => {
        const state = (await probe(session, { kind: "getState" })) as {
          lists?: Record<string, { expression: string }[]>;
        };
        return (state.lists?.[cookieStoreId] ?? []).some(
          (e) => e.expression === "*.adcp-embed.test"
        );
      }, 15000)
    ).toBe(true);

    // The frame host's own page in the container writes its entry there.
    expect(await containerFrameHad(cookieStoreId)).toBe("false");

    // Outside any container, a site embeds the frame and closes.
    const wipesBefore = await frameWipesLogged();
    const tab = await openTab(session, PAGE);
    try {
      expect(await frameHadStorage(tab)).toBe("false");
      expect(
        await waitUntil(
          async () => (await frameMarkerSites()).length === 1,
          15000
        )
      ).toBe(true);
    } finally {
      await closeTab(session, tab);
    }
    // The container's rule used to keep the frame host out of every wipe.
    expect(
      await waitUntil(
        async () => (await frameWipesLogged()) === wipesBefore + 1,
        45000
      )
    ).toBe(true);

    const again = await openTab(session, PAGE);
    try {
      expect(await frameHadStorage(again)).toBe("false");
    } finally {
      await closeTab(session, again);
    }
    expect(
      await waitUntil(
        async () => (await frameWipesLogged()) === wipesBefore + 2,
        45000
      )
    ).toBe(true);

    // The wipes stayed outside the container.
    expect(await containerFrameHad(cookieStoreId)).toBe("true");
  }, 240000);
});
