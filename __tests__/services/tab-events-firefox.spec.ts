/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2017-2022 Kenny Do and CAD Team; fork changes (c) 2026 j127.
 * Licensed under MIT (see LICENSE).
 */

/**
 * Firefox-flavored marker-cookie specs: the ADCP marker cookies.set must
 * carry a firstPartyDomain exactly when First-Party Isolation is on (a set
 * without it rejects under FPI; a set with it rejects with FPI off).
 * __BROWSER__ is stubbed before the module graph loads so the capability
 * map, the FPI probe, and TabEvents all bind to the firefox flavor.
 */
import { when } from "jest-when";
import { SettingID } from "@/typings/enums";
import { ReduxConstants } from "@/typings/redux-constants";

vi.stubGlobal("__BROWSER__", "firefox");
vi.resetModules();
const { initialState } = await import("@/redux/state");
const { updateSetting } = await import("@/redux/actions");
const { default: createStore } = await import("@/redux/store");
const { default: StoreUser } = await import("@/services/store-user");
const { default: TabEvents } = await import("@/services/tab-events");
const { FPI_SESSION_KEY } = await import("@/services/first-party-isolation");

const store = createStore(initialState);
StoreUser.init(store);

const firefoxTab: browser.tabs.Tab = {
  active: true,
  cookieStoreId: "firefox-default",
  discarded: false,
  hidden: false,
  highlighted: false,
  incognito: false,
  index: 0,
  isArticle: false,
  isInReaderMode: false,
  lastAccessed: 12345678,
  pinned: false,
  url: "https://sub.cookie.net/page",
  windowId: 1,
};

describe("TabEvents.getAllCookieActions marker cookie on Firefox", () => {
  beforeEach(() => {
    // The dynamically imported module graph runs the REAL badge/title
    // painters (static spies from other suites do not bind to it), so the
    // underlying action APIs must behave.
    when(global.browser.runtime.getManifest)
      .calledWith()
      .mockReturnValue({ name: "ADCP", version: "1.0.0" } as never);
    when(global.browser.action.getTitle)
      .calledWith(expect.any(Object))
      .mockResolvedValue("ADCP 1.0.0" as never);
    global.browser.action.setTitle.mockResolvedValue(undefined as never);
    global.browser.action.setBadgeText.mockResolvedValue(undefined as never);
    global.browser.action.setBadgeTextColor.mockResolvedValue(
      undefined as never
    );
    global.browser.action.setBadgeBackgroundColor.mockResolvedValue(
      undefined as never
    );
    global.browser.action.setIcon.mockResolvedValue(undefined as never);
    store.dispatch({ type: ReduxConstants.RESET_SETTINGS });
    // CLEANUP_CACHE on → a cookie-less site gets the marker cookie.
    store.dispatch(
      updateSetting({ name: SettingID.CLEANUP_CACHE, value: true })
    );
    // Default implementation: partition-bucket queries (and anything
    // untrained) resolve empty; specific trainings below still win.
    global.browser.cookies.getAll.mockResolvedValue([] as never);
    // The site has no cookies (enumeration carries firstPartyDomain: null
    // and partitionKey: {}).
    when(global.browser.cookies.getAll)
      .calledWith({
        domain: "sub.cookie.net",
        storeId: "firefox-default",
        firstPartyDomain: null,
        partitionKey: {},
      })
      .mockResolvedValue([] as never);
    when(global.browser.cookies.set)
      .calledWith(expect.any(Object))
      .mockResolvedValue({} as never);
  });

  it("sets the marker WITH firstPartyDomain when FPI is on", async () => {
    when(global.browser.storage.session.get)
      .calledWith(FPI_SESSION_KEY)
      .mockResolvedValue({ [FPI_SESSION_KEY]: true } as never);
    await TabEvents.getAllCookieActions(firefoxTab);
    expect(global.browser.cookies.set).toHaveBeenCalledWith(
      expect.objectContaining({
        firstPartyDomain: "cookie.net",
        storeId: "firefox-default",
        url: firefoxTab.url,
      })
    );
  });

  it("sets the marker WITHOUT firstPartyDomain when FPI is off", async () => {
    when(global.browser.storage.session.get)
      .calledWith(FPI_SESSION_KEY)
      .mockResolvedValue({ [FPI_SESSION_KEY]: false } as never);
    await TabEvents.getAllCookieActions(firefoxTab);
    expect(global.browser.cookies.set).toHaveBeenCalledTimes(1);
    const setDetails = global.browser.cookies.set.mock.calls[0][0];
    expect(setDetails).not.toHaveProperty("firstPartyDomain");
  });

  it("does not re-set the marker when enumeration already finds it (round-trip)", async () => {
    when(global.browser.storage.session.get)
      .calledWith(FPI_SESSION_KEY)
      .mockResolvedValue({ [FPI_SESSION_KEY]: true } as never);
    const markerCookie: browser.cookies.Cookie = {
      domain: "sub.cookie.net",
      firstPartyDomain: "cookie.net",
      hostOnly: true,
      httpOnly: false,
      name: "ADCPBrowsingDataCleanup",
      path: "/x",
      sameSite: "no_restriction",
      secure: true,
      session: false,
      storeId: "firefox-default",
      value: "ADCPBrowsingDataCleanup",
    };
    when(global.browser.cookies.getAll)
      .calledWith({
        domain: "sub.cookie.net",
        storeId: "firefox-default",
        firstPartyDomain: null,
        partitionKey: {},
      })
      .mockResolvedValue([markerCookie] as never);
    await TabEvents.getAllCookieActions(firefoxTab);
    expect(global.browser.cookies.set).not.toHaveBeenCalled();
  });

  // #504: the same host can hold a marker as a cross-site frame of another
  // site. That one is cleaned with the embedding site, so the page still
  // needs a marker of its own.
  it("sets the page's own marker when its host only has one as another site's frame", async () => {
    when(global.browser.storage.session.get)
      .calledWith(FPI_SESSION_KEY)
      .mockResolvedValue({ [FPI_SESSION_KEY]: false } as never);
    when(global.browser.cookies.getAll)
      .calledWith({
        domain: "sub.cookie.net",
        storeId: "firefox-default",
        firstPartyDomain: null,
        partitionKey: {},
      })
      .mockResolvedValue([
        {
          domain: "sub.cookie.net",
          firstPartyDomain: "",
          hostOnly: true,
          httpOnly: false,
          name: "ADCPBrowsingDataCleanup",
          partitionKey: { topLevelSite: "https://embedder.example" },
          path: "/x",
          sameSite: "no_restriction",
          secure: false,
          session: false,
          storeId: "firefox-default",
          value: "ADCPBrowsingDataCleanup",
        },
      ] as never);
    await TabEvents.getAllCookieActions(firefoxTab);
    expect(global.browser.cookies.set).toHaveBeenCalledTimes(1);
    expect(global.browser.cookies.set.mock.calls[0][0]).not.toHaveProperty(
      "partitionKey"
    );
  });
});

describe("TabEvents.onFrameResponse on Firefox", () => {
  // Firefox reports the store, the private flag and the frame's ancestors
  // with every request, so no tab lookup is needed.
  const frame = (
    url: string,
    extra: Partial<browser.webRequest.FrameResponseDetails> = {}
  ): browser.webRequest.FrameResponseDetails => ({
    cookieStoreId: "firefox-container-1",
    frameAncestors: [{ url: "https://www.cookie.net/", frameId: 0 }],
    incognito: false,
    tabId: 3,
    type: "sub_frame",
    url,
    ...extra,
  });

  const setFpi = (on: boolean) =>
    when(global.browser.storage.session.get)
      .calledWith(FPI_SESSION_KEY)
      .mockResolvedValue({ [FPI_SESSION_KEY]: on } as never);

  beforeEach(() => {
    store.dispatch({ type: ReduxConstants.RESET_SETTINGS });
    global.browser.cookies.getAll.mockResolvedValue([] as never);
    when(global.browser.cookies.set)
      .calledWith(expect.any(Object))
      .mockResolvedValue({} as never);
    // jest-when trainings outlive a test; every case starts with FPI off.
    setFpi(false);
  });

  it("checks the frame against its top-level ancestor, in the request's store", async () => {
    await TabEvents.onFrameResponse(frame("https://devicebind.cookie.net/x"));
    expect(global.browser.tabs.get).not.toHaveBeenCalled();
    expect(global.browser.cookies.getAll).toHaveBeenCalledWith({
      domain: "devicebind.cookie.net",
      firstPartyDomain: null,
      name: "ADCPBrowsingDataCleanup",
      storeId: "firefox-container-1",
    });
    expect(global.browser.cookies.set).toHaveBeenCalledWith(
      expect.objectContaining({
        storeId: "firefox-container-1",
        url: "https://devicebind.cookie.net/x",
      })
    );
  });

  it("uses the frame's registrable domain as firstPartyDomain under FPI", async () => {
    setFpi(true);
    await TabEvents.onFrameResponse(frame("https://devicebind.cookie.net/x"));
    expect(global.browser.cookies.set).toHaveBeenCalledWith(
      expect.objectContaining({ firstPartyDomain: "cookie.net" })
    );
  });

  // #504: Firefox clears storage by host, so a cross-site frame's storage
  // is only reached through a cookie on the frame's own host.
  describe("cross-site frames", () => {
    const embedded = (
      url = "https://www.player.example/embed/1",
      top = "https://www.cookie.net/watch"
    ) => frame(url, { frameAncestors: [{ url: top, frameId: 0 }] });
    const partitionedMarker = (topLevelSite: string) => ({
      domain: "www.player.example",
      name: "ADCPBrowsingDataCleanup",
      partitionKey: { topLevelSite },
    });
    const lookup = {
      domain: "www.player.example",
      firstPartyDomain: null,
      name: "ADCPBrowsingDataCleanup",
      partitionKey: {},
      storeId: "firefox-container-1",
    };

    it("marks the frame's host in the partition of the top-level site", async () => {
      await TabEvents.onFrameResponse(embedded());
      expect(global.browser.cookies.getAll).toHaveBeenCalledWith(lookup);
      expect(global.browser.cookies.set).toHaveBeenCalledTimes(1);
      expect(global.browser.cookies.set).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "ADCPBrowsingDataCleanup",
          partitionKey: { topLevelSite: "https://cookie.net" },
          storeId: "firefox-container-1",
          url: "https://www.player.example/embed/1",
        })
      );
      expect(global.browser.cookies.set.mock.calls[0][0]).not.toHaveProperty(
        "firstPartyDomain"
      );
    });

    it("takes the partition from the top-level page, not the frame's parent", async () => {
      await TabEvents.onFrameResponse(
        frame("https://www.player.example/embed/1", {
          frameAncestors: [
            { url: "https://ads.middle.example/slot", frameId: 4 },
            { url: "https://www.cookie.net/", frameId: 0 },
          ],
        })
      );
      expect(global.browser.cookies.set).toHaveBeenCalledWith(
        expect.objectContaining({
          partitionKey: { topLevelSite: "https://cookie.net" },
        })
      );
    });

    it("keeps a port the top-level page carries (#432)", async () => {
      await TabEvents.onFrameResponse(
        embedded("http://127.0.0.1:8080/iframe-set", "http://localhost:8080/")
      );
      expect(global.browser.cookies.set).toHaveBeenCalledWith(
        expect.objectContaining({
          partitionKey: { topLevelSite: "http://localhost:8080" },
          url: "http://127.0.0.1:8080/iframe-set",
        })
      );
    });

    it("does not mark a host again that has a marker in that partition", async () => {
      when(global.browser.cookies.getAll)
        .calledWith(lookup)
        .mockResolvedValue([partitionedMarker("https://cookie.net")] as never);
      await TabEvents.onFrameResponse(embedded());
      expect(global.browser.cookies.set).not.toHaveBeenCalled();
    });

    it("marks a host whose markers are its own or in other sites' partitions", async () => {
      when(global.browser.cookies.getAll)
        .calledWith(lookup)
        .mockResolvedValue([
          { domain: "www.player.example", name: "ADCPBrowsingDataCleanup" },
          partitionedMarker("https://other.example"),
          partitionedMarker("http://cookie.net"),
        ] as never);
      await TabEvents.onFrameResponse(embedded());
      expect(global.browser.cookies.set).toHaveBeenCalledTimes(1);
    });

    it("sets one marker per embedding site for concurrent responses", async () => {
      await Promise.all([
        TabEvents.onFrameResponse(embedded()),
        TabEvents.onFrameResponse(embedded()),
        TabEvents.onFrameResponse(
          embedded(undefined, "https://www.other.example/")
        ),
      ]);
      const sites = global.browser.cookies.set.mock.calls.map(
        (call: { partitionKey: { topLevelSite: string } }[]) =>
          call[0].partitionKey.topLevelSite
      );
      expect(sites.sort()).toEqual([
        "https://cookie.net",
        "https://other.example",
      ]);
    });

    // cookies.set rejects a partitionKey next to a firstPartyDomain.
    it("leaves the frame alone under First-Party Isolation", async () => {
      setFpi(true);
      await TabEvents.onFrameResponse(embedded());
      expect(global.browser.cookies.set).not.toHaveBeenCalled();
    });

    it("leaves frames of pages that are not web pages alone", async () => {
      await TabEvents.onFrameResponse(
        embedded(undefined, "moz-extension://abc/settings/settings.html")
      );
      expect(global.browser.cookies.set).not.toHaveBeenCalled();
    });
  });

  it("skips private-window requests", async () => {
    await TabEvents.onFrameResponse(
      frame("https://devicebind.cookie.net/x", {
        cookieStoreId: "firefox-private",
        incognito: true,
      })
    );
    expect(global.browser.cookies.getAll).not.toHaveBeenCalled();
    expect(global.browser.cookies.set).not.toHaveBeenCalled();
  });
});
