/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * What site-data cleanup leaves behind in Chrome, with the default
 * site-data settings (#473). The Chromium counterpart of the Firefox rows
 * 13 and 21 (docs/testing-firefox.md), which can only assert the cleanup
 * log: here the fixture origins carry no port, so Chrome really clears
 * them, and the specs read the storage itself afterwards.
 *
 * A www. page sets its cookie on the parent domain and embeds a same-site
 * devicebind. frame (#464); a signin. page opens in a tab of its own and
 * sets no cookie. All three origins write a localStorage entry, an
 * IndexedDB database and a Cache Storage cache. Once both tabs close and
 * the cleanup has run, every one of them must be empty, and the site's
 * cookies gone.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  cookiesFor,
  ProbeCookie,
  readOriginStorage,
  storeState,
} from "../helpers/chrome_cdp";
import { SITE, SITE_COOKIE, SITE_HOSTS } from "../helpers/chromium_fixture";
import {
  ChromiumRun,
  closeTabsAndAwaitCleanup,
  openReadyTabs,
  startChromiumRun,
} from "../helpers/chromium_scenario";

let run: ChromiumRun | undefined;
let cookiesBefore: ProbeCookie[] = [];
let cookiesAfter: ProbeCookie[] = [];
let cleanupLogged = false;
let lastLogEntry = "";

beforeAll(async () => {
  run = await startChromiumRun();
  const { session } = run;
  const tabs = await openReadyTabs(session, [
    `http://${SITE_HOSTS.page}/site`,
    `http://${SITE_HOSTS.tab}/tab`,
  ]);
  cookiesBefore = await cookiesFor(session, SITE);
  cleanupLogged = await closeTabsAndAwaitCleanup(session, tabs);
  // Read the cookies before any storage check: each check opens a page on
  // the origin it reads, and the extension marks that page's host.
  cookiesAfter = await cookiesFor(session, SITE);
  const state = await storeState<{ activityLog?: unknown[] }>(session);
  lastLogEntry = JSON.stringify(state.activityLog?.[0] ?? null);
}, 180000);

afterAll(async () => {
  await run?.stop();
});

describe("Chromium: closing a site's tabs with default site-data settings", () => {
  it("runs a cleanup and logs it", () => {
    expect(cleanupLogged).toBe(true);
  });

  it("removes the site's cookies", () => {
    expect(cookiesBefore.map((c) => c.name)).toContain(SITE_COOKIE);
    expect(cookiesAfter, lastLogEntry).toEqual([]);
  });

  it.each([
    ["the top-level host", SITE_HOSTS.page],
    ["the same-site frame host (#464)", SITE_HOSTS.frame],
    ["a separate subdomain tab's host", SITE_HOSTS.tab],
  ])(
    "empties the storage of %s (%s)",
    async (_label, host) => {
      const origin = `http://${host}`;
      expect(
        await readOriginStorage(run!.session, origin),
        `cleanup log: ${lastLogEntry}`
      ).toEqual({
        origin,
        localStorage: [],
        indexedDB: [],
        cacheStorage: [],
      });
    },
    60000
  );
});
