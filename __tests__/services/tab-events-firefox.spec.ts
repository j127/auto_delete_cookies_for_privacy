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
});
