/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * Site-data cleanup for a site on a non-default port (#574), such as a
 * NAS's web interface at 192.168.1.8:5000. Cookies carry no port, so the
 * cleanup used to name only the portless origins, and Chrome kept the
 * ported origin's storage: the site stayed in chrome://settings/content/all
 * with its port (discussion #573). The page's marker cookie now records
 * the port, and the cleanup names the ported origin too.
 *
 * The /nas page is opened straight on the fixture's own address,
 * http://127.0.0.1:PORT, so its origin keeps the port (the other specs map
 * hostnames to the server to get portless origins). Once its tab closes
 * and the cleanup has run, its storage must be empty and its cookie gone.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  cookiesFor,
  ProbeCookie,
  readOriginStorage,
  storeState,
} from "../helpers/chrome_cdp";
import { NAS_COOKIE } from "../helpers/chromium_fixture";
import {
  ChromiumRun,
  closeTabsAndAwaitCleanup,
  openReadyTabs,
  startChromiumRun,
} from "../helpers/chromium_scenario";

const HOST = "127.0.0.1";

let run: ChromiumRun | undefined;
let origin = "";
let cookiesBefore: ProbeCookie[] = [];
let cookiesAfter: ProbeCookie[] = [];
let cleanupLogged = false;
let lastLogEntry = "";

beforeAll(async () => {
  run = await startChromiumRun();
  const { session, fixture } = run;
  origin = `http://${HOST}:${fixture.port}`;
  const tabs = await openReadyTabs(session, [`${origin}/nas`]);
  cookiesBefore = await cookiesFor(session, HOST);
  cleanupLogged = await closeTabsAndAwaitCleanup(session, tabs);
  // Before the storage check, which opens a page on the origin it reads.
  cookiesAfter = await cookiesFor(session, HOST);
  const state = await storeState<{ activityLog?: unknown[] }>(session);
  lastLogEntry = JSON.stringify(state.activityLog?.[0] ?? null);
}, 180000);

afterAll(async () => {
  await run?.stop();
});

describe("Chromium: closing a site on a non-default port", () => {
  it("runs a cleanup and removes the site's cookie", () => {
    expect(cleanupLogged).toBe(true);
    expect(cookiesBefore.map((c) => c.name)).toContain(NAS_COOKIE);
    expect(cookiesAfter, lastLogEntry).toEqual([]);
  });

  it("empties the ported origin's storage", async () => {
    expect(
      await readOriginStorage(run!.session, origin),
      `cleanup log: ${lastLogEntry}`
    ).toEqual({ origin, localStorage: [], indexedDB: [], cacheStorage: [] });
  }, 60000);
});
