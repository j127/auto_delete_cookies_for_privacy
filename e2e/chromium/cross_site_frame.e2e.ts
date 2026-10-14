/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * What cleanup leaves of a cross-site frame's storage in Chrome (#504).
 * Chrome keeps that storage partitioned under the top-level site and
 * clears it together with the site's own origins, so the extension sets no
 * marker cookie for a cross-site frame's host there (it does on Firefox,
 * which clears storage by host: docs/testing-firefox.md, row 22). This
 * spec holds Chrome to that.
 *
 * The fixture's /embedder page sets the site cookie and embeds a frame
 * from another site that sets no cookie and writes a localStorage entry
 * and an IndexedDB database. Each time the frame loads it first reports
 * which of the two it found. A second tab opened while the first is still
 * open must find both, which shows the frame's storage lasts from one
 * load to the next. Once both tabs close and the cleanup has run, another
 * visit must find neither.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ChromeSession,
  ChromeTab,
  ProbeCookie,
  waitFor,
} from "../helpers/chrome_cdp";
import { OTHER_SITE, SITE_HOSTS } from "../helpers/chromium_fixture";
import {
  ChromiumRun,
  closeTabsAndAwaitCleanup,
  startChromiumRun,
} from "../helpers/chromium_scenario";

const PAGE = `http://${SITE_HOSTS.page}/embedder`;

let run: ChromiumRun | undefined;
let foundOnFirstVisit = "";
let foundWhileOpen = "";
let foundAfterCleanup = "";
let frameSiteCookies: ProbeCookie[] = [];
let cleanupLogged = false;

/** Opens the page and waits for its frame's report of what it found. */
const openEmbedder = async (
  session: ChromeSession
): Promise<{ tab: ChromeTab; found: string }> => {
  const tab = await session.openTab(PAGE);
  let title = "";
  const reported = await waitFor(async () => {
    title = await session.evaluate<string>(tab, "document.title");
    return title.startsWith("found:");
  }, 20000);
  if (!reported) throw new Error(`frame did not report, title: ${title}`);
  return { tab, found: title.slice("found:".length) };
};

beforeAll(async () => {
  run = await startChromiumRun();
  const { session } = run;
  const first = await openEmbedder(session);
  foundOnFirstVisit = first.found;
  // Partitioned cookies too: that is where a frame's marker would sit.
  frameSiteCookies = await session.probeEval<ProbeCookie[]>(
    `chrome.cookies.getAll({ domain: ${JSON.stringify(OTHER_SITE)}, partitionKey: {} }).then((cs) => cs.map(({ name, domain }) => ({ name, domain })))`
  );
  const second = await openEmbedder(session);
  foundWhileOpen = second.found;
  cleanupLogged = await closeTabsAndAwaitCleanup(session, [
    first.tab,
    second.tab,
  ]);
  const third = await openEmbedder(session);
  foundAfterCleanup = third.found;
  await session.closeTab(third.tab);
}, 180000);

afterAll(async () => {
  await run?.stop();
});

describe("Chromium: a cross-site frame's storage after its page closes (#504)", () => {
  it("starts from a frame without storage", () => {
    expect(foundOnFirstVisit).toBe("");
  });

  it("keeps the frame's storage from one load to the next while the site is open", () => {
    expect(foundWhileOpen).toBe("localStorage,indexedDB");
  });

  it("sets no cookie for the frame's host, marker included", () => {
    expect(frameSiteCookies).toEqual([]);
  });

  it("runs a cleanup and logs it", () => {
    expect(cleanupLogged).toBe(true);
  });

  it("finds the frame's storage gone on the next visit", () => {
    expect(foundAfterCleanup).toBe("");
  });
});
