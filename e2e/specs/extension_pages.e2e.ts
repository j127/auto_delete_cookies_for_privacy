/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * The matrix rows about the extension's own pages, sharing one session:
 * row 1 (temporary install), row 18 (popup fit), row 17 (importing an old
 * Cookie AutoDelete export), row 15 (site access revoked), and the Support
 * page's system details and bug-report email (#435, #436), which have no
 * row number. Settings stay at their defaults throughout.
 *
 * The popup is the real popup/popup.html, opened as a page: webdriver
 * cannot click the toolbar button. Where the popup must describe a site
 * (row 18), it is loaded in a 430px frame while the site's tab is the
 * active one, which is the tab the popup asks for on mount.
 *
 * What stays manual: clicking Allow in Firefox's own permission prompt
 * (row 15), and a mail app actually opening for the email link.
 */
import { resolve } from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { By, WebElement } from "selenium-webdriver";
import {
  extensionScriptErrors,
  FirefoxSession,
  inChrome,
  inProbe,
  launchFirefox,
  openTab,
  closeTab,
  probe,
  stopGeckodriver,
  waitUntil,
} from "../helpers/firefox_driver";
import {
  BUSY_COOKIE_COUNT,
  FixtureServer,
  startFixtureServer,
} from "../helpers/fixture_server";
import { FIREFOX_ADDON_ID } from "../../scripts/firefox_manifest";
import { SUPPORT_EMAIL } from "../../src/services/bug-report-email";

interface StoredExpression {
  expression: string;
  listType: string;
  storeId: string;
}

let session: FirefoxSession;
let fixture: FixtureServer;

/** The UI string for a message id, read in the settings page itself. */
const message = async (name: string, subs?: string[]): Promise<string> => {
  const { driver, probeHandle } = session;
  await driver.switchTo().window(probeHandle);
  return (await driver.executeScript(
    "return browser.i18n.getMessage(arguments[0], arguments[1]);",
    name,
    subs ?? []
  )) as string;
};

/** Whether the current page has an element matching css. */
const present = async (css: string): Promise<boolean> =>
  (await session.driver.findElements(By.css(css))).length > 0;

/**
 * Opens an extension page in a new tab and waits until React has mounted
 * the element that marks it rendered. Returns the tab's handle.
 */
const openExtensionPage = async (
  path: string,
  mountedCss: string
): Promise<string> => {
  const handle = await openTab(session, `${session.extensionOrigin}/${path}`);
  const mounted = await waitUntil(() => present(mountedCss), 15000);
  if (!mounted) throw new Error(`${path} never mounted ${mountedCss}`);
  return handle;
};

/**
 * Turns the probe tab into one settings page. The app reads the hash only
 * on mount, hence the refresh.
 */
const openSettingsTab = async (hash: string, mountedCss: string) => {
  const { driver, extensionOrigin, probeHandle } = session;
  await driver.switchTo().window(probeHandle);
  await driver.get(`${extensionOrigin}/settings/settings.html#${hash}`);
  await driver.navigate().refresh();
  const mounted = await waitUntil(() => present(mountedCss), 15000);
  if (!mounted)
    throw new Error(`settings #${hash} never mounted ${mountedCss}`);
};

const persistedLists = async (): Promise<Record<string, StoredExpression[]>> =>
  (
    (await probe(session, { kind: "getState" })) as {
      lists?: Record<string, StoredExpression[]>;
    }
  ).lists ?? {};

/** The DaisyUI alerts of one kind on the current page, as text. */
const alertTexts = async (kind: "success" | "error"): Promise<string[]> =>
  (await session.driver.executeScript(
    `return [...document.querySelectorAll('[role="alert"].alert-' + arguments[0])]
      .map((a) => a.textContent);`,
    kind
  )) as string[];

beforeAll(async () => {
  fixture = await startFixtureServer();
  session = await launchFirefox();
}, 120000);

afterAll(async () => {
  await session?.quit();
  stopGeckodriver();
  await fixture?.stop();
});

describe("row 1: temporary install", () => {
  it("loads as a temporary add-on with no manifest warnings or errors", async () => {
    const loaded = (await inChrome(
      session,
      `const { AddonManager } = ChromeUtils.importESModule(
         "resource://gre/modules/AddonManager.sys.mjs"
       );
       const addon = await AddonManager.getAddonByID(args[0]);
       const extension = WebExtensionPolicy.getByID(args[0])?.extension;
       return {
         active: addon?.isActive,
         temporary: addon?.temporarilyInstalled,
         warnings: extension?.warnings ?? null,
         errors: extension?.errors ?? null,
         background: extension?.backgroundState,
       };`,
      FIREFOX_ADDON_ID
    )) as {
      active?: boolean;
      temporary?: boolean;
      warnings: string[] | null;
      errors: string[] | null;
      background?: string;
    };
    expect(loaded.active).toBe(true);
    expect(loaded.temporary).toBe(true);
    // The matrix tolerates one known notice about data_collection
    // permissions and the minimum version; anything else is a regression.
    // (None shows on 157; the filter keeps a channel that does show it
    // from failing.)
    expect(
      (loaded.warnings ?? []).filter((w) => !/data_collection/i.test(w))
    ).toEqual([]);
    expect(loaded.errors).toEqual([]);
    expect(loaded.background).toBe("running");
    // The background finished init(): the store bridge answers with state.
    const state = (await inProbe(
      session,
      'return browser.runtime.sendMessage({ type: "@@STORE_UPDATE_STATE" });'
    )) as { settings?: Record<string, unknown> };
    expect(Object.keys(state.settings ?? {}).length).toBeGreaterThan(0);
  });

  it("mounts the popup and the settings page with no page errors", async () => {
    const errorTitle = await message("errorText");
    const fallbackShown = async (): Promise<boolean> =>
      (await session.driver.executeScript(
        `return [...document.querySelectorAll('[role="alert"] h4')]
          .some((h) => h.textContent === arguments[0]);`,
        errorTitle
      )) as boolean;

    const popup = await openExtensionPage("popup/popup.html", "#cadPopup");
    try {
      expect(await fallbackShown()).toBe(false);
    } finally {
      await closeTab(session, popup);
    }

    const settings = await openExtensionPage(
      "settings/settings.html",
      "main h1"
    );
    try {
      expect(await fallbackShown()).toBe(false);
    } finally {
      await closeTab(session, settings);
    }

    // Uncaught exceptions and rejections from the background and both
    // pages, since the session started.
    expect(await extensionScriptErrors(session)).toEqual([]);
  }, 60000);
});

describe("row 18: popup fit", () => {
  let siteTabId: number | undefined;

  afterAll(async () => {
    await inProbe(
      session,
      `document.getElementById("e2ePopupFrame")?.remove();
       if (args[0] !== null) await browser.tabs.remove(args[0]);`,
      siteTabId ?? null
    );
  });

  /** Measurements of the popup frame, read in the probe tab. */
  const measure = async () =>
    (await inProbe(
      session,
      `const doc = document.getElementById("e2ePopupFrame").contentDocument;
       const html = doc.documentElement;
       const controls = [...doc.querySelectorAll("button, a, summary, input, select")]
         .filter((el) => el.getClientRects().length > 0)
         .map((el) => {
           const r = el.getBoundingClientRect();
           return {
             label: (el.textContent || el.getAttribute("title") || el.tagName).trim().slice(0, 40),
             left: r.left,
             right: r.right,
             top: r.top,
             bottom: r.bottom,
           };
         });
       const lists = [...doc.querySelectorAll("#siteDataPanel details[open] ul")].map((ul) => ({
         overflowY: getComputedStyle(ul).overflowY,
         clientHeight: ul.clientHeight,
         scrollHeight: ul.scrollHeight,
         clientWidth: ul.clientWidth,
         scrollWidth: ul.scrollWidth,
         items: ul.children.length,
       }));
       return {
         width: html.clientWidth,
         scrollWidth: html.scrollWidth,
         scrollHeight: html.scrollHeight,
         controls,
         lists,
       };`
    )) as {
      width: number;
      scrollWidth: number;
      scrollHeight: number;
      controls: {
        label: string;
        left: number;
        right: number;
        top: number;
        bottom: number;
      }[];
      lists: {
        overflowY: string;
        clientHeight: number;
        scrollHeight: number;
        clientWidth: number;
        scrollWidth: number;
        items: number;
      }[];
    };

  /** Controls that stick out of the 430 x 600 frame. */
  const outside = (
    controls: { left: number; right: number; top: number; bottom: number }[]
  ) =>
    controls.filter(
      (c) => c.left < 0 || c.right > 430.5 || c.top < 0 || c.bottom > 600.5
    );

  it("fits a busy site into 430px with no horizontal overflow", async () => {
    // One script: the site tab must be the active one when the popup
    // mounts, and every webdriver switch back to the probe tab would make
    // the probe tab active instead.
    siteTabId = (await inProbe(
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
         const cookies = await browser.cookies.getAll({ domain: "localhost", firstPartyDomain: null, partitionKey: {} });
         return cookies.filter((c) => c.name.startsWith("e2e_busy_")).length >= args[1];
       }, "busy cookies");
       const frame = document.createElement("iframe");
       frame.id = "e2ePopupFrame";
       frame.style.cssText = "width: 430px; height: 600px; border: 0; display: block;";
       frame.src = "/popup/popup.html";
       document.body.prepend(frame);
       await until(
         () => frame.contentDocument?.getElementById("siteDataPanel") != null,
         "popup mount"
       );
       return tab.id;`,
      `${fixture.primary}/busy`,
      BUSY_COOKIE_COUNT
    )) as number;

    // The popup describes the busy site, not the probe tab.
    const card = (await inProbe(
      session,
      'return document.getElementById("e2ePopupFrame").contentDocument.body.textContent;'
    )) as string;
    expect(card).toContain("localhost");

    const collapsed = await measure();
    expect(collapsed.width).toBe(430);
    expect(collapsed.scrollWidth).toBeLessThanOrEqual(430);
    // Firefox caps a popup at 600px tall; the default view fits under it.
    expect(collapsed.scrollHeight).toBeLessThanOrEqual(600);
    expect(outside(collapsed.controls)).toEqual([]);
  }, 60000);

  it("scrolls the long site-data lists inside their own sections", async () => {
    // Expand the site-data panel, then its cookie and localStorage rows,
    // once the inventory has been collected.
    await inProbe(
      session,
      `const doc = document.getElementById("e2ePopupFrame").contentDocument;
       doc.getElementById("siteDataPanel").open = true;`
    );
    const expanded = await waitUntil(
      async () =>
        ((await inProbe(
          session,
          `const doc = document.getElementById("e2ePopupFrame").contentDocument;
           const rows = [...doc.querySelectorAll("#siteDataPanel > div > details")];
           const withLists = rows.filter((d) => d.querySelector("ul"));
           withLists.forEach((d) => { d.open = true; });
           return withLists.length;`
        )) as number) >= 2,
      15000
    );
    expect(expanded).toBe(true);

    const open = await measure();
    // Nothing widens the popup, and nothing is pushed out sideways.
    expect(open.scrollWidth).toBeLessThanOrEqual(430);
    expect(
      outside(open.controls).filter((c) => c.left < 0 || c.right > 430.5)
    ).toEqual([]);
    // The cookie and localStorage lists hold every entry, cap their own
    // height and scroll inside, with long names truncated rather than
    // overflowing sideways.
    const busyLists = open.lists.filter((l) => l.items >= BUSY_COOKIE_COUNT);
    expect(busyLists.length).toBeGreaterThanOrEqual(2);
    for (const list of busyLists) {
      expect(["auto", "scroll"]).toContain(list.overflowY);
      expect(list.scrollHeight).toBeGreaterThan(list.clientHeight);
      expect(list.clientHeight).toBeLessThan(300);
      expect(list.scrollWidth).toBeLessThanOrEqual(list.clientWidth);
    }
  }, 60000);
});

describe("Support page: system details and bug-report email (#435, #436)", () => {
  let systemText: string;
  let mailto: string;

  beforeAll(async () => {
    await openSettingsTab("tabSupport", "#debugInfo");
    // The browser and OS lines arrive asynchronously; until then the block
    // shows placeholders.
    await waitUntil(async () => {
      systemText = (await session.driver.executeScript(
        'return document.getElementById("debugInfo").value;'
      )) as string;
      return !systemText.includes("(please add");
    }, 10000);
    mailto = (await session.driver.executeScript(
      `return document.querySelector('a[href^="mailto:"]')?.getAttribute("href") ?? "";`
    )) as string;
  }, 60000);

  it("names the running Firefox and an operating system in the first copy block", async () => {
    const version = (await session.driver.getCapabilities()).get(
      "browserVersion"
    ) as string;
    const lines = systemText.split("\n");
    // ESR builds may add their channel suffix to the same version.
    expect([
      `- Browser: Firefox ${version}`,
      `- Browser: Firefox ${version}esr`,
    ]).toContain(lines[0]);
    expect(lines[1]).toMatch(
      /^- Operating system: (Linux|macOS|Windows|OpenBSD)( \S+)?( \(.+\))?$/
    );
    expect(systemText).not.toContain("(please add");
  });

  it("links a prefilled bug-report email to the support address", async () => {
    const { subject, body, to } = parseMailto(mailto);
    expect(to).toBe(SUPPORT_EMAIL);
    const name = await message("extensionName");
    const manifestVersion = (await inProbe(
      session,
      "return browser.runtime.getManifest().version;"
    )) as string;
    expect(subject).toBe(
      `${await message("emailSubjectText")}: ${name} ${manifestVersion}`
    );
    // The body carries the copy block exactly, with mail-style line breaks.
    expect(body).toContain(systemText.split("\n").join("\r\n"));
    expect(body).toContain(`${name} version: ${manifestVersion}`);
  });
});

/**
 * Splits a mailto: URL into its address and its decoded subject and body.
 * decodeURIComponent, not URLSearchParams: the latter would read a literal
 * "+" as a space.
 */
const parseMailto = (
  href: string
): { to: string; subject: string; body: string } => {
  const match = /^mailto:([^?]*)\?(.*)$/.exec(href);
  if (!match) throw new Error(`not a mailto: URL with fields: ${href}`);
  const fields: Record<string, string> = {};
  for (const pair of match[2].split("&")) {
    const at = pair.indexOf("=");
    fields[pair.slice(0, at)] = decodeURIComponent(pair.slice(at + 1));
  }
  return {
    to: decodeURIComponent(match[1]),
    subject: fields.subject ?? "",
    body: fields.body ?? "",
  };
};

describe("row 17: import an old Cookie AutoDelete export", () => {
  const FIXTURE = resolve("e2e/fixtures/cad-3.8-expressions.json");

  it("lands container lists as their own lists and private entries under Private", async () => {
    await probe(session, {
      kind: "dispatch",
      action: { type: "CLEAR_EXPRESSIONS", payload: {} },
    });
    const cleared = await waitUntil(
      async () => Object.keys(await persistedLists()).length === 0,
      10000
    );
    expect(cleared).toBe(true);

    await openSettingsTab("tabImportExport", 'input[type="file"]');
    const importTitle = await message("importURLSText");
    const input = (await session.driver.executeScript(
      `return [...document.querySelectorAll('input[type="file"]')]
        .find((i) => i.title === arguments[0]) ?? null;`,
      importTitle
    )) as WebElement | null;
    if (!input) throw new Error(`no "${importTitle}" file input`);
    await input.sendKeys(FIXTURE);

    const expected = {
      default: [
        ["plain.example.com", "WHITE"],
        ["main.example.com", "WHITE"],
      ],
      "firefox-container-1": [["personal.example.com", "WHITE"]],
      "firefox-container-4": [["shop.example.com", "GREY"]],
      private: [["secret.example.com", "GREY"]],
    };
    const asPairs = (lists: Record<string, StoredExpression[]>) =>
      Object.fromEntries(
        Object.entries(lists)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, list]) => [
            key,
            list
              .map((e) => [e.expression, e.listType])
              .sort(([a], [b]) => a.localeCompare(b)),
          ])
      );
    const sortedExpected = asPairs(
      Object.fromEntries(
        Object.entries(expected).map(([key, pairs]) => [
          key,
          pairs.map(([expression, listType]) => ({
            expression,
            listType,
            storeId: key,
          })),
        ])
      )
    );
    let lists: Record<string, StoredExpression[]> = {};
    const landed = await waitUntil(async () => {
      lists = await persistedLists();
      return JSON.stringify(asPairs(lists)) === JSON.stringify(sortedExpected);
    }, 10000);
    if (!landed) console.log("row17 lists:", JSON.stringify(lists));
    expect(asPairs(lists)).toEqual(sortedExpected);

    // One success line for all five entries, and no "merged into the
    // default list" line after it.
    const imported = await message("importValidExpressions", [
      "5",
      "cad-3.8-expressions.json",
    ]);
    expect(await alertTexts("success")).toEqual([imported]);
    expect(await alertTexts("error")).toEqual([]);
  }, 60000);
});

// Last: it takes the extension's site access away and back.
describe("row 15: site access revoked and restored", () => {
  /**
   * Changes the <all_urls> grant the way about:addons' "Permissions"
   * toggle does: through ExtensionPermissions, with the running extension
   * passed in so it fires permissions.onRemoved/onAdded.
   */
  const setSiteAccess = async (granted: boolean): Promise<void> => {
    await inChrome(
      session,
      `const { ExtensionPermissions } = ChromeUtils.importESModule(
         "resource://gre/modules/ExtensionPermissions.sys.mjs"
       );
       const extension = WebExtensionPolicy.getByID(args[0]).extension;
       const change = { permissions: [], origins: ["<all_urls>"] };
       if (args[1]) await ExtensionPermissions.add(args[0], change, extension);
       else await ExtensionPermissions.remove(args[0], change, extension);`,
      FIREFOX_ADDON_ID,
      granted
    );
  };

  const access = async () =>
    (await inProbe(
      session,
      `return {
         granted: await browser.permissions.contains({ origins: ["<all_urls>"] }),
         badge: await browser.action.getBadgeText({}),
       };`
    )) as { granted: boolean; badge: string };

  /** Whether the banner shows on a freshly opened popup and settings page. */
  const bannerOnPages = async (): Promise<{
    popup: boolean;
    settings: boolean;
  }> => {
    const result = { popup: false, settings: false };
    const popup = await openExtensionPage("popup/popup.html", "#cadPopup");
    try {
      // The banner reads the stored state right after mount.
      await waitUntil(() => present("#hostPermissionsBanner"), 1500, 250);
      result.popup = await present("#hostPermissionsBanner");
    } finally {
      await closeTab(session, popup);
    }
    const settings = await openExtensionPage(
      "settings/settings.html",
      "main h1"
    );
    try {
      await waitUntil(() => present("#hostPermissionsBanner"), 1500, 250);
      result.settings = await present("#hostPermissionsBanner");
    } finally {
      await closeTab(session, settings);
    }
    return result;
  };

  afterAll(async () => {
    // Leave the grant in place even when a check failed.
    await setSiteAccess(true);
  });

  it("shows the ! badge and both banners, and clears them once access is back", async () => {
    expect(await access()).toEqual({ granted: true, badge: "" });
    expect(await bannerOnPages()).toEqual({ popup: false, settings: false });

    await setSiteAccess(false);
    let state = await access();
    const flagged = await waitUntil(async () => {
      state = await access();
      return !state.granted && state.badge === "!";
    }, 10000);
    if (!flagged) console.log("row15 revoked:", JSON.stringify(state));
    expect(flagged).toBe(true);
    expect(await bannerOnPages()).toEqual({ popup: true, settings: true });

    await setSiteAccess(true);
    const cleared = await waitUntil(async () => {
      state = await access();
      return state.granted && state.badge === "";
    }, 10000);
    if (!cleared) console.log("row15 restored:", JSON.stringify(state));
    expect(cleared).toBe(true);
    expect(await bannerOnPages()).toEqual({ popup: false, settings: false });
  }, 90000);
});
