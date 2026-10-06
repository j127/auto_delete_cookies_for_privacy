/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * A keep rule keeps a site's storage in Chrome (#473). Since #464 the
 * cleanup reaches the storage of every host of a site, so a keep rule has
 * to cover those hosts too: `*.adcp.test`, the rule the popup's "Keep
 * cookies for this site" button adds, keeps the storage of www., its
 * devicebind. frame and the signin. tab, with the site's cookies.
 *
 * A second site without a rule opens and closes alongside, and its tab
 * closes last, so the cleanup it starts runs after every kept tab is gone;
 * its own storage must be empty, which shows the cleanup ran.
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
import {
  OTHER_SITE,
  OTHER_SITE_HOSTS,
  SITE,
  SITE_COOKIE,
  SITE_HOSTS,
  STORAGE_NAMES,
} from "../helpers/chromium_fixture";
import {
  ChromiumRun,
  closeTabsAndAwaitCleanup,
  openReadyTabs,
  startChromiumRun,
} from "../helpers/chromium_scenario";

const KEEP_RULE = `*.${SITE}`;

let run: ChromiumRun | undefined;
let keptCookies: ProbeCookie[] = [];
let otherCookiesBefore: ProbeCookie[] = [];
let otherCookiesAfter: ProbeCookie[] = [];
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
  // The same action the popup and the settings page send.
  await dispatch(session, {
    type: "ADD_EXPRESSION",
    payload: { expression: KEEP_RULE, listType: "WHITE", storeId: "default" },
  });
  const added = await waitFor(
    async () => (await keepRules(session)).includes(KEEP_RULE),
    10000
  );
  if (!added) throw new Error(`keep rule ${KEEP_RULE} was not added`);

  const tabs = await openReadyTabs(session, [
    `http://${SITE_HOSTS.page}/site`,
    `http://${SITE_HOSTS.tab}/tab`,
    `http://${OTHER_SITE_HOSTS.page}/site`,
  ]);
  otherCookiesBefore = await cookiesFor(session, OTHER_SITE);
  cleanupLogged = await closeTabsAndAwaitCleanup(session, tabs);
  // Before any storage check, which opens pages on the origins it reads.
  keptCookies = await cookiesFor(session, SITE);
  otherCookiesAfter = await cookiesFor(session, OTHER_SITE);
  const state = await storeState<{ activityLog?: unknown[] }>(session);
  lastLogEntry = JSON.stringify(state.activityLog?.[0] ?? null);
}, 180000);

afterAll(async () => {
  await run?.stop();
});

describe(`Chromium: a keep rule ${KEEP_RULE}`, () => {
  it("lets the cleanup run on the site without a rule", async () => {
    expect(cleanupLogged).toBe(true);
    expect(otherCookiesBefore.map((c) => c.name)).toContain(SITE_COOKIE);
    expect(otherCookiesAfter, lastLogEntry).toEqual([]);
    const origin = `http://${OTHER_SITE_HOSTS.page}`;
    expect(await readOriginStorage(run!.session, origin)).toEqual({
      origin,
      localStorage: [],
      indexedDB: [],
      cacheStorage: [],
    });
  }, 60000);

  it("keeps the site's cookies", () => {
    expect(
      keptCookies.map((c) => c.name),
      lastLogEntry
    ).toContain(SITE_COOKIE);
  });

  it.each([
    ["the top-level host", SITE_HOSTS.page],
    ["the same-site frame host", SITE_HOSTS.frame],
    ["a separate subdomain tab's host", SITE_HOSTS.tab],
  ])(
    "keeps the storage of %s (%s)",
    async (_label, host) => {
      const origin = `http://${host}`;
      expect(
        await readOriginStorage(run!.session, origin),
        `cleanup log: ${lastLogEntry}`
      ).toEqual({
        origin,
        localStorage: [STORAGE_NAMES.localStorage],
        indexedDB: [STORAGE_NAMES.indexedDB],
        cacheStorage: [STORAGE_NAMES.cacheStorage],
      });
    },
    60000
  );
});
