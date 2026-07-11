/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2017-2022 Kenny Do and CAD Team; fork changes (c) 2026 j127.
 * Licensed under MIT (see LICENSE).
 */

/**
 * Firefox-flavored cleanCookiesOperation specs. The cleanup service binds
 * its store-enumeration branch to the build-time browser identity, so this
 * file stubs __BROWSER__ to "firefox" and re-imports the module graph —
 * everything else runs on the shared Chrome-flavored mock tree from
 * __tests__/setup.js.
 */
import { when } from "jest-when";

vi.stubGlobal("__BROWSER__", "firefox");
vi.resetModules();
const { cleanCookiesOperation } = await import("@/services/cleanup-service");
const { initialState } = await import("@/redux/state");

const containerCookie: browser.cookies.Cookie = {
  domain: "work.example",
  firstPartyDomain: "work.example",
  hostOnly: true,
  httpOnly: false,
  name: "sessionid",
  path: "/",
  sameSite: "no_restriction",
  secure: true,
  session: false,
  storeId: "firefox-container-9",
  value: "abc",
};

describe("cleanCookiesOperation() on Firefox", () => {
  beforeEach(() => {
    when(global.browser.tabs.query)
      .calledWith(expect.any(Object))
      .mockResolvedValue([] as never);
    when(global.browser.extension.isAllowedIncognitoAccess)
      .calledWith()
      .mockResolvedValue(true as never);
    // The container store has NO open tabs, so the cookies API does not
    // report it — only contextualIdentities.query knows it exists.
    when(global.browser.cookies.getAllCookieStores)
      .calledWith()
      .mockResolvedValue([{ id: "firefox-default" }] as never);
    when(global.browser.contextualIdentities.query)
      .calledWith(expect.any(Object))
      .mockResolvedValue([
        {
          cookieStoreId: "firefox-container-9",
          color: "orange",
          colorCode: "#ff9f00",
          icon: "briefcase",
          iconUrl: "resource://usercontext-content/briefcase.svg",
          name: "Work",
        },
      ] as never);
    when(global.browser.cookies.getAll)
      .calledWith({ storeId: "firefox-container-9", firstPartyDomain: null })
      .mockResolvedValue([containerCookie] as never);
    when(global.browser.cookies.remove)
      .calledWith(expect.any(Object))
      .mockResolvedValue({} as never);
    when(global.browser.browsingData.remove)
      .calledWith(expect.any(Object), expect.any(Object))
      .mockResolvedValue(undefined as never);
  });

  it("enumerates the firefox stores plus containers from contextualIdentities", async () => {
    await cleanCookiesOperation(initialState, {
      greyCleanup: false,
      ignoreOpenTabs: false,
    });
    const queriedStoreIds = global.browser.cookies.getAll.mock.calls.map(
      (call: { storeId: string }[]) => call[0].storeId
    );
    expect(queriedStoreIds).toContain("firefox-default");
    expect(queriedStoreIds).toContain("firefox-private");
    expect(queriedStoreIds).toContain("firefox-container-9");
    // No Chrome pseudo stores on the firefox build.
    expect(queriedStoreIds).not.toContain("0");
    expect(queriedStoreIds).not.toContain("1");
  });

  it("cleans cookies from a container that has no open tabs (audit bug 6a)", async () => {
    const result = await cleanCookiesOperation(initialState, {
      greyCleanup: false,
      ignoreOpenTabs: false,
    });
    expect(global.browser.cookies.remove).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "sessionid",
        storeId: "firefox-container-9",
        // The enumerated cookie's firstPartyDomain must be echoed back or
        // the removal misses under FPI.
        firstPartyDomain: "work.example",
      })
    );
    expect(result.cachedResults.recentlyCleaned).toBe(1);
  });

  it("keeps a container cookie the default list protects while the container setting is off", async () => {
    const protectedState: State = {
      ...initialState,
      lists: {
        default: [
          {
            expression: "work.example",
            listType: "WHITE" as ListType,
            storeId: "default",
          },
        ],
      },
    };
    await cleanCookiesOperation(protectedState, {
      greyCleanup: false,
      ignoreOpenTabs: false,
    });
    expect(global.browser.cookies.remove).not.toHaveBeenCalled();
  });

  it("degrades gracefully when contextualIdentities.query rejects", async () => {
    when(global.browser.contextualIdentities.query)
      .calledWith(expect.any(Object))
      .mockRejectedValue(
        new Error("Contextual identities are currently disabled") as never
      );
    const result = await cleanCookiesOperation(initialState, {
      greyCleanup: false,
      ignoreOpenTabs: false,
    });
    // Cleanup still ran for the remaining stores.
    const queriedStoreIds = global.browser.cookies.getAll.mock.calls.map(
      (call: { storeId: string }[]) => call[0].storeId
    );
    expect(queriedStoreIds).toContain("firefox-default");
    expect(queriedStoreIds).toContain("firefox-private");
    expect(queriedStoreIds).not.toContain("firefox-container-9");
    expect(result).toBeDefined();
  });

  it("scrubs firefox-private results from the activity log", async () => {
    const privateCookie: browser.cookies.Cookie = {
      ...containerCookie,
      domain: "secret.example",
      storeId: "firefox-private",
    };
    when(global.browser.cookies.getAll)
      .calledWith({ storeId: "firefox-private", firstPartyDomain: null })
      .mockResolvedValue([privateCookie] as never);
    const result = await cleanCookiesOperation(initialState, {
      greyCleanup: false,
      ignoreOpenTabs: false,
    });
    expect(result.cachedResults.storeIds["firefox-private"]).toBeUndefined();
    // The container store's removals are still recorded.
    expect(result.cachedResults.storeIds["firefox-container-9"]).toHaveLength(
      1
    );
  });
});
