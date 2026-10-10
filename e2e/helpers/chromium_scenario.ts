/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * The steps the Chromium specs share: start the fixture and Chrome with
 * automatic cleaning on (the site-data settings stay at their defaults),
 * open a site's tabs and wait for their storage writes, then close them
 * and wait for the cleanup that follows.
 */

import {
  activityLogLength,
  ChromeSession,
  ChromeTab,
  launchChrome,
  sleep,
  updateSettings,
  waitFor,
  waitForReady,
} from "./chrome_cdp";
import {
  ChromiumFixture,
  fixtureHostResolverRules,
  fixtureOrigins,
  startChromiumFixture,
} from "./chromium_fixture";

export interface ChromiumRun {
  fixture: ChromiumFixture;
  session: ChromeSession;
  stop: () => Promise<void>;
}

/**
 * The fixture plus a Chrome session with automatic cleaning on, a 1s
 * delay and the cleanup log on. Nothing else changes: every site-data
 * setting keeps its default. enableFeatures switches Chrome features on
 * for the run (chromeLaunchArgs).
 */
export const startChromiumRun = async ({
  enableFeatures,
}: { enableFeatures?: string[] } = {}): Promise<ChromiumRun> => {
  const fixture = await startChromiumFixture();
  let session: ChromeSession;
  try {
    session = await launchChrome({
      hostResolverRules: fixtureHostResolverRules(fixture.port),
      secureOrigins: fixtureOrigins(),
      enableFeatures,
    });
  } catch (error) {
    await fixture.stop();
    throw error;
  }
  const wanted = { activeMode: true, delayBeforeClean: 1, statLogging: true };
  const applied = await updateSettings(session, wanted);
  if (JSON.stringify(applied) !== JSON.stringify(wanted)) {
    await session.quit();
    await fixture.stop();
    throw new Error(`settings not applied: ${JSON.stringify(applied)}`);
  }
  return {
    fixture,
    session,
    stop: async () => {
      await session.quit();
      await fixture.stop();
    },
  };
};

/**
 * Opens each url in its own tab, in order, and waits until each page
 * reports its storage (and its frame's) written.
 */
export const openReadyTabs = async (
  session: ChromeSession,
  urls: string[]
): Promise<ChromeTab[]> => {
  const tabs: ChromeTab[] = [];
  for (const url of urls) {
    const tab = await session.openTab(url);
    tabs.push(tab);
    await waitForReady(session, tab);
  }
  return tabs;
};

/**
 * Closes the tabs in order and waits for the cleanup they start to log
 * its run, plus a moment for anything still settling. Returns whether a
 * new log entry appeared; the specs assert the end state either way, so
 * a cleanup that never runs fails on what it left behind.
 */
export const closeTabsAndAwaitCleanup = async (
  session: ChromeSession,
  tabs: ChromeTab[],
  timeoutMs = 60000
): Promise<boolean> => {
  const before = await activityLogLength(session);
  for (const tab of tabs) await session.closeTab(tab);
  const logged = await waitFor(
    async () => (await activityLogLength(session)) > before,
    timeoutMs,
    500
  );
  await sleep(2000);
  return Boolean(logged);
};
