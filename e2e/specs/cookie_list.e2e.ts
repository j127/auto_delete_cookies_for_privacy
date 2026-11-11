/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * Matrix row 24, the popup's cookie list (#592), in a real Firefox: on a
 * site with more cookies than the filter threshold, the filter narrows the
 * list, and in advanced mode the delete button removes exactly the clicked
 * cookie. A same-name cookie in another partition stays, and so do the rest.
 *
 * The popup is the real popup/popup.html in a frame inside the probe tab
 * while the site's tab is the active one, as in extension_pages.e2e.ts.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  FirefoxSession,
  inProbe,
  launchFirefox,
  probe,
  stopGeckodriver,
  waitUntil,
} from "../helpers/firefox_driver";
import {
  BUSY_COOKIE_COUNT,
  FixtureServer,
  startFixtureServer,
} from "../helpers/fixture_server";

let session: FirefoxSession;
let fixture: FixtureServer;

/** The /busy page's cookie names (busyName in fixture_server.ts). */
const busyCookie = (i: number): string =>
  `e2e_busy_${String(i).padStart(2, "0")}_${"tracking_identifier".repeat(4)}`;

const TARGET = busyCookie(7);

type Row = { text: string; title: string; hasButton: boolean };

/** The cookie list's rows, read in the popup frame. */
const rows = async (): Promise<Row[]> =>
  (await inProbe(
    session,
    `const doc = document.getElementById("e2ePopupFrame").contentDocument;
     return [...doc.querySelectorAll("#cookieList li")].map((li) => ({
       text: li.querySelector("span").textContent,
       title: li.getAttribute("title") ?? "",
       hasButton: li.querySelector("button") !== null,
     }));`
  )) as Row[];

/** The cookies named name on localhost, in every partition. */
const storedNamed = async (
  name: string
): Promise<{ partition: string | null }[]> =>
  (await inProbe(
    session,
    `const all = await browser.cookies.getAll({
       domain: "localhost",
       name: args[0],
       firstPartyDomain: null,
       partitionKey: {},
     });
     return all.map((c) => ({ partition: c.partitionKey?.topLevelSite ?? null }));`,
    name
  )) as { partition: string | null }[];

const busyCount = async (): Promise<number> =>
  (await inProbe(
    session,
    `const all = await browser.cookies.getAll({
       domain: "localhost",
       firstPartyDomain: null,
     });
     return all.filter((c) => c.name.startsWith("e2e_busy_")).length;`
  )) as number;

beforeAll(async () => {
  fixture = await startFixtureServer();
  session = await launchFirefox();
  const applied = (await probe(session, {
    kind: "updateSettings",
    settings: { showAdvancedPopupControls: true },
  })) as Record<string, unknown>;
  if (applied.showAdvancedPopupControls !== true) {
    throw new Error(`advanced mode not applied: ${JSON.stringify(applied)}`);
  }

  // One script: the site tab must be the active one when the popup
  // mounts, and switching webdriver back to the probe tab in between
  // would make the probe tab active instead.
  await inProbe(
    session,
    `const tab = await browser.tabs.create({ url: args[0], active: true });
     const until = async (check, what) => {
       const deadline = Date.now() + 15000;
       while (!(await check())) {
         if (Date.now() > deadline) throw new Error("timed out: " + what);
         await new Promise((r) => setTimeout(r, 200));
       }
     };
     await until(async () => {
       const t = await browser.tabs.get(tab.id);
       return t.status === "complete" && t.url === args[0];
     }, "site load");
     await until(async () => {
       const cookies = await browser.cookies.getAll({ domain: "localhost", firstPartyDomain: null });
       return cookies.filter((c) => c.name.startsWith("e2e_busy_")).length >= args[1];
     }, "busy cookies");
     // A same-name twin of the target, partitioned under another site.
     await browser.cookies.set({
       url: args[3] + "/",
       name: args[2],
       value: "twin",
       partitionKey: { topLevelSite: "http://127.0.0.1" },
     });
     const frame = document.createElement("iframe");
     frame.id = "e2ePopupFrame";
     frame.style.cssText = "width: 430px; height: 600px; border: 0; display: block;";
     frame.src = "/popup/popup.html";
     document.body.prepend(frame);
     await until(
       () => frame.contentDocument?.getElementById("siteDataPanel") != null,
       "popup mount"
     );
     return true;`,
    `${fixture.primary}/busy`,
    BUSY_COOKIE_COUNT,
    TARGET,
    fixture.primary
  );
  // Open the panel and its Cookies row once the inventory is in.
  const listed = await waitUntil(async () => {
    const opened = (await inProbe(
      session,
      `const doc = document.getElementById("e2ePopupFrame").contentDocument;
       doc.getElementById("siteDataPanel").open = true;
       const list = doc.getElementById("cookieList");
       if (!list) return false;
       list.closest("details").open = true;
       return true;`
    )) as boolean;
    return opened && (await rows()).length > BUSY_COOKIE_COUNT;
  }, 20000);
  if (!listed) throw new Error("the popup never listed the busy cookies");
}, 120000);

afterAll(async () => {
  await session?.quit();
  stopGeckodriver();
  await fixture?.stop();
});

describe("the popup's cookie list (#592, row 24)", () => {
  it("lists the same-name twin as its own row", async () => {
    expect(await storedNamed(TARGET)).toHaveLength(2);
    const target = (await rows()).filter((r) => r.text.startsWith(TARGET));
    expect(target).toHaveLength(2);
    expect(
      target.filter((r) => r.title.includes("(http://127.0.0.1)"))
    ).toHaveLength(1);
  });

  it("filters the list, ignoring case and separators", async () => {
    await inProbe(
      session,
      `const frame = document.getElementById("e2ePopupFrame");
       const input = frame.contentDocument.getElementById("cookieFilter");
       const setValue = Object.getOwnPropertyDescriptor(
         frame.contentWindow.HTMLInputElement.prototype,
         "value"
       ).set;
       setValue.call(input, args[0]);
       input.dispatchEvent(new frame.contentWindow.Event("input", { bubbles: true }));
       return true;`,
      "E2E-BUSY-07"
    );
    const narrowed = await waitUntil(
      async () => (await rows()).length === 2,
      10000
    );
    expect(narrowed).toBe(true);
    for (const row of await rows()) {
      expect(row.text.startsWith(TARGET)).toBe(true);
      expect(row.hasButton).toBe(true);
    }
  });

  it("deletes exactly the clicked cookie and keeps its twin", async () => {
    await inProbe(
      session,
      `const doc = document.getElementById("e2ePopupFrame").contentDocument;
       const row = [...doc.querySelectorAll("#cookieList li")].find(
         (li) => !li.getAttribute("title").includes("(")
       );
       row.querySelector("button").click();
       return true;`
    );
    const gone = await waitUntil(async () => {
      const left = await storedNamed(TARGET);
      return left.length === 1 && left[0].partition !== null;
    }, 10000);
    expect(gone, "only the partitioned twin is left").toBe(true);
    // Every other busy cookie is still there.
    expect(await busyCount()).toBe(BUSY_COOKIE_COUNT - 1);
    // The list refreshed: one row for the target is left, the twin's.
    const refreshed = await waitUntil(async () => {
      const left = await rows();
      return left.length === 1 && left[0].title.includes("(http://127.0.0.1)");
    }, 10000);
    expect(refreshed).toBe(true);
  });
});
