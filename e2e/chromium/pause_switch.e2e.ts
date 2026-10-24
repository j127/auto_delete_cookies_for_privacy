/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * Pausing automatic cleaning (#555) in a real Chrome: the popup's switch
 * asks for how long before turning cleaning off and turns it on in one
 * click, a timed pause comes back on through a real alarm, and the
 * keyboard shortcut is registered with no key (#558), so users assign
 * their own on chrome://extensions/shortcuts. At phone width the hero
 * shows every state's whole wording instead of cutting it off.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ChromeTab,
  storeState,
  updateSettings,
  waitFor,
} from "../helpers/chrome_cdp";
import { ChromiumRun, startChromiumRun } from "../helpers/chromium_scenario";

const HOUR_MS = 60 * 60 * 1000;

let run: ChromiumRun | undefined;
let popup: ChromeTab | undefined;

const settings = async () =>
  (
    await storeState<{ settings: Record<string, { value: unknown }> }>(
      run!.session
    )
  ).settings;

const inPopup = <T>(expression: string) =>
  run!.session.evaluate<T>(popup!, expression);

beforeAll(async () => {
  // Cleaning on, as startChromiumRun leaves it.
  run = await startChromiumRun();
  const { session } = run;
  popup = await session.openTab(
    `chrome-extension://${session.extensionId}/popup/popup.html`
  );
  const shown = await waitFor(
    () =>
      inPopup<boolean>(`Boolean(document.getElementById("activeModeSwitch"))`),
    20000
  );
  if (!shown) throw new Error("the popup never showed its switch");
}, 180000);

afterAll(async () => {
  await run?.stop();
});

describe("pausing automatic cleaning (#555)", () => {
  it("registers the shortcut with no key", async () => {
    const commands = await run!.session.probeEval<
      { name: string; shortcut: string }[]
    >(
      `chrome.commands.getAll().then((cs) => cs.map(({ name, shortcut }) => ({ name, shortcut })))`
    );
    expect(commands).toContainEqual({
      name: "toggle-active-mode",
      shortcut: "",
    });
  });

  it("asks for how long, then pauses for an hour", async () => {
    expect(
      await inPopup<boolean>(
        `document.getElementById("activeModeSwitch").checked`
      )
    ).toBe(true);
    await inPopup(`document.getElementById("activeModeSwitch").click(), true`);
    // Still on: the switch only opened the choices.
    expect(
      await inPopup<number>(
        `document.querySelectorAll("#pauseChoices button").length`
      )
    ).toBe(4);
    expect((await settings()).activeMode.value).toBe(true);

    const clickedAt = Date.now();
    await inPopup(
      `document.querySelector("#pauseChoices button").click(), true`
    );
    const paused = await waitFor(async () => {
      const s = await settings();
      return s.activeMode.value === false ? s : undefined;
    }, 10000);
    const resumeAt = Number(paused?.resumeActiveModeAt.value);
    expect(resumeAt).toBeGreaterThanOrEqual(clickedAt + HOUR_MS - 5000);
    expect(resumeAt).toBeLessThanOrEqual(Date.now() + HOUR_MS + 5000);

    // The hero follows: switch off, off wording, choices closed.
    const hero = await waitFor(
      () =>
        inPopup<string | false>(
          `!document.getElementById("activeModeSwitch").checked && !document.getElementById("pauseChoices") && document.getElementById("popupHero").textContent`
        ),
      10000
    );
    const offText = await inPopup<string>(
      `chrome.i18n.getMessage("popupHeroOffText")`
    );
    expect(hero).toContain(offText);
  });

  it("turns cleaning back on in one click and forgets the pause", async () => {
    await inPopup(`document.getElementById("activeModeSwitch").click(), true`);
    const resumed = await waitFor(async () => {
      const s = await settings();
      return s.activeMode.value === true ? s : undefined;
    }, 10000);
    expect(resumed?.resumeActiveModeAt.value).toBe(0);
  });

  it("a timed pause comes back on through its alarm", async () => {
    // A few seconds instead of an hour: unpacked extensions' alarms are
    // not held to Chrome's 30-second minimum.
    await updateSettings(run!.session, {
      resumeActiveModeAt: Date.now() + 3000,
      activeMode: false,
    });
    const resumed = await waitFor(
      async () => {
        const s = await settings();
        return s.activeMode.value === true ? s : undefined;
      },
      60000,
      500
    );
    expect(resumed?.activeMode.value).toBe(true);
    expect(resumed?.resumeActiveModeAt.value).toBe(0);
  }, 90000);
});

describe("the popup hero at phone width", () => {
  const PHONE_WIDTH = 360;

  beforeAll(async () => {
    // A phone's screen: the popup caps its 430px minimum at the screen
    // width, as on Firefox for Android, so reload to re-run that.
    await run!.session.cdp.send(
      "Emulation.setDeviceMetricsOverride",
      {
        width: PHONE_WIDTH,
        height: 800,
        screenWidth: PHONE_WIDTH,
        screenHeight: 800,
        deviceScaleFactor: 1,
        mobile: false,
      },
      popup!.sessionId
    );
    await inPopup(`location.reload(), true`);
    const shown = await waitFor(
      () =>
        inPopup<boolean>(
          `window.innerWidth === ${PHONE_WIDTH} && Boolean(document.getElementById("activeModeSwitch"))`
        ),
      20000
    );
    if (!shown) throw new Error("the popup did not come back at phone width");
  });

  /** What the hero shows, and whether any of it is cut off. */
  const hero = () =>
    inPopup<{ title: string; subtitle: string; clipped: string[] }>(`(() => {
      const parts = ["popupHeroTitle", "popupHeroSubtitle"].map((id) =>
        document.getElementById(id)
      );
      return {
        title: parts[0].textContent,
        subtitle: parts[1].textContent,
        clipped: [...parts, document.documentElement]
          .filter((el) => el.scrollWidth > el.clientWidth)
          .map((el) => el.id || el.tagName),
      };
    })()`);

  it.each([
    ["on", { activeMode: true, resumeActiveModeAt: 0 }, "popupHeroForgetText"],
    [
      "paused for an hour",
      { resumeActiveModeAt: Date.now() + HOUR_MS, activeMode: false },
      "popupHeroResumesAtText",
    ],
    [
      "paused until restart",
      { resumeActiveModeAt: -1, activeMode: false },
      "popupHeroResumesOnRestartText",
    ],
    [
      "off",
      { resumeActiveModeAt: 0, activeMode: false },
      "popupHeroOffSubText",
    ],
  ])("shows all of the %s wording", async (_label, state, key) => {
    await updateSettings(run!.session, state);
    // The resume time's own wording starts before its $TIME$.
    const expected = (
      await inPopup<string>(`chrome.i18n.getMessage("${key}", ["@@TIME@@"])`)
    ).split("@@TIME@@")[0];
    const shown = await waitFor(async () => {
      const h = await hero();
      return h.subtitle.startsWith(expected) ? h : undefined;
    }, 10000);
    expect(shown, `subtitle starting "${expected}"`).toBeTruthy();
    expect(shown!.clipped).toEqual([]);
  });
});
