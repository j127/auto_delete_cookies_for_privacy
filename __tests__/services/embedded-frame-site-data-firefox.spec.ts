/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * Issue #504: storage a cross-site frame writes (a video player embedded
 * in another site's page) was never cleaned on Firefox unless the frame's
 * host also owned a cookie. Firefox clears storage by host, so the frame's
 * host has to be named, and it only is when a cookie of that host is
 * cleaned. Each cross-site frame host now holds a marker cookie in the
 * partition of the site that embeds it (TabEvents.onFrameResponse).
 *
 * These specs run cleanup against the Gecko-semantics cookie jar and check
 * what follows from such a marker: the frame host's storage is wiped once
 * the embedding site is closed, but not while the host's own site is open
 * or another open site still embeds it, because a wipe by host empties
 * every one of those. A marker whose wipe was skipped stays, so the next
 * cleanup tries again.
 */
import { when } from "jest-when";
import { installGeckoCookieMock } from "../gecko-flavor";

vi.stubGlobal("__BROWSER__", "firefox");
vi.resetModules();
const { initialState } = await import("@/redux/state");
const {
  cleanCookiesOperation,
  isDomainInUseInAnyStore,
  isDomainProtectedInAnyStore,
  isMarkerHeldForLaterWipe,
  mainDomainsEmbeddedInOpenSites,
} = await import("@/services/cleanup-service");
const { ADCPCOOKIENAME } = await import("@/services/libs");
const { ListType, OpenTabStatus, ReasonClean, ReasonKeep, SiteDataType } =
  await import("@/typings/enums");

const PLAYER = "www.player.example";

const fxCookie = (
  overrides: Partial<browser.cookies.Cookie> & { domain: string }
): browser.cookies.Cookie => ({
  firstPartyDomain: "",
  hostOnly: true,
  httpOnly: false,
  name: "c",
  path: "/",
  sameSite: "no_restriction",
  secure: false,
  session: false,
  storeId: "firefox-default",
  value: "v",
  ...overrides,
});

/** The player's marker as a frame of topLevelSite, or its own without one. */
const marker = (
  topLevelSite?: string,
  storeId = "firefox-default"
): browser.cookies.Cookie =>
  fxCookie({
    domain: PLAYER,
    name: ADCPCOOKIENAME,
    path: `/${topLevelSite ?? "own"}`,
    storeId,
    value: ADCPCOOKIENAME,
    ...(topLevelSite && { partitionKey: { topLevelSite } }),
  });

const openTabs = (...tabs: { url: string; cookieStoreId?: string }[]): void => {
  when(global.browser.tabs.query)
    .calledWith(expect.any(Object))
    .mockResolvedValue(
      tabs.map((tab, index) => ({
        active: index === 0,
        cookieStoreId: "firefox-default",
        discarded: false,
        highlighted: false,
        incognito: false,
        index,
        pinned: false,
        windowId: 1,
        ...tab,
      })) as never
    );
};

const runCleanup = (ignoreOpenTabs = false) =>
  cleanCookiesOperation(initialState, { greyCleanup: false, ignoreOpenTabs });

/** Every hostname a storage wipe of this run named. */
const wipedHostnames = (): string[] =>
  global.browser.browsingData.remove.mock.calls.flatMap(
    (call: { hostnames?: string[] }[]) => call[0].hostnames ?? []
  );

/** The partitions (or "own") the jar still holds a player marker for. */
const markersLeft = (jar: { cookies: browser.cookies.Cookie[] }): string[] =>
  jar.cookies
    .filter((c) => c.name === ADCPCOOKIENAME)
    .map((c) => `${c.storeId}:${c.partitionKey?.topLevelSite ?? "own"}`);

describe("cross-site frame storage on Firefox (#504)", () => {
  beforeEach(() => {
    openTabs();
    when(global.browser.extension.isAllowedIncognitoAccess)
      .calledWith()
      .mockResolvedValue(false as never);
    when(global.browser.cookies.getAllCookieStores)
      .calledWith()
      .mockResolvedValue([{ id: "firefox-default" }] as never);
    when(global.browser.contextualIdentities.query)
      .calledWith(expect.any(Object))
      .mockResolvedValue([] as never);
  });

  it("wipes a cookie-less frame host once the embedding site is closed", async () => {
    const jar = installGeckoCookieMock();
    jar.seed(marker("https://reddit.example"));
    const result = await runCleanup();
    expect(jar.cookies).toHaveLength(0);
    expect(wipedHostnames()).toEqual(expect.arrayContaining([PLAYER]));
    expect(result.cachedResults.browsingDataCleanup.LocalStorage).toEqual([
      PLAYER,
    ]);
    // The marker is the extension's own cookie; it is not a cleaned cookie.
    expect(result.cachedResults.recentlyCleaned).toBe(0);
  });

  it("leaves the frame host alone while the embedding site is open", async () => {
    const jar = installGeckoCookieMock();
    jar.seed(marker("https://reddit.example"));
    openTabs({ url: "https://www.reddit.example/r/videos" });
    await runCleanup();
    expect(markersLeft(jar)).toEqual([
      "firefox-default:https://reddit.example",
    ]);
    expect(global.browser.browsingData.remove).not.toHaveBeenCalled();
  });

  it("matches the frame host's own keep rule, not the embedding site's", async () => {
    const withRule = (expression: string): State => ({
      ...initialState,
      lists: {
        default: [{ expression, listType: ListType.WHITE, storeId: "default" }],
      },
    });
    // A rule for the embedding site keeps that site's data only (#490).
    let jar = installGeckoCookieMock();
    jar.seed(marker("https://reddit.example"));
    await cleanCookiesOperation(withRule("*.reddit.example"), {
      greyCleanup: false,
      ignoreOpenTabs: false,
    });
    expect(wipedHostnames()).toEqual(expect.arrayContaining([PLAYER]));

    global.browser.browsingData.remove.mockClear();
    jar = installGeckoCookieMock();
    jar.seed(marker("https://reddit.example"));
    await cleanCookiesOperation(withRule("*.player.example"), {
      greyCleanup: false,
      ignoreOpenTabs: false,
    });
    expect(wipedHostnames()).not.toContain(PLAYER);
  });

  describe("while the frame host is still in use elsewhere", () => {
    it("skips the wipe and keeps the marker while another open site embeds the host", async () => {
      const jar = installGeckoCookieMock();
      jar.seed(
        marker("https://reddit.example"),
        marker("https://news.example")
      );
      openTabs({ url: "https://news.example/story" });
      await runCleanup();
      expect(global.browser.browsingData.remove).not.toHaveBeenCalled();
      expect(markersLeft(jar).sort()).toEqual([
        "firefox-default:https://news.example",
        "firefox-default:https://reddit.example",
      ]);

      // The other site closes too: the next cleanup wipes for both.
      openTabs();
      await runCleanup();
      expect(jar.cookies).toHaveLength(0);
      expect(wipedHostnames()).toEqual(expect.arrayContaining([PLAYER]));
    });

    it("skips the wipe and keeps the marker while the host's own site is open in a tab", async () => {
      const jar = installGeckoCookieMock();
      jar.seed(marker("https://reddit.example"));
      openTabs({ url: "https://www.player.example/watch" });
      await runCleanup();
      expect(global.browser.browsingData.remove).not.toHaveBeenCalled();
      expect(markersLeft(jar)).toEqual([
        "firefox-default:https://reddit.example",
      ]);

      openTabs();
      await runCleanup();
      expect(jar.cookies).toHaveLength(0);
      expect(wipedHostnames()).toEqual(expect.arrayContaining([PLAYER]));
    });

    it("counts an embedding site that is open in another container", async () => {
      when(global.browser.contextualIdentities.query)
        .calledWith(expect.any(Object))
        .mockResolvedValue([
          { cookieStoreId: "firefox-container-9", name: "Work" },
        ] as never);
      const jar = installGeckoCookieMock();
      jar.seed(
        marker("https://reddit.example"),
        marker("https://news.example", "firefox-container-9")
      );
      openTabs({
        cookieStoreId: "firefox-container-9",
        url: "https://news.example/story",
      });
      await runCleanup();
      expect(global.browser.browsingData.remove).not.toHaveBeenCalled();
      expect(markersLeft(jar).sort()).toEqual([
        "firefox-container-9:https://news.example",
        "firefox-default:https://reddit.example",
      ]);
    });

    it("still removes the host's cookies, and keeps its own marker for the later wipe", async () => {
      // The player's own tab closed; a still-open site embeds the player.
      const jar = installGeckoCookieMock();
      jar.seed(
        fxCookie({ domain: ".player.example", hostOnly: false, name: "sid" }),
        marker(),
        marker("https://news.example")
      );
      openTabs({ url: "https://news.example/story" });
      const result = await runCleanup();
      expect(jar.cookies.map((c) => c.name)).toEqual([
        ADCPCOOKIENAME,
        ADCPCOOKIENAME,
      ]);
      expect(result.cachedResults.recentlyCleaned).toBe(1);
      expect(global.browser.browsingData.remove).not.toHaveBeenCalled();

      openTabs();
      await runCleanup();
      expect(jar.cookies).toHaveLength(0);
      expect(wipedHostnames()).toEqual(expect.arrayContaining([PLAYER]));
    });

    it("does not let one closed site's leftover marker protect the host for another", async () => {
      // Both embedding sites are closed; the host is in use nowhere.
      const jar = installGeckoCookieMock();
      jar.seed(
        marker("https://reddit.example"),
        marker("https://news.example")
      );
      await runCleanup();
      expect(jar.cookies).toHaveLength(0);
      expect(wipedHostnames()).toEqual(expect.arrayContaining([PLAYER]));
    });

    it("wipes anyway when the cleanup ignores open tabs", async () => {
      const jar = installGeckoCookieMock();
      jar.seed(
        marker("https://reddit.example"),
        marker("https://news.example")
      );
      openTabs({ url: "https://news.example/story" });
      await runCleanup(true);
      expect(jar.cookies).toHaveLength(0);
      expect(wipedHostnames()).toEqual(expect.arrayContaining([PLAYER]));
    });
  });
});

describe("in-use checks behind the storage wipe guard", () => {
  const reasonObject = (
    cookie: browser.cookies.Cookie,
    reason: ReasonKeep | ReasonClean,
    mainDomain: string
  ): CleanReasonObject => ({
    cached: false,
    cleanCookie: reason !== ReasonKeep.OpenTabs,
    cookie: {
      ...cookie,
      hostname: cookie.domain.replace(/^\.?(www\.)?/, ""),
      mainDomain,
      preparedCookieDomain: `http://${cookie.domain}${cookie.path}`,
    },
    openTabStatus: OpenTabStatus.TabsWasNotIgnored,
    reason,
  });
  const keptForOpenTab = (cookie: browser.cookies.Cookie, site: string) =>
    reasonObject(cookie, ReasonKeep.OpenTabs, site);
  const toClean = (cookie: browser.cookies.Cookie, site: string) =>
    reasonObject(cookie, ReasonClean.NoMatchedExpression, site);

  describe("mainDomainsEmbeddedInOpenSites()", () => {
    it("collects the hosts whose partitioned marker an open tab protects", () => {
      expect(
        mainDomainsEmbeddedInOpenSites([
          keptForOpenTab(marker("https://news.example"), "news.example"),
        ])
      ).toEqual(new Set(["player.example"]));
    });

    it("ignores markers of closed sites, hosts' own markers and real cookies", () => {
      expect(
        mainDomainsEmbeddedInOpenSites([
          // The embedding site is closed: the marker is being cleaned.
          toClean(marker("https://reddit.example"), "reddit.example"),
          // The host's own marker, kept because the host's site is open.
          keptForOpenTab(marker(), "player.example"),
          // A tracker's cookie under an open site says nothing of frames.
          keptForOpenTab(
            fxCookie({
              domain: "tracker.example",
              partitionKey: { topLevelSite: "https://news.example" },
            }),
            "news.example"
          ),
        ])
      ).toEqual(new Set());
    });
  });

  describe("isDomainInUseInAnyStore()", () => {
    const embedded = new Set(["player.example"]);

    it("is true for a site that is open in any store's tab", () => {
      const tabs = { "firefox-container-9": ["shop.example"] };
      expect(isDomainInUseInAnyStore(tabs, new Set(), ".shop.example")).toBe(
        true
      );
      expect(isDomainInUseInAnyStore(tabs, new Set(), "cdn.shop.example")).toBe(
        true
      );
    });

    it("is true for any host of a site that an open site embeds", () => {
      expect(isDomainInUseInAnyStore({}, embedded, PLAYER)).toBe(true);
      expect(isDomainInUseInAnyStore({}, embedded, ".player.example")).toBe(
        true
      );
    });

    it("is false for other sites and blank domains", () => {
      expect(isDomainInUseInAnyStore({}, embedded, "other.example")).toBe(
        false
      );
      expect(isDomainInUseInAnyStore({}, embedded, " ")).toBe(false);
    });
  });

  describe("isMarkerHeldForLaterWipe()", () => {
    const embedded = new Set(["player.example"]);

    it("holds a marker that would be removed while its host is in use", () => {
      expect(
        isMarkerHeldForLaterWipe(
          toClean(marker("https://reddit.example"), "reddit.example"),
          {},
          embedded
        )
      ).toBe(true);
      expect(
        isMarkerHeldForLaterWipe(
          toClean(marker(), "player.example"),
          { "firefox-container-9": ["player.example"] },
          new Set()
        )
      ).toBe(true);
    });

    it("holds nothing else", () => {
      // Not in use anywhere.
      expect(
        isMarkerHeldForLaterWipe(
          toClean(marker("https://reddit.example"), "reddit.example"),
          {},
          new Set()
        )
      ).toBe(false);
      // A real cookie of the host is removed as always.
      expect(
        isMarkerHeldForLaterWipe(
          toClean(fxCookie({ domain: PLAYER }), "player.example"),
          {},
          embedded
        )
      ).toBe(false);
      // A marker cleanup keeps anyway.
      expect(
        isMarkerHeldForLaterWipe(
          keptForOpenTab(marker("https://news.example"), "news.example"),
          {},
          embedded
        )
      ).toBe(false);
    });
  });

  describe("isDomainProtectedInAnyStore()", () => {
    it("protects a domain an open site embeds, for every site-data type", () => {
      const embedded = new Set(["player.example"]);
      for (const type of [
        SiteDataType.INDEXEDDB,
        SiteDataType.LOCALSTORAGE,
        SiteDataType.SERVICEWORKERS,
      ]) {
        expect(
          isDomainProtectedInAnyStore(initialState, {}, PLAYER, type, embedded)
        ).toBe(true);
      }
    });

    it("protects nothing more without embedded domains", () => {
      expect(
        isDomainProtectedInAnyStore(
          initialState,
          {},
          PLAYER,
          SiteDataType.LOCALSTORAGE
        )
      ).toBe(false);
    });
  });
});
