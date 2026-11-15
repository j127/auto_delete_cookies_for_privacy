/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * The popup's cookie list (#592) in a real Chrome: the filter narrows a
 * long list, and in advanced mode the delete button removes exactly the
 * clicked cookie. A same-name CHIPS cookie partitioned under another site
 * stays, and so do the rest. The popup is the real popup/popup.html in a
 * frame inside the probe page while the site's tab is the active one.
 *
 * The real popup is as wide as its content, so a long cookie name widens
 * it. Filtering that name out must not shrink it under the typing: the
 * width test measures the popup document's preferred (max-content) width
 * with and without the filter.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { updateSettings, waitFor } from "../helpers/chrome_cdp";
import { ChromiumRun, startChromiumRun } from "../helpers/chromium_scenario";
import { OTHER_SITE, SITE_HOSTS } from "../helpers/chromium_fixture";

const COUNT = 12;
const name = (i: number) => `e2e_list_${String(i).padStart(2, "0")}`;
const TARGET = name(7);
const TWIN_SITE = `https://${OTHER_SITE}`;
// Wide enough to make the popup wider than its 430px minimum.
const WIDE = `e2e_wide_${"w".repeat(150)}`;

let run: ChromiumRun | undefined;

type Row = { text: string; title: string; hasButton: boolean };

const rows = () =>
  run!.session.probeEval<Row[]>(
    `[...document.getElementById("e2ePopupFrame").contentDocument.querySelectorAll("#cookieList li")].map((li) => ({
       text: li.querySelector("span").textContent,
       title: li.getAttribute("title") ?? "",
       hasButton: li.querySelector("button") !== null,
     }))`
  );

/** Types into the popup's filter box the way React sees typing. */
const setFilter = (value: string) =>
  run!.session.probeEval(`(() => {
    const frame = document.getElementById("e2ePopupFrame");
    const input = frame.contentDocument.getElementById("cookieFilter");
    const setValue = Object.getOwnPropertyDescriptor(
      frame.contentWindow.HTMLInputElement.prototype, "value"
    ).set;
    setValue.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new frame.contentWindow.Event("input", { bubbles: true }));
    return true;
  })()`);

/**
 * The width the popup document asks for: its max-content width, which is
 * what sizes a real popup (the frame here has a fixed width). The frame is
 * made tall for the measurement, so a page scrollbar that comes and goes
 * with the list's height doesn't count.
 */
const preferredWidth = () =>
  run!.session.probeEval<number>(`(() => {
    const frame = document.getElementById("e2ePopupFrame");
    const root = frame.contentDocument.documentElement;
    const height = frame.style.height;
    frame.style.height = "5000px";
    // Lay out the probe page first, so the frame's document sees its new
    // height before it is measured.
    void frame.offsetHeight;
    const previous = root.style.width;
    root.style.width = "max-content";
    const width = root.getBoundingClientRect().width;
    root.style.width = previous;
    frame.style.height = height;
    return width;
  })()`);

/**
 * The preferred width once it holds still: the popup can still be laying
 * out its rows when a test starts, so two readings in a row must agree.
 */
const settledWidth = async (): Promise<number> => {
  let last = await preferredWidth();
  for (let i = 0; i < 25; i++) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const now = await preferredWidth();
    if (Math.abs(now - last) < 0.5) return now;
    last = now;
  }
  throw new Error(`the popup's width never settled (last ${last})`);
};

const storedNamed = (cookieName: string) =>
  run!.session.probeEval<{ partition: string | null }[]>(
    `chrome.cookies.getAll({ domain: ${JSON.stringify(SITE_HOSTS.page)}, name: ${JSON.stringify(cookieName)}, partitionKey: {} })
       .then((all) => all.map((c) => ({ partition: c.partitionKey?.topLevelSite ?? null })))`
  );

const listCount = () =>
  run!.session.probeEval<number>(
    `chrome.cookies.getAll({ domain: ${JSON.stringify(SITE_HOSTS.page)} })
       .then((all) => all.filter((c) => c.name.startsWith("e2e_list_")).length)`
  );

beforeAll(async () => {
  run = await startChromiumRun();
  // No automatic cleaning here: only the popup's button may remove cookies.
  await updateSettings(run.session, {
    activeMode: false,
    showAdvancedPopupControls: true,
  });
  await run.session.probeEval(`(async () => {
    const url = "https://${SITE_HOSTS.page}/";
    for (let i = 0; i < ${COUNT}; i++) {
      await chrome.cookies.set({
        url, name: "e2e_list_" + String(i).padStart(2, "0"), value: "v",
        secure: true, sameSite: "no_restriction",
      });
    }
    await chrome.cookies.set({
      url, name: ${JSON.stringify(WIDE)}, value: "v",
      secure: true, sameSite: "no_restriction",
    });
    // The target's twin, partitioned under another site (CHIPS).
    await chrome.cookies.set({
      url, name: ${JSON.stringify(TARGET)}, value: "twin",
      secure: true, sameSite: "no_restriction",
      partitionKey: { topLevelSite: ${JSON.stringify(TWIN_SITE)} },
    });
    const tab = await chrome.tabs.create({ url: "http://${SITE_HOSTS.page}/plain", active: true });
    const until = async (check, what) => {
      const deadline = Date.now() + 15000;
      while (!(await check())) {
        if (Date.now() > deadline) throw new Error("timed out: " + what);
        await new Promise((r) => setTimeout(r, 200));
      }
    };
    await until(async () => (await chrome.tabs.get(tab.id)).status === "complete", "site load");
    const frame = document.createElement("iframe");
    frame.id = "e2ePopupFrame";
    frame.style.cssText = "width: 430px; height: 600px; border: 0; display: block;";
    frame.src = "/popup/popup.html";
    document.body.prepend(frame);
    await until(() => frame.contentDocument?.getElementById("siteDataPanel") != null, "popup mount");
    return true;
  })()`);
  const listed = await waitFor(async () => {
    const opened = await run!.session.probeEval<boolean>(`(() => {
      const doc = document.getElementById("e2ePopupFrame").contentDocument;
      doc.getElementById("siteDataPanel").open = true;
      const list = doc.getElementById("cookieList");
      if (!list) return false;
      list.closest("details").open = true;
      return true;
    })()`);
    return opened && (await rows()).length >= COUNT + 2;
  }, 20000);
  if (!listed) throw new Error("the popup never listed the cookies");
}, 180000);

afterAll(async () => {
  await run?.stop();
});

describe("the popup's cookie list (#592)", () => {
  it("lists the partitioned twin as its own row", async () => {
    expect(await storedNamed(TARGET)).toHaveLength(2);
    const target = (await rows()).filter((r) => r.text.startsWith(TARGET));
    expect(target).toHaveLength(2);
    expect(
      target.filter((r) => r.title.includes(`(${TWIN_SITE})`))
    ).toHaveLength(1);
  });

  it("keeps the popup's width while the filter hides the long name", async () => {
    const before = await settledWidth();
    expect(before).toBeGreaterThan(430);
    await setFilter("e2e-list");
    expect(
      await waitFor(async () => (await rows()).length === COUNT + 1, 10000),
      "the filter hid the long name"
    ).toBeTruthy();
    expect(await settledWidth()).toBeCloseTo(before, 0);
    await setFilter("");
    expect(
      await waitFor(async () => (await rows()).length === COUNT + 2, 10000)
    ).toBeTruthy();
  });

  it("filters the list, ignoring case and separators", async () => {
    await run!.session.probeEval(`(() => {
      const frame = document.getElementById("e2ePopupFrame");
      const input = frame.contentDocument.getElementById("cookieFilter");
      const setValue = Object.getOwnPropertyDescriptor(
        frame.contentWindow.HTMLInputElement.prototype, "value"
      ).set;
      setValue.call(input, "E2E-LIST-07");
      input.dispatchEvent(new frame.contentWindow.Event("input", { bubbles: true }));
      return true;
    })()`);
    const narrowed = await waitFor(
      async () => (await rows()).length === 2,
      10000
    );
    expect(narrowed).toBeTruthy();
    for (const row of await rows()) {
      expect(row.text.startsWith(TARGET)).toBe(true);
      expect(row.hasButton).toBe(true);
    }
  });

  it("deletes exactly the clicked cookie and keeps its partitioned twin", async () => {
    await run!.session.probeEval(`(() => {
      const doc = document.getElementById("e2ePopupFrame").contentDocument;
      const row = [...doc.querySelectorAll("#cookieList li")].find(
        (li) => !li.getAttribute("title").includes("(")
      );
      row.querySelector("button").click();
      return true;
    })()`);
    const gone = await waitFor(async () => {
      const left = await storedNamed(TARGET);
      return left.length === 1 && left[0].partition !== null;
    }, 10000);
    expect(gone, "only the partitioned twin is left").toBeTruthy();
    expect(await listCount()).toBe(COUNT - 1);
    // The list refreshed in place: the filter still applies, the twin's row
    // is the one left.
    const refreshed = await waitFor(async () => {
      const left = await rows();
      return left.length === 1 && left[0].title.includes(`(${TWIN_SITE})`);
    }, 10000);
    expect(refreshed).toBeTruthy();
  });
});
