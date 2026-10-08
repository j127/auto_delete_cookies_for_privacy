/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * Takes the Firefox store screenshots (#486) from the packaged Firefox
 * build, with no mocks: the real popup and settings pages, a real
 * container, and state set through the store bridge the pages use. Run it
 * with `just store_screenshots_firefox`; the PNGs land in
 * docs/store/screenshots/firefox/ (STORE_SHOT_DIR overrides that). The
 * "Store screenshots" workflow runs it on Linux and uploads the PNGs.
 *
 * The site in the popup is www.example.com, resolved to the fixture server
 * through network.dns.localDomains (as row 21 does with adcp.test), so no
 * localhost or port shows. Firefox treats it as a secure context
 * (dom.securecontext.allowlist, plus dom.caches.testing.enabled for the
 * Cache API), as a real https site would be, so the popup can list its
 * cache and storage use instead of "unknown".
 *
 * The popup is the real popup/popup.html in a frame of the probe tab while
 * the site's container tab is the active one, which is the tab the popup
 * asks for on mount (the same approach as row 18 in
 * e2e/specs/extension_pages.e2e.ts). The frame is shown as a card on a
 * soft backdrop, like the Chrome Web Store set.
 */
import { mkdirSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { By } from "selenium-webdriver";
import {
  FirefoxSession,
  inProbe,
  launchFirefox,
  probe,
  stopGeckodriver,
  waitUntil,
} from "../helpers/firefox_driver";
import {
  FixtureServer,
  SHOP_COOKIE_COUNT,
  startFixtureServer,
} from "../helpers/fixture_server";
import {
  BACKDROPS,
  bottomFadeTop,
  cardTop,
  FADE_RAMP,
  FIREFOX_STORE_SHOTS,
  nextWindowSize,
  pngSize,
  POPUP_WIDTH,
  SHOT_THEMES,
  shotFileName,
  ShotTheme,
  STORE_SHOT_SIZE,
} from "../helpers/store_screenshots";

/**
 * The space left above the first card on a scrolled settings page: less
 * than the 16px gap between cards, so no edge of the card above shows.
 */
const SCROLL_MARGIN = 12;

/** The site the popup describes; resolved to the fixture server. */
const SITE_HOST = "www.example.com";
/** How the popup's site card names that site. */
const SITE_SHOWN = "example.com";
/** The container the site is open in, made with contextualIdentities. */
const CONTAINER_NAME = "Travel";
/** The container's own keep list, shown on Saved sites. */
const CONTAINER_RULES = [
  { expression: "*.example.org", listType: "WHITE" },
  { expression: "maps.example.net", listType: "GREY" },
];
/**
 * Sites visited and closed in the default container before the shots, so
 * the Overview's counters come from real cleanups: the store bridge has no
 * way to set them, as the settings page has none.
 */
const VISITED_HOSTS = ["news.example.net", "www.example.org"];

const OUT_DIR = resolve(
  process.env.STORE_SHOT_DIR || "docs/store/screenshots/firefox"
);

let session: FirefoxSession;
let fixture: FixtureServer;
let containerId = "";

const shot = (slug: string) => {
  const found = FIREFOX_STORE_SHOTS.find((s) => s.slug === slug);
  if (!found) throw new Error(`no store shot named ${slug}`);
  return found;
};

/** Screenshots the current tab's viewport as PNG bytes. */
const capture = async (): Promise<Buffer> =>
  Buffer.from(await session.driver.takeScreenshot(), "base64");

/**
 * Resizes the window until a screenshot of the viewport is exactly the
 * store size: the toolbars' share of the window differs between builds.
 */
const sizeViewport = async (): Promise<void> => {
  const window = session.driver.manage().window();
  await window.setRect({ width: STORE_SHOT_SIZE.width, height: 900 });
  for (let attempt = 0; attempt < 4; attempt++) {
    const size = pngSize(await capture());
    if (
      size.width === STORE_SHOT_SIZE.width &&
      size.height === STORE_SHOT_SIZE.height
    ) {
      return;
    }
    const rect = await window.getRect();
    await window.setRect(nextWindowSize(rect, size));
  }
  throw new Error(
    `could not size the viewport to ${STORE_SHOT_SIZE.width}x${STORE_SHOT_SIZE.height}: ${JSON.stringify(pngSize(await capture()))}`
  );
};

/** Saves a screenshot of the current tab, refusing any other size. */
const save = async (file: string): Promise<void> => {
  const png = await capture();
  expect(pngSize(png)).toEqual(STORE_SHOT_SIZE);
  writeFileSync(join(OUT_DIR, file), png);
  // eslint-disable-next-line no-console
  console.log(`wrote ${join(OUT_DIR, file)}`);
};

/** Persists the theme choice the popup and settings page read on load. */
const setTheme = async (theme: ShotTheme): Promise<void> => {
  await inProbe(
    session,
    "await browser.storage.local.set({ themeChoice: args[0] });",
    theme
  );
};

const persistedState = async () =>
  (await probe(session, { kind: "getState" })) as {
    lists?: Record<string, { expression: string }[]>;
    cookieDeletedCounterTotal?: number;
  };

const dispatch = async (action: Record<string, unknown>): Promise<void> => {
  await probe(session, { kind: "dispatch", action });
};

/**
 * Turns the probe tab into one settings page, in the given theme, with the
 * fonts loaded and scrollbars hidden. The app reads the hash only on
 * mount, hence the refresh.
 */
const openSettings = async (hash: string, mountedCss: string) => {
  const { driver, extensionOrigin, probeHandle } = session;
  await driver.switchTo().window(probeHandle);
  await driver.get(`${extensionOrigin}/settings/settings.html#${hash}`);
  await driver.navigate().refresh();
  const mounted = await waitUntil(
    async () => (await driver.findElements(By.css(mountedCss))).length > 0,
    15000
  );
  if (!mounted) throw new Error(`#${hash} never mounted ${mountedCss}`);
  await inProbe(
    session,
    `await document.fonts.ready;
     const style = document.createElement("style");
     style.textContent = "* { scrollbar-width: none !important; }";
     document.head.append(style);
     document.activeElement?.blur();`
  );
};

/** Lets layout, images and transitions settle before a screenshot. */
const settle = () => new Promise((r) => setTimeout(r, 600));

/**
 * Fades out the block the viewport's bottom edge cuts through, if any, so
 * the page reads as continuing rather than ending in half a line of text
 * (see bottomFadeTop). Only the main column fades; the fade ends in the
 * column's own background colour.
 */
const fadeBottomEdge = async (): Promise<void> => {
  const blocks = (await inProbe(
    session,
    `return [...document.querySelectorAll(
       "main section > h2, main section > div > *, main li, main h1, main h2, main p"
     )].map((el) => {
       const r = el.getBoundingClientRect();
       return { top: r.top, bottom: r.bottom };
     });`
  )) as { top: number; bottom: number }[];
  const top = bottomFadeTop(blocks);
  if (top === null) return;
  await inProbe(
    session,
    `const [top, ramp] = args;
     const main = document.querySelector("main");
     let background = "";
     for (let el = main; el && !background; el = el.parentElement) {
       const color = getComputedStyle(el).backgroundColor;
       if (color && color !== "transparent" && color !== "rgba(0, 0, 0, 0)") background = color;
     }
     const column = main.parentElement.getBoundingClientRect();
     const fade = document.createElement("div");
     fade.style.cssText =
       "position: fixed; bottom: 0; top: " + top + "px; left: " + column.left +
       "px; width: " + column.width + "px; pointer-events: none; z-index: 2147483647;" +
       "background: linear-gradient(to bottom, transparent 0px, " + (background || "Canvas") +
       " " + ramp + "px);";
     document.body.append(fade);`,
    top,
    FADE_RAMP
  );
};

beforeAll(async () => {
  mkdirSync(OUT_DIR, { recursive: true });
  fixture = await startFixtureServer();
  session = await launchFirefox({
    "network.dns.localDomains": [SITE_HOST, ...VISITED_HOSTS].join(","),
    "dom.securecontext.allowlist": SITE_HOST,
    // The Cache API checks the scheme itself rather than the secure
    // context, so on plain http it refuses, and the popup would say
    // "unknown" where a real https site shows a count. This lets the
    // fixture stand in for an https site there too.
    "dom.caches.testing.enabled": true,
    // The fixture speaks plain http on a high port; don't let HTTPS-First
    // try TLS on it first.
    "dom.security.https_first": false,
    "dom.security.https_first_schemeless": false,
  });
  await sizeViewport();

  // Automatic cleaning on, so the pages show the extension at work, and
  // separate keep lists per container, the Firefox feature on show.
  const applied = (await probe(session, {
    kind: "updateSettings",
    settings: { activeMode: true, contextualIdentities: true },
  })) as Record<string, unknown>;
  expect(applied).toEqual({ activeMode: true, contextualIdentities: true });

  const created = (await probe(session, {
    kind: "createContainer",
    name: CONTAINER_NAME,
  })) as { cookieStoreId?: string; error?: string };
  if (!created.cookieStoreId) {
    throw new Error(`container not created: ${created.error}`);
  }
  containerId = created.cookieStoreId;

  for (const rule of CONTAINER_RULES) {
    await dispatch({
      type: "ADD_EXPRESSION",
      payload: { ...rule, storeId: containerId },
    });
  }
  // The background persists on a one-second debounce.
  const seeded = await waitUntil(
    async () =>
      ((await persistedState()).lists?.[containerId] ?? []).length >=
      CONTAINER_RULES.length,
    10000
  );
  if (!seeded) {
    throw new Error(
      `state not seeded: ${JSON.stringify(await persistedState())}`
    );
  }

  // Visit and close a few sites with a one-second grace period, so the
  // Overview counts cookies that cleanups really deleted; then put the
  // default 15 seconds back, which the popup quotes.
  await probe(session, {
    kind: "updateSettings",
    settings: { delayBeforeClean: 1 },
  });
  for (const host of VISITED_HOSTS) {
    await inProbe(
      session,
      `const tab = await browser.tabs.create({ url: args[0], active: false });
       const deadline = Date.now() + 20000;
       for (;;) {
         const t = await browser.tabs.get(tab.id);
         if (t.status === "complete" && t.title === "ready") break;
         if (Date.now() > deadline) throw new Error("did not load: " + args[0]);
         await new Promise((r) => setTimeout(r, 200));
       }
       await browser.tabs.remove(tab.id);`,
      `http://${host}:${fixture.port}/shop`
    );
  }
  const counted = await waitUntil(
    async () =>
      ((await persistedState()).cookieDeletedCounterTotal ?? 0) >=
      VISITED_HOSTS.length * SHOP_COOKIE_COUNT,
    60000,
    1000
  );
  if (!counted) {
    throw new Error(
      `cleanups not counted: ${(await persistedState()).cookieDeletedCounterTotal}`
    );
  }
  const restored = (await probe(session, {
    kind: "updateSettings",
    settings: { delayBeforeClean: 15 },
  })) as Record<string, unknown>;
  expect(restored).toEqual({ delayBeforeClean: 15 });

  // The popup reads the container's name from the background's session
  // cache, which the background fills as the container is created.
  const cached = await waitUntil(
    async () =>
      ((await inProbe(
        session,
        `const stored = await browser.storage.session.get("containerCache");
         return Boolean(stored.containerCache?.[args[0]]);`,
        containerId
      )) as boolean) === true,
    10000
  );
  if (!cached) throw new Error("the container never reached the popup's cache");
}, 180000);

afterAll(async () => {
  await session?.quit();
  stopGeckodriver();
  await fixture?.stop();
});

describe.each(SHOT_THEMES)("Firefox store screenshots, %s theme", (theme) => {
  beforeAll(async () => {
    await setTheme(theme);
  });

  it("01: the popup for a site in a container tab", async () => {
    const url = `http://${SITE_HOST}:${fixture.port}/shop`;
    const backdrop = BACKDROPS[theme];
    // One script: the site's tab must be the active one when the popup
    // mounts, and every webdriver switch back to the probe tab would make
    // the probe tab active instead.
    const tabId = (await inProbe(
      session,
      `const [url, storeId, cookieCount, backdrop, width] = args;
       const until = async (check, what) => {
         const deadline = Date.now() + 20000;
         while (!(await check())) {
           if (Date.now() > deadline) throw new Error("timed out: " + what);
           await new Promise((r) => setTimeout(r, 200));
         }
       };
       const tab = await browser.tabs.create({ url, active: true, cookieStoreId: storeId });
       await until(async () => {
         const t = await browser.tabs.get(tab.id);
         return t.status === "complete" && t.title === "ready";
       }, "site load");
       await until(async () => {
         const cookies = await browser.cookies.getAll({ storeId, domain: "example.com" });
         return cookies.length >= cookieCount;
       }, "site cookies");
       document.documentElement.style.overflow = "hidden";
       const stage = document.createElement("div");
       stage.id = "storeShotStage";
       stage.style.cssText =
         "position: fixed; inset: 0; z-index: 2147483647; background: " + backdrop.background + ";";
       const card = document.createElement("div");
       card.id = "storeShotCard";
       card.style.cssText =
         "position: absolute; left: 50%; top: 0; width: " + width + "px; margin-left: -" + width / 2 +
         "px; border-radius: 16px; overflow: hidden; box-shadow: " + backdrop.shadow + ";";
       const frame = document.createElement("iframe");
       frame.id = "storeShotPopup";
       frame.style.cssText = "display: block; width: " + width + "px; height: 760px; border: 0;";
       frame.src = "/popup/popup.html";
       card.append(frame);
       stage.append(card);
       document.body.append(stage);
       await until(
         () => frame.contentDocument?.getElementById("siteDataPanel") != null,
         "popup mount"
       );
       return tab.id;`,
      url,
      containerId,
      SHOP_COOKIE_COUNT,
      backdrop,
      POPUP_WIDTH
    )) as number;

    try {
      // Open only the site-data panel: a blanket "open every details" would
      // open the Share menu over the header too.
      await inProbe(
        session,
        `const doc = document.getElementById("storeShotPopup").contentDocument;
         doc.getElementById("siteDataPanel").open = true;`
      );
      const ready = await waitUntil(
        async () =>
          (await inProbe(
            session,
            `const doc = document.getElementById("storeShotPopup").contentDocument;
             const rows = doc.querySelectorAll("#siteDataPanel > div > details");
             const count = Number(doc.getElementById("siteCookieCount")?.textContent);
             return rows.length >= 6 &&
               count >= args[0] &&
               doc.getElementById("containerBadge") != null;`,
            SHOP_COOKIE_COUNT
          )) as boolean,
        20000
      );
      const text = (await inProbe(
        session,
        `return document.getElementById("storeShotPopup").contentDocument.body.innerText;`
      )) as string;
      // eslint-disable-next-line no-console
      if (!ready) console.log("popup text:", text);
      expect(ready).toBe(true);
      // The popup describes the container tab's site, and nothing shows
      // the fixture server's real address.
      // (The site card names the host without its "www.")
      const lines = text.split("\n").map((line) => line.trim());
      expect(lines).toContain(SITE_SHOWN);
      expect(lines).toContain(CONTAINER_NAME);
      expect(text).not.toMatch(/localhost|127\.0\.0\.1|:\d{4,5}\b/);

      const height = (await inProbe(
        session,
        `const frame = document.getElementById("storeShotPopup");
         const doc = frame.contentDocument;
         await doc.fonts.ready;
         const style = doc.createElement("style");
         style.textContent =
           "html { min-width: 0 !important; overflow: hidden !important; scrollbar-width: none !important; }";
         doc.head.append(style);
         return Math.ceil(doc.getElementById("cadPopup").getBoundingClientRect().bottom);`
      )) as number;
      await inProbe(
        session,
        `const frame = document.getElementById("storeShotPopup");
         frame.style.height = args[0] + "px";
         document.getElementById("storeShotCard").style.top = args[1] + "px";`,
        height,
        cardTop(height)
      );
      await settle();
      await save(shotFileName(shot("popup"), theme));
    } finally {
      await inProbe(
        session,
        `document.getElementById("storeShotStage")?.remove();
         document.documentElement.style.overflow = "";
         await browser.tabs.remove(args[0]);`,
        tabId
      );
    }
  }, 120000);

  it("02: the Protection page's Firefox containers card", async () => {
    await openSettings("tabSettings", "main h1");
    const heading = (await inProbe(
      session,
      'return browser.i18n.getMessage("settingGroupContainers");'
    )) as string;
    // Scroll the card before the containers card to the top, so both are
    // whole and no card is cut at the top edge.
    const found = (await inProbe(
      session,
      `const heading = [...document.querySelectorAll("main h2")].find(
         (el) => el.textContent.trim() === args[0]
       );
       const card = heading?.closest("section");
       const before = card?.previousElementSibling;
       if (!before) return false;
       const scroller = document.scrollingElement;
       scroller.scrollTop += before.getBoundingClientRect().top - args[1];
       const box = card.getBoundingClientRect();
       return box.top >= 0 && box.bottom <= window.innerHeight;`,
      heading,
      SCROLL_MARGIN
    )) as boolean;
    expect(found).toBe(true);
    await fadeBottomEdge();
    await settle();
    await save(shotFileName(shot("protection"), theme));
  }, 60000);

  it("03: Saved sites on the container's own list", async () => {
    await openSettings("tabExpressionList", "#storeIdSelector");
    const shown = await waitUntil(
      async () =>
        (await inProbe(
          session,
          `const select = document.getElementById("storeIdSelector");
           if (![...select.options].some((o) => o.value === args[0])) return false;
           if (select.value !== args[0]) {
             select.value = args[0];
             select.dispatchEvent(new Event("change", { bubbles: true }));
           }
           const text = document.querySelector("main").innerText;
           return args[1].every((rule) => text.includes(rule));`,
          containerId,
          CONTAINER_RULES.map((r) => r.expression)
        )) as boolean,
      15000
    );
    expect(shown).toBe(true);
    await inProbe(session, "document.activeElement?.blur();");
    await settle();
    await save(shotFileName(shot("saved-sites"), theme));
  }, 60000);

  it("04: the Overview with the release notes", async () => {
    await openSettings("tabWelcome", "#statTotal");
    const total = await session.driver
      .findElement(By.css("#statTotal"))
      .getText();
    const state = await persistedState();
    expect(total).toBe(String(state.cookieDeletedCounterTotal));
    expect(Number(total)).toBeGreaterThan(0);
    await fadeBottomEdge();
    await settle();
    await save(shotFileName(shot("overview"), theme));
  }, 60000);
});
