/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * A cookie a site sets right after its cleanup is cleaned too. Found while
 * reproducing #464 on ebay.com.au with a 1 s cleanup delay: closing the tab
 * started a cleanup that removed every cookie, then responses to requests
 * still in flight set five .ebay.com.au cookies again within ~5 s, and
 * nothing cleaned them until the next visit.
 *
 * The fixture's /late page sets the site cookie and sends a keepalive
 * request that the server holds. The spec closes the tab, waits for the
 * cleanup that follows, and only then releases the held response, which
 * sets a cookie on the parent domain with no tab of the site open. The
 * extension must schedule another cleanup that removes it.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  cookiesFor,
  ProbeCookie,
  storeState,
  waitFor,
} from "../helpers/chrome_cdp";
import {
  LATE_COOKIE,
  SITE,
  SITE_COOKIE,
  SITE_HOSTS,
} from "../helpers/chromium_fixture";
import {
  ChromiumRun,
  closeTabsAndAwaitCleanup,
  openReadyTabs,
  startChromiumRun,
} from "../helpers/chromium_scenario";

/** An activity log entry: the cookies a cleanup removed, per store. */
interface LogEntry {
  storeIds?: Record<string, { cookie: { name: string } }[]>;
}

const removedNames = (entry: LogEntry): string[] =>
  Object.values(entry.storeIds ?? {}).flatMap((cleaned) =>
    cleaned.map((c) => c.cookie.name)
  );

let run: ChromiumRun | undefined;
let requestHeld = false;
let firstCleanupLogged = false;
let cookiesAfterFirstCleanup: ProbeCookie[] = [];
let lateCookieCleaned = false;
let cookiesAtEnd: ProbeCookie[] = [];
let log: LogEntry[] = [];

beforeAll(async () => {
  run = await startChromiumRun();
  const { fixture, session } = run;
  const tabs = await openReadyTabs(session, [`http://${SITE_HOSTS.page}/late`]);
  requestHeld = Boolean(
    await waitFor(async () => fixture.heldCount() > 0, 10000)
  );
  firstCleanupLogged = await closeTabsAndAwaitCleanup(session, tabs);
  cookiesAfterFirstCleanup = await cookiesFor(session, SITE);

  fixture.releaseHeld();
  // The log is newest first. The rescheduled cleanup runs about a second
  // (the cleanup delay) after the late cookie lands.
  lateCookieCleaned = Boolean(
    await waitFor(
      async () => {
        const state = await storeState<{ activityLog?: LogEntry[] }>(session);
        log = state.activityLog ?? [];
        return removedNames(log[0] ?? {}).includes(LATE_COOKIE);
      },
      30000,
      500
    )
  );
  cookiesAtEnd = await cookiesFor(session, SITE);
}, 180000);

afterAll(async () => {
  await run?.stop();
});

describe("Chromium: a cookie set right after the site's cleanup", () => {
  it("has the site's request in flight when its tab closes", () => {
    expect(requestHeld).toBe(true);
  });

  it("cleans the site once its tab closes", () => {
    expect(firstCleanupLogged).toBe(true);
    expect(cookiesAfterFirstCleanup).toEqual([]);
  });

  it("schedules another cleanup that removes the late cookie", () => {
    expect(lateCookieCleaned, JSON.stringify(log.slice(0, 2))).toBe(true);
    expect(removedNames(log[1] ?? {})).toContain(SITE_COOKIE);
    expect(cookiesAtEnd).toEqual([]);
  });
});
