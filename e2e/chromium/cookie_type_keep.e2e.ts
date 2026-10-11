/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * After a site's storage is cleaned, Chromium's `cookies` removal type
 * clears a record Edge keeps per host (#464). That removal clears cookies
 * for the whole registrable domain, so it must not run while the site
 * still has a kept cookie.
 *
 * The keep rule `keep.adcp.test` keeps one cookie on that host only. The
 * www. page's tab closes, so the cleanup removes the site's other cookies
 * and cleans www.'s storage. The kept cookie must still be there.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ChromeSession,
  cookiesFor,
  dispatch,
  ProbeCookie,
  readOriginStorage,
  storeState,
  waitFor,
} from "../helpers/chrome_cdp";
import { SITE, SITE_COOKIE, SITE_HOSTS } from "../helpers/chromium_fixture";
import {
  ChromiumRun,
  closeTabsAndAwaitCleanup,
  openReadyTabs,
  startChromiumRun,
} from "../helpers/chromium_scenario";

const KEPT_HOST = `keep.${SITE}`;
const KEPT_COOKIE = "kept";

let run: ChromiumRun | undefined;
let cookiesBefore: ProbeCookie[] = [];
let cookiesAfter: ProbeCookie[] = [];
let cleanupLogged = false;
let lastLogEntry = "";

/** The keep rules of the regular store. */
const keepRules = async (session: ChromeSession): Promise<string[]> => {
  const state = await storeState<{
    lists: Record<string, { expression: string; listType: string }[]>;
  }>(session);
  return (state.lists.default ?? [])
    .filter((rule) => rule.listType === "WHITE")
    .map((rule) => rule.expression);
};

beforeAll(async () => {
  run = await startChromiumRun();
  const { session } = run;
  await dispatch(session, {
    type: "ADD_EXPRESSION",
    payload: { expression: KEPT_HOST, listType: "WHITE", storeId: "default" },
  });
  const added = await waitFor(
    async () => (await keepRules(session)).includes(KEPT_HOST),
    10000
  );
  if (!added) throw new Error(`keep rule ${KEPT_HOST} was not added`);

  await session.probeEval(
    `chrome.cookies.set({ url: "http://${KEPT_HOST}/", name: "${KEPT_COOKIE}", value: "1" }).then(() => true)`
  );
  const tabs = await openReadyTabs(session, [`http://${SITE_HOSTS.page}/site`]);
  cookiesBefore = await cookiesFor(session, SITE);
  cleanupLogged = await closeTabsAndAwaitCleanup(session, tabs);
  cookiesAfter = await cookiesFor(session, SITE);
  const state = await storeState<{ activityLog?: unknown[] }>(session);
  lastLogEntry = JSON.stringify(state.activityLog?.[0] ?? null);
}, 180000);

afterAll(async () => {
  await run?.stop();
});

describe("Chromium: cookie-type site data next to a kept cookie", () => {
  it("has the kept cookie and the site's own cookie before the cleanup", () => {
    expect(cookiesBefore).toEqual(
      expect.arrayContaining([
        { name: KEPT_COOKIE, domain: KEPT_HOST },
        expect.objectContaining({ name: SITE_COOKIE }),
      ])
    );
  });

  it("runs a cleanup and logs it", () => {
    expect(cleanupLogged).toBe(true);
  });

  it("removes the site's other cookies and keeps the kept one", () => {
    expect(cookiesAfter, lastLogEntry).toEqual([
      { name: KEPT_COOKIE, domain: KEPT_HOST },
    ]);
  });

  it("still empties the storage of the page's host", async () => {
    const origin = `http://${SITE_HOSTS.page}`;
    expect(await readOriginStorage(run!.session, origin), lastLogEntry).toEqual(
      { origin, localStorage: [], indexedDB: [], cacheStorage: [] }
    );
  }, 60000);
});
