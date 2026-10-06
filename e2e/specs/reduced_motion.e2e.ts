/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * Matrix row 20: the settings page's accordions open with system animations
 * turned off (issue #464). DaisyUI 5.6.6 gave an open `details.collapse` its
 * height back only under `prefers-reduced-motion: no-preference`, so with
 * Windows' "Animation effects" off the summary toggled while the content
 * stayed 0 px tall. The session launches with ui.prefersReducedMotion=1,
 * the pref behind that media query, and checks the Advanced accordion under
 * "Delete all site data" and a Cleanup log entry, which share the classes.
 *
 * A bare `open` check, or the content's own rect, would pass even under
 * the bug: only the details box stays collapsed. So each case measures the
 * details box against its content and hit-tests a point inside the
 * content. Firefox ESR 140 has no ::details-content, which the bug needs,
 * so there the row passes trivially; on the release channel the spec first
 * confirms the pseudo-element is supported.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  FirefoxSession,
  launchFirefox,
  probe,
  stopGeckodriver,
  waitUntil,
} from "../helpers/firefox_driver";

let session: FirefoxSession;

/**
 * Turns the probe tab into one settings page. The app reads the hash only
 * on mount, hence the refresh.
 */
const openSettingsTab = async (hash: string, mountedCss: string) => {
  const { driver, extensionOrigin, probeHandle } = session;
  await driver.switchTo().window(probeHandle);
  await driver.get(`${extensionOrigin}/settings/settings.html#${hash}`);
  await driver.navigate().refresh();
  const mounted = await waitUntil(
    async () =>
      (await driver.executeScript(
        "return document.querySelector(arguments[0]) !== null;",
        mountedCss
      )) as boolean,
    15000
  );
  if (!mounted)
    throw new Error(`settings #${hash} never mounted ${mountedCss}`);
};

interface OpenedAccordion {
  open: boolean;
  detailsHeight: number;
  summaryHeight: number;
  contentHeight: number;
  hitInsideContent: boolean;
}

/**
 * Clicks the summary for real, then measures what a person would see: the
 * details box must grow by the content's height, and a point in the middle
 * of the content must land on the content, not on whatever lies below.
 */
const clickAndMeasure = async (
  summaryCss: string
): Promise<OpenedAccordion> => {
  const { driver } = session;
  await driver.executeScript(
    "document.querySelector(arguments[0]).scrollIntoView({ block: 'start' });",
    summaryCss
  );
  await driver.findElement({ css: summaryCss }).click();
  await waitUntil(
    async () =>
      (await driver.executeScript(
        "return document.querySelector(arguments[0]).parentElement.open;",
        summaryCss
      )) as boolean,
    5000
  );
  // Let any transition settle; the bug is a final state, not a frame.
  await new Promise((resolve) => setTimeout(resolve, 600));
  return (await driver.executeScript(
    `const summary = document.querySelector(arguments[0]);
     const details = summary.parentElement;
     const content = details.querySelector(".collapse-content");
     content.scrollIntoView({ block: "center" });
     const c = content.getBoundingClientRect();
     const hit = document.elementFromPoint(c.left + c.width / 2, c.top + Math.min(c.height / 2, 40));
     return {
       open: details.open,
       detailsHeight: details.getBoundingClientRect().height,
       summaryHeight: summary.getBoundingClientRect().height,
       contentHeight: c.height,
       hitInsideContent: hit !== null && content.contains(hit),
     };`,
    summaryCss
  )) as OpenedAccordion;
};

beforeAll(async () => {
  session = await launchFirefox({ "ui.prefersReducedMotion": 1 });
}, 120000);

afterAll(async () => {
  await session?.quit();
  stopGeckodriver();
});

describe("row 20: accordions open with animations off", () => {
  it("runs with reduced motion, on a Firefox that has ::details-content where it should", async () => {
    const env = (await session.driver.executeScript(
      `return {
         reduce: matchMedia("(prefers-reduced-motion: reduce)").matches,
         detailsContent: CSS.supports("selector(::details-content)"),
         major: Number((navigator.userAgent.match(/Firefox\\/(\\d+)/) || [])[1]),
       };`
    )) as { reduce: boolean; detailsContent: boolean; major: number };
    // Without the pref applied, this row would silently test nothing.
    expect(env.reduce).toBe(true);
    // Firefox 143 shipped ::details-content; from there on the row
    // exercises the code path the bug lived in.
    if (env.major >= 143) expect(env.detailsContent).toBe(true);
  });

  it("opens the Advanced accordion under Delete all site data", async () => {
    await openSettingsTab("tabSettings", "#siteDataAdvanced");
    const opened = await clickAndMeasure("#siteDataAdvanced");
    expect(opened.open).toBe(true);
    expect(opened.contentHeight).toBeGreaterThan(20);
    // 2 px of slack for borders and rounding.
    expect(opened.detailsHeight - opened.summaryHeight).toBeGreaterThanOrEqual(
      opened.contentHeight - 2
    );
    expect(opened.hitInsideContent).toBe(true);
  });

  it("opens a Cleanup log entry", async () => {
    // One logged cleanup to expand; the reducer keeps entries that cleaned
    // site data even without cookies.
    await probe(session, {
      kind: "dispatch",
      action: {
        type: "ADD_ACTIVITY_LOG",
        payload: {
          dateTime: new Date().toString(),
          recentlyCleaned: 0,
          storeIds: {},
          siteDataCleaned: true,
          browsingDataCleanup: { LocalStorage: ["example.com"] },
        },
      },
    });
    await openSettingsTab("tabCleanupLog", "#heading0");
    const opened = await clickAndMeasure("#heading0");
    expect(opened.open).toBe(true);
    expect(opened.detailsHeight - opened.summaryHeight).toBeGreaterThanOrEqual(
      opened.contentHeight - 2
    );
    expect(opened.hitInsideContent).toBe(true);
  });
});
