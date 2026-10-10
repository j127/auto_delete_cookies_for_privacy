/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * The cleanup log counts only cookies that are really gone (#464).
 *
 * With Chrome's EnableSchemeBoundCookies feature on, a cookie is keyed by
 * the scheme that set it, and chrome.cookies.remove resolves with its
 * details even when no cookie matched. The cleanup removes a cookie that
 * lacks the Secure flag through an http:// URL, so the same cookie set
 * over https is missed, and the log used to count it as removed anyway:
 * one run logged 29 cookies while 20 of them were still there.
 *
 * The probe sets such cookies on a host no tab has open, next to their
 * http twins and a plain cookie, and a fixture site's tab opens and
 * closes to start a cleanup. Whatever the cleanup manages to remove, the
 * cookies its log entry lists must be exactly the ones that went.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ChromeSession, storeState } from "../helpers/chrome_cdp";
import { OTHER_SITE_HOSTS } from "../helpers/chromium_fixture";
import {
  ChromiumRun,
  closeTabsAndAwaitCleanup,
  openReadyTabs,
  startChromiumRun,
} from "../helpers/chromium_scenario";

/** A host no tab opens, so nothing keeps its cookies. */
const BOUND_HOST = "bound.scheme.test";

/** The extension's own marker cookie, removed but never counted. */
const MARKER_COOKIE = "ADCPBrowsingDataCleanup";

/** The cookies the probe sets: name, and the scheme that sets it. */
const SET_COOKIES: { name: string; scheme: "http" | "https" }[] = [
  // Twins, one per scheme: removing through http:// reaches one of them.
  { name: "adcp_bound", scheme: "https" },
  { name: "adcp_bound", scheme: "http" },
  // Set over https only: removing through http:// misses it.
  { name: "adcp_https_only", scheme: "https" },
  { name: "adcp_plain", scheme: "http" },
];

interface ListedCookie {
  name: string;
  domain: string;
  path: string;
  partitionKey?: { topLevelSite?: string };
}

/** What the cookies API shows of a cookie's identity. */
const keyOf = (c: ListedCookie): string =>
  [c.name, c.domain, c.path, c.partitionKey?.topLevelSite ?? ""].join("|");

/** Every cookie of the regular store, partitioned ones too. */
const allCookies = (session: ChromeSession): Promise<ListedCookie[]> =>
  session.probeEval<ListedCookie[]>(
    `chrome.cookies.getAll({ partitionKey: {} }).then((cs) =>
      cs.map(({ name, domain, path, partitionKey }) =>
        ({ name, domain, path, partitionKey })))`
  );

/** before minus after, as a multiset of keys, sorted. */
const goneKeys = (before: ListedCookie[], after: ListedCookie[]): string[] => {
  const left = after.map(keyOf);
  const gone: string[] = [];
  for (const key of before.map(keyOf)) {
    const i = left.indexOf(key);
    if (i === -1) gone.push(key);
    else left.splice(i, 1);
  }
  return gone.sort();
};

const notMarker = (c: ListedCookie): boolean => c.name !== MARKER_COOKIE;

let run: ChromiumRun | undefined;
let boundTwinsListed = 0;
let before: ListedCookie[] = [];
let after: ListedCookie[] = [];
let cleanupLogged = false;
let logEntry:
  | {
      recentlyCleaned: number;
      storeIds: Record<string, { cookie: ListedCookie }[]>;
    }
  | undefined;

beforeAll(async () => {
  run = await startChromiumRun({
    enableFeatures: ["EnableSchemeBoundCookies"],
  });
  const { session } = run;
  for (const { name, scheme } of SET_COOKIES) {
    const set = await session.probeEval<boolean>(
      `chrome.cookies.set(${JSON.stringify({
        url: `${scheme}://${BOUND_HOST}/`,
        name,
        value: scheme,
        expirationDate: Math.floor(Date.now() / 1000) + 86400,
      })}).then((c) => Boolean(c))`
    );
    if (!set) throw new Error(`could not set ${name} over ${scheme}`);
  }
  boundTwinsListed = (await allCookies(session)).filter(
    (c) => c.name === "adcp_bound"
  ).length;

  const tabs = await openReadyTabs(session, [
    `http://${OTHER_SITE_HOSTS.page}/site`,
  ]);
  before = (await allCookies(session)).filter(notMarker);
  cleanupLogged = await closeTabsAndAwaitCleanup(session, tabs);
  after = (await allCookies(session)).filter(notMarker);
  const state = await storeState<{ activityLog?: (typeof logEntry)[] }>(
    session
  );
  logEntry = state.activityLog?.[0];
}, 180000);

afterAll(async () => {
  await run?.stop();
});

describe("Chromium with scheme-bound cookies: the cleanup log", () => {
  it("runs with scheme binding on, so the twins are two cookies", () => {
    expect(boundTwinsListed).toBe(2);
  });

  it("logs a cleanup that removed something", () => {
    expect(cleanupLogged).toBe(true);
    expect(logEntry).toBeDefined();
    expect(goneKeys(before, after).length).toBeGreaterThan(0);
  });

  it("counts exactly the cookies that are gone", () => {
    const gone = goneKeys(before, after);
    const context = JSON.stringify({ gone, left: after.map(keyOf) });
    expect(logEntry?.recentlyCleaned, context).toBe(gone.length);
    const logged = Object.values(logEntry?.storeIds ?? {})
      .flat()
      .map((o) => keyOf(o.cookie))
      .sort();
    expect(logged, context).toEqual(gone);
  });
});
