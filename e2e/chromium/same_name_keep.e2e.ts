/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * Removing a cookie must not take a kept cookie with the same name. Chrome's
 * cookies.remove matches by url and name, and deletes every same-name
 * cookie the url would be sent, a parent domain's included. A non-Secure
 * cookie is removed through http:// first, which never reaches a Secure
 * cookie; the https:// url (for scheme-bound cookies, #464) is only tried
 * while the exact cookie is still stored, so on Chrome's defaults it never
 * runs.
 *
 * The keep rule `adcp.test` keeps the parent domain's cookies but not
 * shop.adcp.test's. Both hosts get a `sid` cookie: a Secure one on
 * .adcp.test, a non-Secure host-only one on shop.adcp.test. A tab of a
 * second site closes to start the cleanup. shop.'s `sid` must go and the
 * parent domain's must stay.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ChromeSession,
  cookiesFor,
  dispatch,
  ProbeCookie,
  storeState,
  waitFor,
} from "../helpers/chrome_cdp";
import { OTHER_SITE_HOSTS, SITE } from "../helpers/chromium_fixture";
import {
  ChromiumRun,
  closeTabsAndAwaitCleanup,
  openReadyTabs,
  startChromiumRun,
} from "../helpers/chromium_scenario";

const KEEP_RULE = SITE;
const SHOP_HOST = `shop.${SITE}`;

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
    payload: { expression: KEEP_RULE, listType: "WHITE", storeId: "default" },
  });
  const added = await waitFor(
    async () => (await keepRules(session)).includes(KEEP_RULE),
    10000
  );
  if (!added) throw new Error(`keep rule ${KEEP_RULE} was not added`);

  const tabs = await openReadyTabs(session, [
    `http://${OTHER_SITE_HOSTS.page}/site`,
  ]);
  await session.probeEval(
    `Promise.all([
      chrome.cookies.set({ url: "http://${SHOP_HOST}/", name: "sid", value: "drop" }),
      chrome.cookies.set({ url: "https://${SITE}/", domain: "${SITE}", name: "sid", value: "keep", secure: true }),
    ]).then(() => true)`
  );
  cookiesBefore = await cookiesFor(session, SITE);
  cleanupLogged = await closeTabsAndAwaitCleanup(session, tabs);
  cookiesAfter = await cookiesFor(session, SITE);
  const state = await storeState<{ activityLog?: unknown[] }>(session);
  lastLogEntry = JSON.stringify(state.activityLog?.[0] ?? null);
}, 180000);

afterAll(async () => {
  await run?.stop();
});

describe("Chromium: a kept cookie with the same name as a removed one", () => {
  it("plants both sid cookies", () => {
    expect(cookiesBefore).toEqual(
      expect.arrayContaining([
        { name: "sid", domain: SHOP_HOST },
        { name: "sid", domain: `.${SITE}` },
      ])
    );
  });

  it("runs a cleanup and logs it", () => {
    expect(cleanupLogged).toBe(true);
  });

  it("removes shop.'s sid and keeps the parent domain's", () => {
    const sids = cookiesAfter.filter((c) => c.name === "sid");
    expect(sids, lastLogEntry).toEqual([{ name: "sid", domain: `.${SITE}` }]);
  });
});
