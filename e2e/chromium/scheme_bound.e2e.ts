/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * Cookies without the Secure attribute that an https page set, with
 * Chrome's scheme-bound cookies on (#464 on Edge). Such a cookie used to be
 * removed through an http:// url, which no longer matches a cookie bound
 * to https: the removal quietly did nothing and the cleanup log still
 * counted it. On eBay that left the extension's own marker cookie and
 * every non-Secure eBay cookie behind.
 *
 * The fixture serves plain http, so the specs set the https cookies
 * through chrome.cookies, the way an https page's Set-Cookie lands: one
 * host-only cookie on the page's host and one on the parent domain. Both
 * must be gone once the site's tabs close and the cleanup has run.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cookiesFor, ProbeCookie, storeState } from "../helpers/chrome_cdp";
import { SITE, SITE_COOKIE, SITE_HOSTS } from "../helpers/chromium_fixture";
import {
  ChromiumRun,
  closeTabsAndAwaitCleanup,
  openReadyTabs,
  startChromiumRun,
} from "../helpers/chromium_scenario";

const HOST_COOKIE = "https_host_only";
const DOMAIN_COOKIE = "https_parent_domain";

let run: ChromiumRun | undefined;
let planted: { name: string; secure: boolean }[] = [];
let cookiesBefore: ProbeCookie[] = [];
let cookiesAfter: ProbeCookie[] = [];
let cleanupLogged = false;
let lastLogEntry = "";

beforeAll(async () => {
  run = await startChromiumRun({
    enableFeatures: ["EnableSchemeBoundCookies"],
  });
  const { session } = run;
  const tabs = await openReadyTabs(session, [`http://${SITE_HOSTS.page}/site`]);
  planted = await session.probeEval(
    `Promise.all([
      chrome.cookies.set({ url: "https://${SITE_HOSTS.page}/", name: "${HOST_COOKIE}", value: "1" }),
      chrome.cookies.set({ url: "https://${SITE_HOSTS.page}/", domain: "${SITE}", name: "${DOMAIN_COOKIE}", value: "1" }),
    ]).then((cs) => cs.map((c) => ({ name: c.name, secure: c.secure })))`
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

describe("Chromium with scheme-bound cookies: closing a site's tabs", () => {
  it("plants non-Secure cookies from an https url", () => {
    expect(planted).toEqual([
      { name: HOST_COOKIE, secure: false },
      { name: DOMAIN_COOKIE, secure: false },
    ]);
    expect(cookiesBefore.map((c) => c.name)).toEqual(
      expect.arrayContaining([SITE_COOKIE, HOST_COOKIE, DOMAIN_COOKIE])
    );
  });

  it("runs a cleanup and logs it", () => {
    expect(cleanupLogged).toBe(true);
  });

  it("removes every cookie of the site, the marker included", () => {
    expect(cookiesAfter, lastLogEntry).toEqual([]);
  });
});
