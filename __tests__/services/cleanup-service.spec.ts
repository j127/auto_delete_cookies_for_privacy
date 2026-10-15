/**
 * Copyright (c) 2022 CAD Team (https://github.com/Cookie-AutoDelete/Cookie-AutoDelete/graphs/contributors)
 * Licensed under MIT (https://github.com/Cookie-AutoDelete/Cookie-AutoDelete/blob/3.X.X-Branch/LICENSE)
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import {
  ListType,
  OpenTabStatus,
  ReasonClean,
  ReasonKeep,
  SettingID,
  SiteDataType,
} from "@/typings/enums";
import { advanceTo, clear } from "jest-date-mock";
import { when } from "jest-when";
import { initialState } from "@/redux/state";
import {
  cleanCookies,
  cleanCookiesOperation,
  cleanSiteData,
  clearCookiesForThisDomain,
  clearCookieTypeSiteData,
  clearLocalStorageForThisDomain,
  cookieIdentityKey,
  clearSiteDataForThisDomain,
  filterSiteData,
  getSiteDataMarkerHosts,
  isSafeToClean,
  otherBrowsingDataCleanup,
  prepareCookie,
  removeSiteData,
  returnContainersOfOpenTabDomains,
} from "@/services/cleanup-service";

import * as Lib from "@/services/libs";
import RecentCleanup from "@/services/recent-cleanup";

// This dynamically generates the spies for all functions in Libs
const spyLib: JestSpyObject = global.generateSpies(Lib);

import * as CleanupService from "@/services/cleanup-service";
import { ADCPCOOKIENAME } from "@/services/libs";
const spyCleanupService: JestSpyObject = global.generateSpies(CleanupService);

const sampleTab: browser.tabs.Tab = {
  active: true,
  cookieStoreId: "0",
  hidden: false,
  highlighted: false,
  incognito: false,
  index: 0,
  isArticle: false,
  isInReaderMode: false,
  lastAccessed: 12345678,
  pinned: false,
  url: "https://example.com",
  windowId: 1,
};

const wildCardGreyListGoogle: Expression = {
  expression: "*.google.com",
  id: "1",
  listType: ListType.GREY,
  storeId: "default",
};

const whiteListYoutube: Expression = {
  expression: "youtube.com",
  cleanSiteData: [SiteDataType.CACHE],
  id: "2",
  listType: ListType.WHITE,
  storeId: "default",
};

const wildCardGreyFacebook: Expression = {
  expression: "*.facebook.com",
  id: "3",
  listType: ListType.GREY,
  storeId: "private",
};

const wildCardGreyGit: Expression = {
  expression: "git*b.com",
  id: "4",
  listType: ListType.GREY,
  storeId: "default",
};

const whiteListAllExceptTwitter: Expression = {
  expression: "/^((?!twitter[.]com).)+$/",
  id: "5",
  listType: ListType.WHITE,
  storeId: "default",
};

const greyMessenger: Expression = {
  expression: "messenger.com",
  cleanSiteData: [SiteDataType.CACHE],
  id: "6",
  listType: ListType.GREY,
  storeId: "private",
};

const exampleWithCookieName: Expression = {
  cleanAllCookies: false,
  cookieNames: ["in-cookie-names"],
  expression: "examplewithcookiename.com",
  id: "7",
  listType: ListType.WHITE,
  storeId: "default",
};

const exampleWithCookieNameCleanAllCookiesTrue: Expression = {
  ...exampleWithCookieName,
  cleanAllCookies: true,
  expression: "exampleWithCookieNameCleanAllCookiesTrue.com",
  id: "8",
};

const exampleWithCookieNameGrey: Expression = {
  ...exampleWithCookieName,
  id: "9",
  listType: ListType.GREY,
  storeId: "private",
};

const restartListCleanTest: Expression = {
  expression: "restart.clean",
  id: "10",
  listType: ListType.GREY,
  storeId: "default",
  cleanSiteData: [SiteDataType.INDEXEDDB],
};

const restartListCleanTestAll: Expression = {
  expression: "restart.clean.all",
  id: "11",
  listType: ListType.GREY,
  storeId: "default",
};

const restartListCleanTestAll2: Expression = {
  expression: "another.restart.clean.all",
  id: "12",
  listType: ListType.GREY,
  storeId: "default",
  cleanSiteData: [],
};

// New installs now default every site-data type ON (src/redux/state.ts).
// The cookie-cleanup tests below predate that and assert pure cookie
// behavior, so this fixture pins the five types off explicitly.
const siteDataOffSettings: State["settings"] = {
  ...initialState.settings,
  ...Object.fromEntries(
    [
      SettingID.CLEANUP_CACHE,
      SettingID.CLEANUP_INDEXEDDB,
      SettingID.CLEANUP_LOCALSTORAGE,
      SettingID.CLEANUP_PLUGINDATA,
      SettingID.CLEANUP_SERVICEWORKERS,
    ].map((name) => [name, { name, value: false }])
  ),
};

const sampleState: State = {
  ...initialState,
  settings: siteDataOffSettings,
  lists: {
    default: [
      wildCardGreyGit,
      wildCardGreyListGoogle,
      whiteListYoutube,
      exampleWithCookieName,
      exampleWithCookieNameCleanAllCookiesTrue,
      restartListCleanTest,
      restartListCleanTestAll,
      restartListCleanTestAll2,
    ],
    private: [wildCardGreyFacebook, greyMessenger, exampleWithCookieNameGrey],
  },
};

const mockCookie: CookiePropertiesCleanup = {
  domain: "test.com",
  hostOnly: true,
  hostname: "test.com",
  httpOnly: true,
  mainDomain: "test.com",
  name: "key",
  path: "/",
  preparedCookieDomain: "https://test.com/",
  sameSite: "no_restriction",
  secure: true,
  session: true,
  storeId: "0",
  value: "value",
};

const fileCookie: CookiePropertiesCleanup = {
  ...mockCookie,
  domain: "",
  hostname: "file:///test/test.html",
  mainDomain: "file:///test/test.html",
  path: "file:///test/",
  preparedCookieDomain: "file:///test/test.html",
};

const googleCookie: CookiePropertiesCleanup = {
  ...mockCookie,
  domain: "google.com",
  name: "NID",
  path: "/",
  secure: true,
};

const youtubeCookie: CookiePropertiesCleanup = {
  ...mockCookie,
  domain: "youtube.com",
  name: "SID",
  path: "/",
  secure: true,
};
const yahooCookie: CookiePropertiesCleanup = {
  ...mockCookie,
  domain: "yahoo.com",
  name: "BID",
  path: "/login",
  secure: false,
};

const openTabCookie: CookiePropertiesCleanup = {
  ...mockCookie,
  domain: "sub.domain.com",
  name: "openTab",
};

const githubCookie: CookiePropertiesCleanup = {
  ...mockCookie,
  domain: "github.com",
  name: "greylist",
};

const personalGoogleCookie: CookiePropertiesCleanup = {
  ...mockCookie,
  domain: "google.com",
  name: "NID",
  path: "/",
  secure: true,
  storeId: "1",
};

const restartCleanCookie: CookiePropertiesCleanup = {
  ...mockCookie,
  domain: "restart.clean",
  name: "cleanOnRestart",
};

/**
 * A Chrome-like cookie jar behind the cookies mocks. getAll lists what is
 * left in a store, and cookies.remove resolves with its details whether or
 * not a cookie went, as Chrome's does. A removal takes one cookie of the
 * same store, name and partition whose own removal URL is the URL given.
 * A `stuck` cookie never goes: Chrome cannot reach it with the URL the
 * cleanup sends, like a scheme-bound cookie set over the other scheme
 * (#464). Returns the live jar.
 */
const chromeCookieJar = (
  cookies: browser.cookies.Cookie[],
  stuck: browser.cookies.Cookie[] = []
): browser.cookies.Cookie[] => {
  const jar = [...cookies];
  for (const storeId of new Set(jar.map((c) => c.storeId))) {
    when(global.browser.cookies.getAll)
      .calledWith({ storeId, partitionKey: {} })
      .mockImplementation(async () => jar.filter((c) => c.storeId === storeId));
  }
  when(global.browser.cookies.remove)
    .calledWith(expect.any(Object))
    .mockImplementation(
      async (details: {
        storeId: string;
        name: string;
        url: string;
        partitionKey?: unknown;
      }) => {
        const i = jar.findIndex(
          (c) =>
            !stuck.includes(c) &&
            c.storeId === details.storeId &&
            c.name === details.name &&
            Lib.prepareCookieDomain(c) === details.url &&
            JSON.stringify(c.partitionKey) ===
              JSON.stringify(details.partitionKey)
        );
        if (i !== -1) jar.splice(i, 1);
        return details;
      }
    );
  return jar;
};

describe("CleanupService", () => {
  beforeEach(() => {
    when(global.browser.runtime.getManifest)
      .calledWith()
      .mockReturnValue({ version: "0.12.34" });
    when(global.browser.notifications.create)
      .calledWith(expect.any(String), expect.any(Object))
      .mockResolvedValue("testID" as never);
    when(global.browser.notifications.clear)
      .calledWith(expect.any(String))
      .mockResolvedValue(true as never);
  });
  afterEach(() => {
    clear();
  });
  describe("cleanCookies()", () => {
    const cookies = [
      googleCookie,
      personalGoogleCookie,
      openTabCookie,
      yahooCookie,
      youtubeCookie,
    ];

    const removeCookies: CleanReasonObject[] = cookies.map((cookie) => {
      return {
        cached: false,
        cleanCookie: true,
        cookie,
        reason: ReasonClean.NoMatchedExpression,
      } as CleanReasonObject;
    });

    beforeAll(() => {
      when(global.browser.i18n.getMessage)
        .calledWith(expect.any(String))
        .mockReturnValue("");
      when(global.browser.i18n.getMessage)
        .calledWith(expect.any(String), expect.any(Array))
        .mockReturnValue("");
    });
    beforeEach(() => {
      // cookies.remove resolves the removed cookie's details on success;
      // an unset mock resolves undefined, which now (correctly) counts as
      // a failed removal.
      when(global.browser.cookies.remove)
        .calledWith(expect.any(Object))
        .mockResolvedValue({} as never);
      // On Chrome the stores are read again after removing; an empty read
      // means every removed cookie is gone.
      when(global.browser.cookies.getAll)
        .calledWith(expect.any(Object))
        .mockResolvedValue([] as never);
    });

    it("should be called 5 times for cookies.remove and report all as removed", async () => {
      const result = await cleanCookies(initialState, removeCookies);
      expect(global.browser.cookies.remove).toBeCalledTimes(5);
      expect(global.browser.cookies.remove).toHaveBeenCalledWith({
        storeId: "0",
        name: "NID",
        url: "https://test.com/",
      });
      expect(result.removed).toHaveLength(5);
      expect(result.failedCount).toBe(0);
      expect(result.firstError).toBeUndefined();
    });

    it("excludes rejected and null removals from the removed set without throwing", async () => {
      when(global.browser.cookies.remove)
        .calledWith(expect.any(Object))
        .mockResolvedValueOnce(true as never)
        .mockRejectedValueOnce(new Error("test") as never)
        // cookies.remove resolves null when it could not remove — no
        // rejection at all — so this must not count as removed either.
        .mockResolvedValueOnce(null as never);
      const result = await cleanCookies(initialState, removeCookies);
      expect(global.browser.cookies.remove).toBeCalledTimes(5);
      expect(result.removed).toHaveLength(3);
      expect(result.failedCount).toBe(2);
      expect(result.firstError).toBeInstanceOf(Error);
    });
  });

  describe("cleanCookiesOperation()", () => {
    const cleanupProperties: CleanupProperties = {
      greyCleanup: false,
      ignoreOpenTabs: false,
    };
    beforeEach(() => {
      when(global.browser.tabs.query)
        .calledWith(expect.any(Object))
        .mockResolvedValue([
          {
            incognito: false,
            url: "https://google.com/search",
          },
          {
            incognito: false,
            url: "http://facebook.com/search",
          },
          {
            incognito: false,
            url: "http://sub.domain.com",
          },
          {
            incognito: false,
            url: "chrome-extension://test/settings/settings.html",
          },
        ] as never);
      advanceTo(new Date("2020-06-01 12:34:56"));
    });
    afterEach(() => {
      when(global.browser.extension.isAllowedIncognitoAccess)
        .calledWith()
        .mockResolvedValue(false as never);
      when(global.browser.cookies.getAll)
        .calledWith(expect.any(Object))
        .mockResolvedValue([] as never);
      when(global.browser.cookies.remove)
        .calledWith(expect.any(Object))
        .mockResolvedValue({} as never);
    });

    it("should not show the error notification if the error thrown during fetching cookies is not an error type", async () => {
      when(global.browser.cookies.getAll)
        .calledWith(expect.any(Object))
        .mockRejectedValueOnce("test" as never);
      await cleanCookiesOperation(sampleState, cleanupProperties);
      expect(spyLib.adcpLog).not.toHaveBeenCalled();
    });
    it("should not show the error notification if the error thrown during cleaning of cookies is not an error type", async () => {
      when(global.browser.cookies.remove)
        .calledWith(expect.any(Object))
        .mockRejectedValueOnce("test" as never);
      await cleanCookiesOperation(sampleState, cleanupProperties);
      expect(spyLib.throwErrorNotification).not.toHaveBeenCalled();
    });

    describe("Common Functions", () => {
      const debugState = {
        ...sampleState,
        settings: {
          ...sampleState.settings,
          [SettingID.DEBUG_MODE]: {
            name: SettingID.DEBUG_MODE,
            value: true,
          },
        },
      };
      beforeEach(() => {
        // Reset drops any leftover ...Once mock from the error-path tests
        // above; a leaked rejection would silently shrink the counts now
        // that failed removals are no longer reported as cleaned.
        global.browser.cookies.remove.mockReset();
        when(global.browser.cookies.getAllCookieStores)
          .calledWith()
          .mockResolvedValue([{ id: "0" }] as never);
        // Store "0" reads what is left in it: the cleanup counts only
        // cookies that are gone when it reads the store again.
        chromeCookieJar([
          mockCookie, // no list
          googleCookie, // greylist, opentab
          youtubeCookie, // whitelist
          yahooCookie, // no list
          openTabCookie, // opentab
          githubCookie, // greylist
        ]);
      });

      it("Regular clean, exclude open tabs.", async () => {
        const result = await cleanCookiesOperation(
          sampleState,
          cleanupProperties
        );
        expect(
          global.browser.extension.isAllowedIncognitoAccess
        ).toHaveBeenCalledTimes(1);
        expect(global.browser.cookies.getAllCookieStores).toHaveBeenCalledTimes(
          1
        );
        expect(global.browser.cookies.getAll).toHaveBeenCalledWith({
          storeId: "0",
          partitionKey: {},
        });
        expect(global.browser.cookies.remove).toHaveBeenCalledTimes(2);
        expect(global.browser.browsingData.remove).not.toHaveBeenCalled();
        expect(result.cachedResults.dateTime.indexOf("12:34:56")).not.toBe(-1);
        expect(result.cachedResults.recentlyCleaned).toBe(2);
        expect(result.setOfDeletedDomainCookies).toEqual([
          "test.com",
          "yahoo.com",
        ]);
      });

      it("reports the main domains it removed cookies from, the marker included", async () => {
        const spyFinished = jest.spyOn(RecentCleanup, "cleanupFinished");
        chromeCookieJar([
          mockCookie,
          youtubeCookie, // whitelist: kept
          openTabCookie, // open tab: kept
          {
            ...mockCookie,
            domain: "www.marker.com",
            name: Lib.ADCPCOOKIENAME,
          },
        ]);
        try {
          await cleanCookiesOperation(sampleState, cleanupProperties);
          expect(spyFinished).toHaveBeenCalledTimes(1);
          expect(Array.from(spyFinished.mock.calls[0][0])).toEqual([
            "test.com",
            "marker.com",
          ]);
        } finally {
          spyFinished.mockRestore();
        }
      });

      it("ends its RecentCleanup run even when the cleanup throws", async () => {
        const spyFinished = jest.spyOn(RecentCleanup, "cleanupFinished");
        global.browser.cookies.getAllCookieStores.mockRejectedValueOnce(
          new Error("boom")
        );
        try {
          await expect(
            cleanCookiesOperation(sampleState, cleanupProperties)
          ).rejects.toThrow("boom");
          expect(spyFinished).toHaveBeenCalledTimes(1);
          await expect(RecentCleanup.settled()).resolves.toBeUndefined();
        } finally {
          spyFinished.mockRestore();
        }
      });

      // Chrome rejects unknown cookies.* keys, so no call may ever carry
      // firstPartyDomain on the chrome flavor (it is Firefox-only).
      it("never sends firstPartyDomain on any cookies.* call (Chrome flavor)", async () => {
        await cleanCookiesOperation(sampleState, cleanupProperties);
        const allCookieCalls = [
          ...global.browser.cookies.getAll.mock.calls,
          ...global.browser.cookies.remove.mock.calls,
        ];
        expect(allCookieCalls.length).toBeGreaterThan(0);
        for (const call of allCookieCalls) {
          expect(call[0]).not.toHaveProperty("firstPartyDomain");
        }
      });

      it("Regular clean counts only real removals when one cookies.remove rejects.", async () => {
        when(global.browser.cookies.remove)
          .calledWith(expect.any(Object))
          .mockRejectedValueOnce(new Error("removal failed") as never);
        const result = await cleanCookiesOperation(
          sampleState,
          cleanupProperties
        );
        expect(global.browser.cookies.remove).toHaveBeenCalledTimes(2);
        // Two cookies were marked, one removal rejected: the counter, the
        // log, and the notification set must reflect only the real removal.
        expect(result.cachedResults.recentlyCleaned).toBe(1);
        expect(result.setOfDeletedDomainCookies).toEqual(["yahoo.com"]);
        expect(spyLib.throwErrorNotification).toHaveBeenCalledTimes(1);
      });

      it("Regular clean counts only real removals when cookies.remove resolves null.", async () => {
        when(global.browser.cookies.remove)
          .calledWith(expect.any(Object))
          .mockResolvedValueOnce(null as never);
        const result = await cleanCookiesOperation(
          sampleState,
          cleanupProperties
        );
        expect(result.cachedResults.recentlyCleaned).toBe(1);
        expect(result.setOfDeletedDomainCookies).toEqual(["yahoo.com"]);
        // A null result is a quiet failure, not an exception: no notification.
        expect(spyLib.throwErrorNotification).not.toHaveBeenCalled();
      });

      it("If cleanupProperties is missing, presume Regular clean, exclude open tabs.", async () => {
        await cleanCookiesOperation(sampleState);
        expect(global.browser.cookies.remove).toHaveBeenCalledTimes(2);
      });

      it("Browser Restart clean, exclude open tabs.", async () => {
        const result = await cleanCookiesOperation(sampleState, {
          ...cleanupProperties,
          greyCleanup: true,
        });
        expect(global.browser.cookies.remove).toHaveBeenCalledTimes(3);
        expect(result.cachedResults.recentlyCleaned).toBe(3);
        expect(result.setOfDeletedDomainCookies).toEqual([
          "test.com",
          "yahoo.com",
          "github.com",
        ]);
      });

      it("Browser Restart clean, include open tabs.", async () => {
        const result = await cleanCookiesOperation(sampleState, {
          greyCleanup: true,
          ignoreOpenTabs: true,
        });
        expect(global.browser.cookies.remove).toHaveBeenCalledTimes(5);
        expect(result.cachedResults.recentlyCleaned).toBe(5);
        expect(result.setOfDeletedDomainCookies).toEqual([
          "test.com",
          "google.com",
          "yahoo.com",
          "sub.domain.com",
          "github.com",
        ]);
      });

      it("Regular clean, include open tabs.", async () => {
        const result = await cleanCookiesOperation(sampleState, {
          ...cleanupProperties,
          ignoreOpenTabs: true,
        });
        expect(global.browser.cookies.remove).toHaveBeenCalledTimes(3);
        expect(result.cachedResults.recentlyCleaned).toBe(3);
        expect(result.setOfDeletedDomainCookies).toEqual([
          "test.com",
          "yahoo.com",
          "sub.domain.com",
        ]);
      });

      it("Regular clean, exclude open tabs, with only cookies in open tabs/whitelist.", async () => {
        when(global.browser.cookies.getAll)
          .calledWith({ storeId: "0", partitionKey: {} })
          .mockResolvedValue([googleCookie, youtubeCookie] as never);
        const result = await cleanCookiesOperation(
          sampleState,
          cleanupProperties
        );
        expect(global.browser.cookies.remove).not.toHaveBeenCalled();
        expect(result.cachedResults.recentlyCleaned).toBe(0);
        expect(result.setOfDeletedDomainCookies).toEqual([]);
      });

      it("Regular clean, exclude open tabs to catch errors during browser.cookies.getAll", async () => {
        when(global.browser.cookies.getAll)
          .calledWith(expect.any(Object))
          .mockRejectedValue(new Error("test") as never);
        await cleanCookiesOperation(sampleState, cleanupProperties);
        expect(global.console.error).toHaveBeenCalledTimes(1);
      });

      it("Debug mode should sanitize cookie value", async () => {
        await cleanCookiesOperation(debugState, cleanupProperties);
        // isSafeToCleanObjects Result: cookie.value sanitize (lines 804-822)
        expect(spyLib.adcpLog.mock.calls[18][0].x[0].cookie.value).toBe("***");
        // markedForDeletion Result cookie.value sanitize (lines 835-853)
        expect(spyLib.adcpLog.mock.calls[25][0].x[0].cookie.value).toBe("***");
      });

      it("Regular clean, exclude open tabs to include errors during cleanCookies / browser.cookies.remove", async () => {
        when(global.browser.cookies.remove)
          .calledWith(expect.any(Object))
          .mockRejectedValue(new Error("test") as never);
        await cleanCookiesOperation(sampleState, cleanupProperties);
        expect(spyLib.throwErrorNotification).toHaveBeenCalledTimes(1);
      });

      it("should not include sites from the private cookie store in site data domains", async () => {
        when(global.browser.extension.isAllowedIncognitoAccess)
          .calledWith()
          .mockResolvedValue(true as never);
        when(global.browser.cookies.getAll)
          .calledWith({ storeId: "1" })
          .mockResolvedValue([
            {
              ...mockCookie,
              domain: "private.com",
              hostname: "private.com",
              mainDomain: "private.com",
              preparedCookieDomain: "https://private.com/",
              storeId: "1",
            },
          ] as never);
        const result = await cleanCookiesOperation(
          {
            ...sampleState,
            settings: {
              ...sampleState.settings,
              [SettingID.CLEANUP_CACHE]: {
                name: SettingID.CLEANUP_CACHE,
                value: true,
              },
            },
          },
          cleanupProperties
        );
        expect(result.cachedResults.browsingDataCleanup.Cache).toEqual(
          expect.not.arrayContaining(["private.com"])
        );
      });

      it("should have youtube.com as part of domains that has cache cleared", async () => {
        const result = await cleanCookiesOperation(
          {
            ...sampleState,
            settings: {
              ...sampleState.settings,
              [SettingID.CLEANUP_CACHE]: {
                name: SettingID.CLEANUP_CACHE,
                value: true,
              },
            },
          },
          cleanupProperties
        );
        expect(
          result.cachedResults.browsingDataCleanup[SiteDataType.CACHE]
        ).toEqual(expect.arrayContaining(["youtube.com"]));
      });

      it("should have test.com as part of domains that has indexedDB cleared", async () => {
        const result = await cleanCookiesOperation(
          {
            ...sampleState,
            settings: {
              ...sampleState.settings,
              [SettingID.CLEANUP_INDEXEDDB]: {
                name: SettingID.CLEANUP_INDEXEDDB,
                value: true,
              },
            },
          },
          cleanupProperties
        );
        expect(
          result.cachedResults.browsingDataCleanup[SiteDataType.INDEXEDDB]
        ).toEqual(expect.arrayContaining(["test.com"]));
      });

      it("should have test.com as part of domains that has localstorage cleared", async () => {
        const result = await cleanCookiesOperation(
          {
            ...sampleState,
            settings: {
              ...sampleState.settings,
              [SettingID.CLEANUP_LOCALSTORAGE]: {
                name: SettingID.CLEANUP_LOCALSTORAGE,
                value: true,
              },
            },
          },
          cleanupProperties
        );
        expect(
          result.cachedResults.browsingDataCleanup[SiteDataType.LOCALSTORAGE]
        ).toEqual(expect.arrayContaining(["test.com"]));
      });
      it("should have test.com as part of domains that has pluginData cleared", async () => {
        const result = await cleanCookiesOperation(
          {
            ...sampleState,
            settings: {
              ...sampleState.settings,
              [SettingID.CLEANUP_PLUGINDATA]: {
                name: SettingID.CLEANUP_PLUGINDATA,
                value: true,
              },
            },
          },
          cleanupProperties
        );
        expect(
          result.cachedResults.browsingDataCleanup[SiteDataType.PLUGINDATA]
        ).toEqual(expect.arrayContaining(["test.com"]));
      });
      it("should have test.com as part of domains that has serviceWorkers cleared", async () => {
        const result = await cleanCookiesOperation(
          {
            ...sampleState,
            settings: {
              ...sampleState.settings,
              [SettingID.CLEANUP_SERVICEWORKERS]: {
                name: SettingID.CLEANUP_SERVICEWORKERS,
                value: true,
              },
            },
          },
          cleanupProperties
        );
        expect(
          result.cachedResults.browsingDataCleanup[SiteDataType.SERVICEWORKERS]
        ).toEqual(expect.arrayContaining(["test.com"]));
      });
    });

    describe("Cookie Store seeding (Chrome)", () => {
      const chromeCookies = [
        { ...mockCookie, storeId: "0" },
        { ...googleCookie, storeId: "0" },
        { ...youtubeCookie, storeId: "0" },
        { ...yahooCookie, storeId: "0" },
      ];

      beforeEach(() => {
        when(global.browser.cookies.getAllCookieStores)
          .calledWith()
          .mockResolvedValue([{ id: "0" }] as never);
        when(global.browser.cookies.getAll)
          .calledWith({ storeId: "0", partitionKey: {} })
          .mockResolvedValue(chromeCookies as never);
      });

      it("Regular clean, exclude open tabs (Chrome).", async () => {
        await cleanCookiesOperation(sampleState, cleanupProperties);
        expect(
          global.browser.extension.isAllowedIncognitoAccess
        ).toHaveBeenCalledTimes(1);
        expect(global.browser.cookies.getAll).toHaveBeenCalledWith({
          storeId: "0",
          partitionKey: {},
        });
      });

      it("should include private cookieStores if extension allowed in incognito mode", async () => {
        when(global.browser.extension.isAllowedIncognitoAccess)
          .calledWith()
          .mockResolvedValue(true as never);
        await cleanCookiesOperation(sampleState, cleanupProperties);
        expect(global.browser.cookies.getAll).toHaveBeenCalledWith({
          storeId: "1",
          partitionKey: {},
        });
      });
    });
  });

  describe("cleanSiteData()", () => {
    afterEach(() => {
      spyCleanupService.removeSiteData.mockRestore();
    });
    const mockCleanReasonObj: CleanReasonObject = {
      cached: false,
      cleanCookie: true,
      cookie: {
        ...youtubeCookie,
      },
      expression: {
        ...whiteListYoutube,
      },
      openTabStatus: OpenTabStatus.TabsWasNotIgnored,
      reason: ReasonClean.MatchedExpressionButNoCookieName,
    };
    const mockCleanReasonObjFile = {
      ...mockCleanReasonObj,
      cookie: {
        ...fileCookie,
      },
    };

    it("should return domains cleaned if there are domains to clean", async () => {
      const result = await cleanSiteData(
        sampleState,
        SiteDataType.CACHE,
        [
          {
            ...mockCleanReasonObj,
            expression: {
              ...whiteListYoutube,
            },
          },
        ],
        false
      );
      expect(result).toEqual(["youtube.com"]);
    });

    it("should return empty array if no domains to clean", async () => {
      const result = await cleanSiteData(
        sampleState,
        SiteDataType.CACHE,
        [mockCleanReasonObjFile],
        false
      );
      expect(result).toEqual([]);
    });

    it("should return empty array if removeSiteData returned false", async () => {
      when(global.browser.browsingData.remove)
        .calledWith(expect.any(Object), expect.any(Object))
        .mockRejectedValue(new Error("test") as never);
      const result = await cleanSiteData(
        sampleState,
        SiteDataType.CACHE,
        [
          {
            ...mockCleanReasonObj,
            expression: {
              ...whiteListYoutube,
            },
          },
        ],
        false
      );
      expect(result).toEqual([]);
    });
  });

  describe("clearCookiesForThisDomain()", () => {
    afterEach(() => {
      global.browser.cookies.getAll.mockReset();
      global.browser.cookies.remove.mockReset();
      global.browser.notifications.create.mockReset();
    });
    const googleCookie2: CookiePropertiesCleanup = {
      ...googleCookie,
      name: "SID",
    };

    const googleTab = {
      ...sampleTab,
      url: "https://google.com",
    };

    beforeEach(() => {
      when(global.browser.i18n.getMessage)
        .calledWith(expect.any(String), [
          expect.any(Number),
          expect.any(Number),
        ])
        .mockReturnValue("0");
    });

    it("should clean all cookies for active tab domain and show notification.", async () => {
      // The partition-bucket queries are trained explicitly: an earlier
      // generic jest-when training on this fn means a default
      // implementation would not act as fallback here.
      when(global.browser.cookies.getAll)
        .calledWith({
          partitionKey: { topLevelSite: "https://google.com" },
          storeId: "0",
        })
        .mockResolvedValue([] as never);
      when(global.browser.cookies.getAll)
        .calledWith({
          partitionKey: { topLevelSite: "http://google.com" },
          storeId: "0",
        })
        .mockResolvedValue([] as never);
      when(global.browser.cookies.getAll)
        .calledWith({ domain: "google.com", storeId: "0", partitionKey: {} })
        .mockResolvedValue([googleCookie, googleCookie2] as never);
      when(global.browser.cookies.remove)
        .calledWith(expect.anything())
        .mockResolvedValue({} as never);

      expect(await clearCookiesForThisDomain(initialState, googleTab)).toBe(
        true
      );
      expect(global.browser.cookies.remove).toBeCalledTimes(2);
      expect(global.browser.cookies.remove).toHaveBeenCalledWith({
        name: "NID",
        storeId: "0",
        url: "https://google.com/",
      });
      expect(global.browser.notifications.create).toBeCalledTimes(1);
      expect(global.browser.i18n.getMessage.mock.calls[1][0]).toBe(
        "manualCleanSuccess"
      );
      expect(global.browser.i18n.getMessage.mock.calls[2][1]).toEqual([
        "2",
        "2",
      ]);
    });

    it("should just show notification if active tab domain has no cookies", async () => {
      when(global.browser.cookies.remove)
        .calledWith(expect.any(Object))
        .mockResolvedValue({} as never);
      when(global.browser.cookies.getAll)
        .calledWith(expect.any(Object))
        .mockResolvedValue([] as never);

      expect(await clearCookiesForThisDomain(initialState, googleTab)).toBe(
        false
      );
      expect(global.browser.cookies.remove).toBeCalledTimes(0);
      expect(global.browser.notifications.create).toBeCalledTimes(1);
      expect(global.browser.i18n.getMessage.mock.calls[1][0]).toBe(
        "manualCleanNothing"
      );
    });

    it("should just show notification if active tab domain has only one cookie that for some reason cannot be cleared.", async () => {
      global.browser.cookies.getAll.mockResolvedValue([] as never);
      when(global.browser.cookies.getAll)
        .calledWith({ domain: "google.com", storeId: "0", partitionKey: {} })
        .mockResolvedValue([googleCookie] as never);
      when(global.browser.cookies.remove)
        .calledWith(expect.any(Object))
        .mockResolvedValue(null as never);

      expect(await clearCookiesForThisDomain(initialState, googleTab)).toBe(
        false
      );
      expect(global.browser.cookies.remove).toBeCalledTimes(1);
      expect(global.browser.notifications.create).toBeCalledTimes(1);
      expect(global.browser.i18n.getMessage.mock.calls[1][0]).toBe(
        "manualCleanSuccess"
      );
      // browser.i18n.getMessage for number of cookies cleaned.
      expect(global.browser.i18n.getMessage.mock.calls[2][1]).toEqual([
        "0",
        "1",
      ]);
    });
    it("empties the partition bucket keyed with the port on a non-default port", async () => {
      // Firefox ESR 140 keys partitions under http://localhost:8080 with
      // the port and getAll matches the key exactly (#432).
      const tracker: CookiePropertiesCleanup = {
        ...mockCookie,
        domain: "127.0.0.1",
        name: "e2e_tracker",
        path: "/",
        secure: false,
        partitionKey: { topLevelSite: "http://localhost:8080" },
      };
      global.browser.cookies.getAll.mockResolvedValue([] as never);
      when(global.browser.cookies.getAll)
        .calledWith({
          partitionKey: { topLevelSite: "http://localhost:8080" },
          storeId: "0",
        })
        .mockResolvedValue([tracker] as never);
      when(global.browser.cookies.remove)
        .calledWith(expect.any(Object))
        .mockResolvedValue({} as never);

      expect(
        await clearCookiesForThisDomain(initialState, {
          ...sampleTab,
          url: "http://localhost:8080/embed",
        })
      ).toBe(true);
      expect(global.browser.cookies.remove).toBeCalledTimes(1);
      expect(global.browser.cookies.remove).toHaveBeenCalledWith({
        name: "e2e_tracker",
        storeId: "0",
        url: "http://127.0.0.1/",
        partitionKey: { topLevelSite: "http://localhost:8080" },
      });
    });

    // Chrome tabs carry no cookieStoreId (#474): "Delete this site's
    // cookies" must read and remove in the tab's own store.
    const chromeGoogleTab = (incognito: boolean): browser.tabs.Tab => ({
      ...googleTab,
      cookieStoreId: undefined,
      incognito,
    });
    const queriedStoreIds = (): (string | undefined)[] =>
      global.browser.cookies.getAll.mock.calls.map(
        (call: { storeId?: string }[]) => call[0].storeId
      );

    it("reads and removes in the incognito store for a Chrome incognito tab", async () => {
      global.browser.cookies.getAll.mockResolvedValue([] as never);
      when(global.browser.cookies.getAll)
        .calledWith({ domain: "google.com", storeId: "1", partitionKey: {} })
        .mockResolvedValue([{ ...googleCookie, storeId: "1" }] as never);
      when(global.browser.cookies.remove)
        .calledWith(expect.any(Object))
        .mockResolvedValue({} as never);

      expect(
        await clearCookiesForThisDomain(initialState, chromeGoogleTab(true))
      ).toBe(true);
      expect(queriedStoreIds().length).toBeGreaterThan(0);
      expect(queriedStoreIds().every((id) => id === "1")).toBe(true);
      expect(global.browser.cookies.remove).toHaveBeenCalledWith(
        expect.objectContaining({ name: "NID", storeId: "1" })
      );
    });

    it("reads from the regular store for a normal Chrome tab", async () => {
      global.browser.cookies.getAll.mockResolvedValue([] as never);

      await clearCookiesForThisDomain(initialState, chromeGoogleTab(false));
      expect(queriedStoreIds().length).toBeGreaterThan(0);
      expect(queriedStoreIds().every((id) => id === "0")).toBe(true);
    });
  });

  describe("clearLocalStorageForThisDomain()", () => {
    // MV3: tabs.executeScript was removed; the clear now goes through
    // scripting.executeScript with an explicit tab id and returns
    // InjectionResult objects whose payload sits under `result`.
    it("should clear localstorage from active tab (via scripting.executeScript)", async () => {
      when(global.browser.scripting.executeScript)
        .calledWith(expect.any(Object))
        .mockResolvedValue([
          { frameId: 0, result: { local: 2, session: 0 } },
        ] as never);
      expect(
        await clearLocalStorageForThisDomain(initialState, sampleTab)
      ).toBe(true);
      expect(global.browser.scripting.executeScript).toBeCalledTimes(1);
      expect(
        global.browser.scripting.executeScript.mock.calls[0][0].target
      ).toEqual({ tabId: sampleTab.id, allFrames: true });
      expect(global.browser.notifications.create).toBeCalledTimes(1);
    });
    it("should show error notification if browser.scripting.executeScript threw an error", async () => {
      when(global.browser.scripting.executeScript)
        .calledWith(expect.any(Object))
        .mockRejectedValue(new Error("test") as never);
      expect(
        await clearLocalStorageForThisDomain(initialState, sampleTab)
      ).toBe(false);
      expect(global.browser.scripting.executeScript).toBeCalledTimes(1);
      expect(spyLib.throwErrorNotification).toBeCalledTimes(1);
      expect(spyLib.showNotification).toBeCalledTimes(1);
    });
    it("should only show the no cleanup done notification if browser.scripting.executeScript threw a non-error type", async () => {
      when(global.browser.scripting.executeScript)
        .calledWith(expect.any(Object))
        .mockRejectedValue("error" as never);
      expect(
        await clearLocalStorageForThisDomain(initialState, sampleTab)
      ).toBe(false);
      expect(global.browser.scripting.executeScript).toBeCalledTimes(1);
      expect(spyLib.throwErrorNotification).not.toHaveBeenCalled();
      expect(spyLib.showNotification).toBeCalledTimes(1);
    });
  });

  describe("clearSiteDataForThisDomain()", () => {
    it("should return false if hostname is empty", async () => {
      expect(await clearSiteDataForThisDomain(initialState, "All", "")).toBe(
        false
      );
    });
    it("should return false if hostname only has whitespaces", async () => {
      expect(
        await clearSiteDataForThisDomain(initialState, SiteDataType.CACHE, "  ")
      ).toBe(false);
    });
    it("should return true when the removal succeeds", async () => {
      when(global.browser.browsingData.remove)
        .calledWith(expect.any(Object), expect.any(Object))
        .mockResolvedValue(undefined as never);
      expect(
        await clearSiteDataForThisDomain(
          initialState,
          SiteDataType.CACHE,
          "domain.com"
        )
      ).toBe(true);
    });
    it("should scope the removal to port-carrying origins when a port is given", async () => {
      when(global.browser.browsingData.remove)
        .calledWith(expect.any(Object), expect.any(Object))
        .mockResolvedValue(undefined as never);
      global.browser.browsingData.remove.mockClear();
      expect(
        await clearSiteDataForThisDomain(
          initialState,
          SiteDataType.CACHE,
          "domain.com",
          "8443"
        )
      ).toBe(true);
      const removalOptions =
        global.browser.browsingData.remove.mock.calls[0][0];
      expect(removalOptions.origins).toEqual(
        expect.arrayContaining([
          "https://domain.com:8443",
          "https://domain.com",
        ])
      );
    });
    it("should return false when the removal fails, instead of claiming success", async () => {
      when(global.browser.browsingData.remove)
        .calledWith(expect.any(Object), expect.any(Object))
        .mockRejectedValue(new Error("nope") as never);
      expect(
        await clearSiteDataForThisDomain(
          initialState,
          SiteDataType.CACHE,
          "domain.com"
        )
      ).toBe(false);
    });
    it("should return false and skip the consolidated notification when every type fails for All", async () => {
      when(global.browser.browsingData.remove)
        .calledWith(expect.any(Object), expect.any(Object))
        .mockRejectedValue(new Error("nope") as never);
      global.browser.notifications.create.mockClear();
      expect(
        await clearSiteDataForThisDomain(initialState, "All", "domain.com")
      ).toBe(false);
      // removeSiteData's own error notifications go through
      // throwErrorNotification; the consolidated success one must not fire.
      expect(spyLib.showNotification).not.toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining("notificationTitleSiteData"),
        }),
        expect.anything()
      );
    });
    it("should return true and list only the succeeded types when some fail for All", async () => {
      when(global.browser.browsingData.remove)
        .calledWith(expect.any(Object), expect.any(Object))
        .mockRejectedValueOnce(new Error("nope") as never)
        .mockResolvedValue(undefined as never);
      when(global.browser.i18n.getMessage)
        .calledWith(expect.any(String))
        .mockImplementation(((key: string) => key) as never);
      when(global.browser.i18n.getMessage)
        .calledWith(expect.any(String), expect.any(Array))
        .mockImplementation(
          ((key: string, subs: string[]) =>
            `${key}[${subs.join("|")}]`) as never
        );
      expect(
        await clearSiteDataForThisDomain(initialState, "All", "domain.com")
      ).toBe(true);
      const consolidated = spyLib.showNotification.mock.calls.find(([opts]) =>
        `${opts.msg}`.startsWith("activityLogSiteDataDomainsText")
      );
      expect(consolidated).toBeDefined();
      // The first type (Cache, alphabetically via SITEDATATYPES order)
      // failed; the consolidated message must list the other four only.
      expect(`${consolidated?.[0].msg}`).not.toContain("cacheText");
      expect(`${consolidated?.[0].msg}`).toContain("indexedDBText");
    });
  });

  describe("getSiteDataMarkerHosts()", () => {
    const lookup = {
      domain: "example.com",
      name: ADCPCOOKIENAME,
      storeId: "0",
    };
    const marker = (domain: string) => ({ domain, name: ADCPCOOKIENAME });

    it("lists the site's hosts that hold a marker, once each", async () => {
      when(global.browser.cookies.getAll)
        .calledWith(lookup)
        .mockResolvedValue([
          marker("devicebind.example.com"),
          marker(".Signin.Example.com"),
          marker("devicebind.example.com"),
        ] as never);
      expect(await getSiteDataMarkerHosts("www.example.com", "0")).toEqual([
        "devicebind.example.com",
        "signin.example.com",
      ]);
    });

    it("drops hosts of another site", async () => {
      when(global.browser.cookies.getAll)
        .calledWith(lookup)
        .mockResolvedValue([
          marker("example.com.evil.net"),
          marker("cdn.example.com"),
        ] as never);
      expect(await getSiteDataMarkerHosts("example.com", "0")).toEqual([
        "cdn.example.com",
      ]);
    });

    it("returns nothing when the lookup fails or gives nothing back", async () => {
      when(global.browser.cookies.getAll)
        .calledWith(lookup)
        .mockRejectedValueOnce(new Error("no cookies api") as never)
        .mockResolvedValueOnce(undefined as never);
      expect(await getSiteDataMarkerHosts("example.com", "0")).toEqual([]);
      expect(await getSiteDataMarkerHosts("example.com", "0")).toEqual([]);
    });

    it("returns nothing for a blank hostname", async () => {
      expect(await getSiteDataMarkerHosts("  ")).toEqual([]);
    });
  });

  describe("clearSiteDataForThisDomain() with marker hosts (#464)", () => {
    beforeEach(() => {
      when(global.browser.browsingData.remove)
        .calledWith(expect.any(Object), expect.any(Object))
        .mockResolvedValue(undefined as never);
      when(global.browser.cookies.getAll)
        .calledWith({
          domain: "example.com",
          name: ADCPCOOKIENAME,
          storeId: "0",
        })
        .mockResolvedValue([
          { domain: "devicebind.example.com", name: ADCPCOOKIENAME },
        ] as never);
      when(global.browser.i18n.getMessage)
        .calledWith(expect.any(String), expect.any(Array))
        .mockImplementation(
          ((key: string, subs: string[]) =>
            `${key}[${subs.join("|")}]`) as never
        );
    });

    it("wipes the storage of the site's frame hosts too", async () => {
      global.browser.browsingData.remove.mockClear();
      expect(
        await clearSiteDataForThisDomain(
          initialState,
          "All",
          "example.com",
          "",
          "0"
        )
      ).toBe(true);
      for (const [scope] of global.browser.browsingData.remove.mock.calls) {
        expect(scope.origins).toEqual(
          expect.arrayContaining([
            "https://example.com",
            "https://www.example.com",
            "https://devicebind.example.com",
          ])
        );
      }
    });

    it("names hosts, not origins, in the notification", async () => {
      await clearSiteDataForThisDomain(
        initialState,
        SiteDataType.LOCALSTORAGE,
        "example.com",
        "",
        "0"
      );
      expect(spyLib.showNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: expect.stringContaining("example.com, devicebind.example.com"),
        }),
        expect.anything()
      );
      expect(spyLib.showNotification).not.toHaveBeenCalledWith(
        expect.objectContaining({
          msg: expect.stringContaining("https://"),
        }),
        expect.anything()
      );
    });
  });

  describe("filterSiteData()", () => {
    it("should return false for a blank cookie hostname", () => {
      const cleanReasonObj: CleanReasonObject = {
        cached: false,
        cleanCookie: true,
        cookie: {
          ...mockCookie,
          hostname: "",
        },
        openTabStatus: OpenTabStatus.TabsWasNotIgnored,
        reason: ReasonClean.NoMatchedExpression,
      };
      const result = filterSiteData(cleanReasonObj, SiteDataType.CACHE);
      expect(result).toBe(false);
    });

    it("should return true because of no matched expression", () => {
      const cleanReasonObj: CleanReasonObject = {
        cached: false,
        cleanCookie: true,
        cookie: {
          ...mockCookie,
        },
        openTabStatus: OpenTabStatus.TabsWasNotIgnored,
        reason: ReasonClean.NoMatchedExpression,
      };
      const result = filterSiteData(cleanReasonObj, SiteDataType.CACHE);
      expect(result).toBe(true);
    });
    it("should return true because of no matched expression on a ADCP marker cookie", () => {
      const cleanReasonObj: CleanReasonObject = {
        cached: false,
        cleanCookie: true,
        cookie: {
          ...mockCookie,
        },
        openTabStatus: OpenTabStatus.TabsWasNotIgnored,
        reason: ReasonClean.CADSiteDataCookie,
      };
      const result = filterSiteData(cleanReasonObj, SiteDataType.CACHE);
      expect(result).toBe(true);
    });
    it("should return true because of no matched expression on a ADCP marker cookie on restart", () => {
      const cleanReasonObj: CleanReasonObject = {
        cached: false,
        cleanCookie: true,
        cookie: {
          ...mockCookie,
        },
        openTabStatus: OpenTabStatus.TabsWasNotIgnored,
        reason: ReasonClean.CADSiteDataCookieRestart,
      };
      const result = filterSiteData(cleanReasonObj, SiteDataType.CACHE);
      expect(result).toBe(true);
    });
    it("should return true because of matched expression on a ADCP marker cookie on restart", () => {
      const cleanReasonObj: CleanReasonObject = {
        cached: false,
        cleanCookie: true,
        cookie: {
          ...mockCookie,
        },
        expression: {
          ...restartListCleanTest,
        },
        openTabStatus: OpenTabStatus.TabsWasNotIgnored,
        reason: ReasonClean.CADSiteDataCookieRestart,
      };
      const result = filterSiteData(cleanReasonObj, SiteDataType.CACHE);
      expect(result).toBe(true);
    });

    it("should return false because of a matched expression but cleanLocalStorage was undefined", () => {
      const cleanReasonObj: CleanReasonObject = {
        cached: false,
        cleanCookie: true,
        cookie: {
          ...youtubeCookie,
        },
        expression: {
          ...whiteListYoutube,
        },
        openTabStatus: OpenTabStatus.TabsWasNotIgnored,
        reason: ReasonKeep.MatchedExpression,
      };
      const result = filterSiteData(cleanReasonObj, SiteDataType.LOCALSTORAGE);
      expect(result).toBe(false);
    });

    it("should return true because of a matched expression but do not keep localstorage", () => {
      const cleanReasonObj: CleanReasonObject = {
        cached: false,
        cleanCookie: true,
        cookie: {
          ...youtubeCookie,
        },
        expression: {
          ...whiteListYoutube,
          cleanSiteData: [SiteDataType.LOCALSTORAGE],
        },
        openTabStatus: OpenTabStatus.TabsWasNotIgnored,
        reason: ReasonKeep.MatchedExpression,
      };
      const result = filterSiteData(cleanReasonObj, SiteDataType.LOCALSTORAGE);
      expect(result).toBe(true);
    });

    it("should return false because of a matched expression but do not keep localstorage + in an open tab", () => {
      const cleanReasonObj: CleanReasonObject = {
        cached: false,
        cleanCookie: true,
        cookie: {
          ...youtubeCookie,
        },
        expression: {
          ...whiteListYoutube,
          cleanSiteData: [SiteDataType.LOCALSTORAGE],
        },
        openTabStatus: OpenTabStatus.TabsWasNotIgnored,
        reason: ReasonKeep.OpenTabs,
      };
      const result = filterSiteData(cleanReasonObj, SiteDataType.LOCALSTORAGE);
      expect(result).toBe(false);
    });

    it("should not sanitize cookie value in adcpLog if debug is off", () => {
      const cleanReasonObj: CleanReasonObject = {
        cached: false,
        cleanCookie: true,
        cookie: {
          ...mockCookie,
        },
        openTabStatus: OpenTabStatus.TabsWasNotIgnored,
        reason: ReasonClean.NoMatchedExpression,
      };
      filterSiteData(cleanReasonObj, SiteDataType.CACHE);
      expect(
        spyLib.adcpLog.mock.calls[0][0].x.CleanReasonObject.cookie.value
      ).toEqual("value");
    });
    it("should sanitize cookie value in adcpLog if debug is on", () => {
      const cleanReasonObj: CleanReasonObject = {
        cached: false,
        cleanCookie: true,
        cookie: {
          ...mockCookie,
        },
        openTabStatus: OpenTabStatus.TabsWasNotIgnored,
        reason: ReasonClean.NoMatchedExpression,
      };
      filterSiteData(cleanReasonObj, SiteDataType.CACHE, true);
      expect(
        spyLib.adcpLog.mock.calls[0][0].x.CleanReasonObject.cookie.value
      ).toEqual("***");
    });
    it("should return false because of greyList expression for localstorage", () => {
      const cleanReasonObj: CleanReasonObject = {
        cached: false,
        cleanCookie: true,
        cookie: {
          ...restartCleanCookie,
        },
        expression: {
          ...restartListCleanTest,
        },
        openTabStatus: OpenTabStatus.TabsWasNotIgnored,
        reason: ReasonKeep.MatchedExpression,
      };
      const result = filterSiteData(cleanReasonObj, SiteDataType.LOCALSTORAGE);
      expect(result).toBe(false);
    });
    it("should return true because of greyList expression for localstorage and is restart cleanup mode", () => {
      const cleanReasonObj: CleanReasonObject = {
        cached: false,
        cleanCookie: true,
        cookie: {
          ...restartCleanCookie,
        },
        expression: {
          ...restartListCleanTest,
        },
        openTabStatus: OpenTabStatus.TabsWasNotIgnored,
        reason: ReasonClean.StartupCleanupAndGreyList,
      };
      const result = filterSiteData(cleanReasonObj, SiteDataType.LOCALSTORAGE);
      expect(result).toBe(true);
    });
    it("should return false because of whiteList expression with localstorage checked and is restart cleanup mode", () => {
      const cleanReasonObj: CleanReasonObject = {
        cached: false,
        cleanCookie: true,
        cookie: {
          ...mockCookie,
        },
        expression: {
          ...whiteListAllExceptTwitter,
        },
        openTabStatus: OpenTabStatus.TabsWasNotIgnored,
        reason: ReasonClean.CADSiteDataCookieRestart,
      };
      const result = filterSiteData(cleanReasonObj, SiteDataType.LOCALSTORAGE);
      expect(result).toBe(false);
    });
    it("should return true because of whiteList expression with localstorage unchecked and is restart cleanup mode", () => {
      const cleanReasonObj: CleanReasonObject = {
        cached: false,
        cleanCookie: true,
        cookie: {
          ...mockCookie,
        },
        expression: {
          ...whiteListAllExceptTwitter,
          cleanSiteData: [SiteDataType.LOCALSTORAGE],
        },
        openTabStatus: OpenTabStatus.TabsWasNotIgnored,
        reason: ReasonClean.CADSiteDataCookieRestart,
      };
      const result = filterSiteData(cleanReasonObj, SiteDataType.LOCALSTORAGE);
      expect(result).toBe(true);
    });
    it("should return true because of greyList expression for localstorage, unchecked localstorage and is not restart cleanup.", () => {
      const cleanReasonObj: CleanReasonObject = {
        cached: false,
        cleanCookie: true,
        cookie: {
          ...restartCleanCookie,
        },
        expression: {
          ...restartListCleanTest,
          cleanSiteData: [SiteDataType.LOCALSTORAGE],
        },
        openTabStatus: OpenTabStatus.TabsWasNotIgnored,
        reason: ReasonKeep.MatchedExpression,
      };
      const result = filterSiteData(cleanReasonObj, SiteDataType.LOCALSTORAGE);
      expect(result).toBe(true);
    });
    it("should return true because of greyList expression for localstorage, checked localstorage and is restart cleanup with expired cookie.", () => {
      const cleanReasonObj: CleanReasonObject = {
        cached: false,
        cleanCookie: true,
        cookie: {
          ...restartCleanCookie,
        },
        expression: {
          ...restartListCleanTest,
          cleanSiteData: [SiteDataType.LOCALSTORAGE],
        },
        openTabStatus: OpenTabStatus.TabsWasNotIgnored,
        reason: ReasonClean.ExpiredCookieRestart,
      };
      const result = filterSiteData(cleanReasonObj, SiteDataType.LOCALSTORAGE);
      expect(result).toBe(true);
    });
    it("should return true because of greyList expression for localstorage, checked localstorage (always clean) and is expired cookie but not restart cleanup.", () => {
      const cleanReasonObj: CleanReasonObject = {
        cached: false,
        cleanCookie: true,
        cookie: {
          ...restartCleanCookie,
        },
        expression: {
          ...restartListCleanTest,
          cleanSiteData: [SiteDataType.LOCALSTORAGE],
        },
        openTabStatus: OpenTabStatus.TabsWasNotIgnored,
        reason: ReasonClean.ExpiredCookie,
      };
      const result = filterSiteData(cleanReasonObj, SiteDataType.LOCALSTORAGE);
      expect(result).toBe(true);
    });
    it("should return false because of greyList expression and is not restart cleanup but has expired cookie.", () => {
      const cleanReasonObj: CleanReasonObject = {
        cached: false,
        cleanCookie: true,
        cookie: {
          ...restartCleanCookie,
        },
        expression: {
          ...restartListCleanTest,
        },
        openTabStatus: OpenTabStatus.TabsWasNotIgnored,
        reason: ReasonClean.ExpiredCookie,
      };
      const result = filterSiteData(cleanReasonObj, SiteDataType.LOCALSTORAGE);
      expect(result).toBe(false);
    });
    it("should return false for an expired cookie on restart with no expression (the ADCP-cookie shortcut only applies to CADSiteDataCookie reasons).", () => {
      // Previously expected true, but only because of an operator-precedence
      // bug in filterSiteData: `obj.reason === CADSiteDataCookie ||
      // ReasonClean.CADSiteDataCookieRestart` made the second operand a bare
      // always-truthy enum value, so any no-expression cookie qualified.
      // TypeScript 5 (TS2845) surfaced the bug; with the comparison fixed,
      // ExpiredCookieRestart no longer takes the ADCP-cookie shortcut.
      const cleanReasonObj: CleanReasonObject = {
        cached: false,
        cleanCookie: true,
        cookie: {
          ...restartCleanCookie,
        },
        openTabStatus: OpenTabStatus.TabsWasNotIgnored,
        reason: ReasonClean.ExpiredCookieRestart,
      };
      const result = filterSiteData(cleanReasonObj, SiteDataType.LOCALSTORAGE);
      expect(result).toBe(false);
    });
    it("should return false because of whitelist expression and is expired cookie.", () => {
      const cleanReasonObj: CleanReasonObject = {
        cached: false,
        cleanCookie: true,
        cookie: {
          ...mockCookie,
        },
        expression: whiteListAllExceptTwitter,
        openTabStatus: OpenTabStatus.TabsWasNotIgnored,
        reason: ReasonClean.ExpiredCookie,
      };
      const result = filterSiteData(cleanReasonObj, SiteDataType.LOCALSTORAGE);
      expect(result).toBe(false);
    });
  });

  describe("isSafeToClean()", () => {
    const cleanupProperties = {
      cachedResults: {
        dateTime: "",
        recentlyCleaned: 0,
      },
      greyCleanup: false,
      hostnamesDeleted: new Set(),
      ignoreOpenTabs: false,
      openTabDomains: { "0": ["example.com", "mozilla.org"] },
      setOfDeletedDomainCookies: new Set(),
    };
    const expiredState = {
      ...sampleState,
      settings: {
        ...sampleState.settings,
        [SettingID.CLEAN_EXPIRED]: {
          name: SettingID.CLEAN_EXPIRED,
          value: true,
        },
      },
    };

    it("should return true for yahoo.com", () => {
      const cookieProperty: CookiePropertiesCleanup = {
        ...mockCookie,
        hostname: "yahoo.com",
        mainDomain: "yahoo.com",
      };

      const result = isSafeToClean(sampleState, cookieProperty, {
        ...cleanupProperties,
      });
      expect(result.reason).toBe(ReasonClean.NoMatchedExpression);
      expect(result.cleanCookie).toBe(true);
    });

    it("should return false for youtube.com", () => {
      const cookieProperty = {
        ...mockCookie,
        hostname: "youtube.com",
        mainDomain: "youtube.com",
      };
      const result = isSafeToClean(sampleState, cookieProperty, {
        ...cleanupProperties,
      });
      expect(result.reason).toBe(ReasonKeep.MatchedExpression);
      expect(result.cleanCookie).toBe(false);
    });

    it("should return true for sub.youtube.com", () => {
      const cookieProperty = {
        ...mockCookie,
        hostname: "sub.youtube.com",
        mainDomain: "youtube.com",
      };

      const result = isSafeToClean(sampleState, cookieProperty, {
        ...cleanupProperties,
      });
      expect(result.reason).toBe(ReasonClean.NoMatchedExpression);
      expect(result.cleanCookie).toBe(true);
    });

    it("should return false for google.com", () => {
      const cookieProperty = {
        ...mockCookie,
        hostname: "google.com",
        mainDomain: "google.com",
      };

      const result = isSafeToClean(sampleState, cookieProperty, {
        ...cleanupProperties,
      });
      expect(result.reason).toBe(ReasonKeep.MatchedExpression);
      expect(result.cleanCookie).toBe(false);
    });

    it("should return false for github.com", () => {
      const cookieProperty = {
        ...mockCookie,
        hostname: "github.com",
        mainDomain: "github.com",
      };

      const result = isSafeToClean(sampleState, cookieProperty, {
        ...cleanupProperties,
      });
      expect(result.reason).toBe(ReasonKeep.MatchedExpression);
      expect(result.cleanCookie).toBe(false);
    });

    it("should return true for twitter.com when using regular expressions whiteListAllExceptTwitter", () => {
      const cookieProperty = {
        ...mockCookie,
        hostname: "twitter.com",
        mainDomain: "twitter.com",
      };
      const sampleRegExpState = {
        ...sampleState,
        lists: {
          ...sampleState.lists,
          default: [...sampleState.lists.default, whiteListAllExceptTwitter],
        },
      };

      const result = isSafeToClean(sampleRegExpState, cookieProperty, {
        ...cleanupProperties,
      });
      expect(result.reason).toBe(ReasonClean.NoMatchedExpression);
      expect(result.cleanCookie).toBe(true);
    });

    it("should return true for google.com in the private store", () => {
      const cookieProperty = {
        ...mockCookie,
        hostname: "google.com",
        mainDomain: "google.com",
        storeId: "1",
      };

      const result = isSafeToClean(sampleState, cookieProperty, {
        ...cleanupProperties,
      });
      expect(result.reason).toBe(ReasonClean.NoMatchedExpression);
      expect(result.cleanCookie).toBe(true);
    });

    it("should return false for sub.google.com", () => {
      const cookieProperty = {
        ...mockCookie,
        hostname: "sub.google.com",
        mainDomain: "google.com",
      };

      const result = isSafeToClean(sampleState, cookieProperty, {
        ...cleanupProperties,
      });
      expect(result.reason).toBe(ReasonKeep.MatchedExpression);
      expect(result.cleanCookie).toBe(false);
    });

    it("should return false for example.com because of opentab", () => {
      const cookieProperty = {
        ...mockCookie,
        hostname: "example.com",
        mainDomain: "example.com",
      };

      const result = isSafeToClean(sampleState, cookieProperty, {
        ...cleanupProperties,
      });
      expect(result.reason).toBe(ReasonKeep.OpenTabs);
      expect(result.cleanCookie).toBe(false);
    });

    it("should return false for sub.example.com", () => {
      const cookieProperty = {
        ...mockCookie,
        hostname: "sub.example.com",
        mainDomain: "example.com",
      };

      const result = isSafeToClean(sampleState, cookieProperty, {
        ...cleanupProperties,
      });
      expect(result.reason).toBe(ReasonKeep.OpenTabs);
      expect(result.openTabStatus).toBe(OpenTabStatus.TabsWasNotIgnored);
      expect(result.cleanCookie).toBe(false);
    });

    it("should return true for sub.example.com because tabs were ignored", () => {
      const cookieProperty = {
        ...mockCookie,
        hostname: "sub.example.com",
        mainDomain: "example.com",
      };

      const result = isSafeToClean(sampleState, cookieProperty, {
        ...cleanupProperties,
        ignoreOpenTabs: true,
        openTabDomains: {},
      });
      expect(result.reason).toBe(ReasonClean.NoMatchedExpression);
      expect(result.openTabStatus).toBe(OpenTabStatus.TabsWereIgnored);
      expect(result.cleanCookie).toBe(true);
    });

    it("should return true for Facebook in the private store onStartup with Facebook in the Greylist", () => {
      const cookieProperty = {
        ...mockCookie,
        hostname: "facebook.com",
        mainDomain: "facebook.com",
        storeId: "1",
      };

      const result = isSafeToClean(sampleState, cookieProperty, {
        ...cleanupProperties,
        greyCleanup: true,
      });
      expect(result.reason).toBe(ReasonClean.StartupCleanupAndGreyList);
      expect(result.cleanCookie).toBe(true);
    });

    it("should return true for startup cleanup and no matched expression", () => {
      const cookieProperty = {
        ...mockCookie,
        hostname: "nomatch.com",
        mainDomain: "nomatch.com",
      };

      const result = isSafeToClean(sampleState, cookieProperty, {
        ...cleanupProperties,
        greyCleanup: true,
      });
      expect(result.reason).toBe(ReasonClean.StartupNoMatchedExpression);
      expect(result.cleanCookie).toBe(true);
    });

    it("should return false for examplewithcookiename.com because it has a cookie name in the list (keepAllCookies: false)", () => {
      const cookieProperty = {
        ...mockCookie,
        hostname: "examplewithcookiename.com",
        mainDomain: "examplewithcookiename.com",
        name: "in-cookie-names",
      };

      const result = isSafeToClean(sampleState, cookieProperty, {
        ...cleanupProperties,
      });
      expect(result.reason).toBe(ReasonKeep.MatchedExpression);
      expect(result.cleanCookie).toBe(false);
    });

    it("should return true for examplewithcookiename.com because it does not have a cookie name in the list (keepAllCookies: false)", () => {
      const cookieProperty = {
        ...mockCookie,
        hostname: "examplewithcookiename.com",
        mainDomain: "examplewithcookiename.com",
        name: "not-in-cookie-names",
      };

      const result = isSafeToClean(sampleState, cookieProperty, {
        ...cleanupProperties,
      });
      expect(result.reason).toBe(ReasonClean.MatchedExpressionButNoCookieName);
      expect(result.cleanCookie).toBe(true);
    });

    it("should return false for exampleWithCookieNameCleanAllCookiesTrue.com because of (keepAllCookies: true)", () => {
      const cookieProperty = {
        ...mockCookie,
        hostname: "exampleWithCookieNameCleanAllCookiesTrue.com",
        mainDomain: "exampleWithCookieNameCleanAllCookiesTrue.com",
        name: "not-in-cookie-names",
      };

      const result = isSafeToClean(sampleState, cookieProperty, {
        ...cleanupProperties,
      });
      expect(result.reason).toBe(ReasonKeep.MatchedExpression);
      expect(result.cleanCookie).toBe(false);
    });

    it("should return false for examplewithcookiename.com because it has a cookie name in the list (Startup)", () => {
      const cookieProperty = {
        ...mockCookie,
        hostname: "examplewithcookiename.com",
        mainDomain: "examplewithcookiename.com",
        name: "in-cookie-names",
        storeId: "1",
      };

      const result = isSafeToClean(sampleState, cookieProperty, {
        ...cleanupProperties,
        greyCleanup: true,
      });
      expect(result.reason).toBe(ReasonKeep.MatchedExpression);
      expect(result.cleanCookie).toBe(false);
    });

    it("should return true for examplewithcookiename.com because it does not have a cookie name in the list (Startup)", () => {
      const cookieProperty = {
        ...mockCookie,
        hostname: "examplewithcookiename.com",
        mainDomain: "examplewithcookiename.com",
        name: "not-in-cookie-names",
        storeId: "1",
      };

      const result = isSafeToClean(sampleState, cookieProperty, {
        ...cleanupProperties,
        greyCleanup: true,
      });
      expect(result.reason).toBe(ReasonClean.StartupCleanupAndGreyList);
      expect(result.cleanCookie).toBe(true);
    });

    it("should return true for expired cookie if cleanExpiredCookies is enabled", () => {
      const cookieProperty = {
        ...mockCookie,
        expirationDate: 12345,
        session: false,
      };

      const result = isSafeToClean(
        expiredState,
        cookieProperty,
        cleanupProperties
      );
      expect(result.reason).toBe(ReasonClean.ExpiredCookie);
      expect(result.cleanCookie).toBe(true);
    });

    it("should return false for session cookie if cleanExpiredCookies is enabled", () => {
      const cookieProperty = {
        ...mockCookie,
        hostname: "sub.google.com",
        mainDomain: "google.com",
      };

      const result = isSafeToClean(expiredState, cookieProperty, {
        ...cleanupProperties,
      });
      expect(result.reason).toBe(ReasonKeep.MatchedExpression);
      expect(result.cleanCookie).toBe(false);
    });

    it("should include cleanSiteData if expired cookie matched an expression", () => {
      const cookieProperty = {
        ...mockCookie,
        hostname: "youtube.com",
        mainDomain: "youtube.com",
        expirationDate: 12345,
        session: false,
      };
      const result = isSafeToClean(
        expiredState,
        cookieProperty,
        cleanupProperties
      );
      expect(result.reason).toBe(ReasonClean.ExpiredCookie);
      expect(result.expression?.cleanSiteData).not.toBeUndefined();
    });

    it("should include cleanSiteData if expired cookie matched an expression on restart cleanup", () => {
      const cookieProperty = {
        ...mockCookie,
        hostname: "youtube.com",
        mainDomain: "youtube.com",
        expirationDate: 12345,
        session: false,
      };
      const result = isSafeToClean(expiredState, cookieProperty, {
        ...cleanupProperties,
        greyCleanup: true,
      });
      expect(result.reason).toBe(ReasonClean.ExpiredCookieRestart);
      expect(result.expression?.cleanSiteData).not.toBeUndefined();
    });

    it("should return true if cookie was created through CAD with matching WHITE expression and at least one browsingData type for cleanup", () => {
      const cookieProperty = {
        ...mockCookie,
        name: ADCPCOOKIENAME,
        hostname: "youtube.com",
        mainDomain: "youtube.com",
      };

      const result = isSafeToClean(sampleState, cookieProperty, {
        ...cleanupProperties,
      });
      expect(result.reason).toBe(ReasonClean.CADSiteDataCookie);
      expect(result.cleanCookie).toBe(true);
    });

    it("should return true if cookie was created through CAD with matching GREY expression and at least one browsingData type for cleanup and is browser restart", () => {
      const cookieProperty = {
        ...mockCookie,
        name: ADCPCOOKIENAME,
        hostname: "google.com",
        mainDomain: "google.com",
      };

      const result = isSafeToClean(sampleState, cookieProperty, {
        ...cleanupProperties,
        greyCleanup: true,
      });
      expect(result.reason).toBe(ReasonClean.CADSiteDataCookieRestart);
      expect(result.cleanCookie).toBe(true);
    });

    it("should return true if cookie was created through CAD with matching GREY expression and at least one browsingData type for instant cleanup (unchecked) but not during browser restart", () => {
      const cookieProperty = {
        ...mockCookie,
        name: ADCPCOOKIENAME,
        hostname: "restart.clean",
        mainDomain: "restart.clean",
      };

      const result = isSafeToClean(sampleState, cookieProperty, {
        ...cleanupProperties,
      });
      expect(result.reason).toBe(ReasonClean.CADSiteDataCookie);
      expect(result.cleanCookie).toBe(true);
    });
    it("should return false if cookie was created through CAD with matching GREY expression and none of the browsing data types are unchecked and is not browser restart", () => {
      const cookieProperty = {
        ...mockCookie,
        name: ADCPCOOKIENAME,
        hostname: "restart.clean.all",
        mainDomain: "restart.clean.all",
      };

      const result = isSafeToClean(sampleState, cookieProperty, {
        ...cleanupProperties,
      });
      expect(result.reason).toBe(ReasonKeep.MatchedExpression);
      expect(result.cleanCookie).toBe(false);
    });
    it('should return false if cookie was created through CAD with matching GREY expression and an empty "cleanSiteData" array and is not browser restart', () => {
      const cookieProperty = {
        ...mockCookie,
        name: ADCPCOOKIENAME,
        hostname: "another.restart.clean.all",
        mainDomain: "another.restart.clean.all",
      };

      const result = isSafeToClean(sampleState, cookieProperty, {
        ...cleanupProperties,
      });
      expect(result.reason).toBe(ReasonKeep.MatchedExpression);
      expect(result.cleanCookie).toBe(false);
    });
  });

  describe("otherBrowsingDataCleanup()", () => {
    // One type at a time on top of the all-off baseline, so each case can
    // assert that exactly its own data type gets removed.
    const siteDataOffState: State = {
      ...initialState,
      settings: siteDataOffSettings,
    };
    const withSiteData = (id: SettingID): State => ({
      ...initialState,
      settings: {
        ...siteDataOffSettings,
        [id]: { name: id, value: true },
      },
    });
    const cacheState = withSiteData(SettingID.CLEANUP_CACHE);
    const indexedDBState = withSiteData(SettingID.CLEANUP_INDEXEDDB);
    const localStorageState = withSiteData(SettingID.CLEANUP_LOCALSTORAGE);
    const pluginDataState = withSiteData(SettingID.CLEANUP_PLUGINDATA);
    const serviceWorkersState = withSiteData(SettingID.CLEANUP_SERVICEWORKERS);
    // initialState itself: pins the new-install default of all five types on.
    const allSiteDataState = initialState;

    beforeEach(() => {
      when(global.browser.browsingData.remove)
        .calledWith(expect.any(Object), expect.any(Object))
        .mockResolvedValue(undefined as never);
    });

    // Vitest cannot spy on intra-module calls (ESM bindings don't route
    // through the namespace object the way ts-jest's CJS output did), so
    // these assert the observable browsingData.remove effect instead of the
    // internal cleanSiteData dispatch.
    const unprotectedObj: CleanReasonObject = {
      cached: false,
      cleanCookie: true,
      cookie: {
        ...mockCookie,
      },
      openTabStatus: OpenTabStatus.TabsWasNotIgnored,
      reason: ReasonClean.NoMatchedExpression,
    };

    it("should return empty object if no other browsingData cleanup setting was enabled.", async () => {
      await otherBrowsingDataCleanup(siteDataOffState, [unprotectedObj]);
      expect(global.browser.browsingData.remove).not.toHaveBeenCalled();
    });

    it("should clean site data once per enabled SiteDataType", async () => {
      await otherBrowsingDataCleanup(allSiteDataState, [unprotectedObj]);
      expect(global.browser.browsingData.remove).toHaveBeenCalledTimes(5);
    });

    describe("Cache", () => {
      it("should clean site data for: cacheCleanup true", async () => {
        await otherBrowsingDataCleanup(cacheState, [unprotectedObj]);
        expect(global.browser.browsingData.remove).toHaveBeenCalledTimes(1);
        expect(global.browser.browsingData.remove).toHaveBeenCalledWith(
          { origins: expect.any(Array) },
          { cache: true }
        );
      });
    });

    describe("IndexedDB", () => {
      it("should clean site data for: indexedDBCleanup true", async () => {
        await otherBrowsingDataCleanup(indexedDBState, [unprotectedObj]);
        expect(global.browser.browsingData.remove).toHaveBeenCalledTimes(1);
        // Chrome files File System / OPFS data under its own key; it rides
        // along with IndexedDB (#464).
        expect(global.browser.browsingData.remove).toHaveBeenCalledWith(
          { origins: expect.any(Array) },
          { indexedDB: true, fileSystems: true }
        );
      });
    });

    describe("LocalStorage", () => {
      it("should clean site data for: localStorageCleanup true", async () => {
        await otherBrowsingDataCleanup(localStorageState, [unprotectedObj]);
        expect(global.browser.browsingData.remove).toHaveBeenCalledTimes(1);
        expect(global.browser.browsingData.remove).toHaveBeenCalledWith(
          { origins: expect.any(Array) },
          { localStorage: true }
        );
      });
    });

    describe("PluginData", () => {
      it("should clean site data for: pluginDataCleanup true", async () => {
        await otherBrowsingDataCleanup(pluginDataState, [unprotectedObj]);
        expect(global.browser.browsingData.remove).toHaveBeenCalledTimes(1);
        expect(global.browser.browsingData.remove).toHaveBeenCalledWith(
          { origins: expect.any(Array) },
          { pluginData: true }
        );
      });
    });

    describe("ServiceWorkers", () => {
      it("should clean site data for: serviceWorkersCleanup true", async () => {
        await otherBrowsingDataCleanup(serviceWorkersState, [unprotectedObj]);
        expect(global.browser.browsingData.remove).toHaveBeenCalledTimes(1);
        // Chrome's Cache Storage (the Cache API) rides along with service
        // workers, its main user (#464).
        expect(global.browser.browsingData.remove).toHaveBeenCalledWith(
          { origins: expect.any(Array) },
          { serviceWorkers: true, cacheStorage: true }
        );
      });
    });
  });

  describe("prepareCookie()", () => {
    it("should call all three relevant functions by default", () => {
      prepareCookie(mockCookie);
      expect(spyLib.prepareCookieDomain).toHaveBeenCalledTimes(1);
      expect(spyLib.getHostname).toHaveBeenCalledTimes(1);
      expect(spyLib.extractMainDomain).toHaveBeenCalledTimes(1);
    });

    it("should only call one function for all three properties if it is a local file", () => {
      const mockFileCookie = {
        ...mockCookie,
        domain: "",
        path: "/folder/file.html",
      };

      const result = prepareCookie(mockFileCookie);
      expect(spyLib.prepareCookieDomain).toHaveBeenCalledTimes(1);
      expect(spyLib.getHostname).not.toHaveBeenCalled();
      expect(spyLib.extractMainDomain).not.toHaveBeenCalled();

      expect(result.preparedCookieDomain).toBe("file:///folder/file.html");
      expect(result.hostname).toBe("file:///folder/file.html");
      expect(result.mainDomain).toBe("file:///folder/file.html");
    });
  });

  describe("removeSiteData()", () => {
    it("should use origins for domains", async () => {
      await removeSiteData(sampleState, SiteDataType.CACHE, ["test"], false);
      expect(global.browser.browsingData.remove).toHaveBeenCalledWith(
        { origins: ["test"] },
        { cache: true }
      );
    });
    it("removes Chrome's Cache Storage together with service workers", async () => {
      await removeSiteData(
        sampleState,
        SiteDataType.SERVICEWORKERS,
        ["https://example.com"],
        false
      );
      expect(global.browser.browsingData.remove).toHaveBeenCalledWith(
        { origins: ["https://example.com"] },
        { serviceWorkers: true, cacheStorage: true }
      );
    });
    it("removes Chrome's File System data together with IndexedDB", async () => {
      await removeSiteData(
        sampleState,
        SiteDataType.INDEXEDDB,
        ["https://example.com"],
        false
      );
      expect(global.browser.browsingData.remove).toHaveBeenCalledWith(
        { origins: ["https://example.com"] },
        { indexedDB: true, fileSystems: true }
      );
    });
    it("should return false if an error occurred", async () => {
      when(global.browser.browsingData.remove)
        .calledWith(expect.any(Object), expect.any(Object))
        .mockRejectedValue(new Error("test") as never);
      expect(
        await removeSiteData(sampleState, SiteDataType.CACHE, ["test"], false)
      ).toBe(false);
    });
    it("should return false if an error occurred, but not show the error notification if a non-error type is thrown (edge-case)", async () => {
      when(global.browser.browsingData.remove)
        .calledWith(expect.any(Object), expect.any(Object))
        .mockRejectedValue("error" as never);
      expect(
        await removeSiteData(sampleState, SiteDataType.CACHE, ["test"], false)
      ).toBe(false);
      expect(spyLib.throwErrorNotification).not.toHaveBeenCalled();
    });
  });

  describe("returnContainersOfOpenTabDomains()", () => {
    beforeEach(() => {
      when(global.browser.tabs.query)
        .calledWith(expect.any(Object))
        .mockResolvedValue([
          {
            incognito: false,
            url: "https://google.com/search",
          },
          {
            incognito: false,
            url: "http://facebook.com/search",
          },
          {
            incognito: false,
            url: "http://sub.domain.com",
          },
          {
            incognito: false,
            url: "chrome-extension://test/settings/settings.html",
          },
          {
            incognito: true,
            url: "https://sub.domain.com",
          },
          {
            incognito: true,
            discarded: true,
            url: "https://discarded.net",
          },
          {
            incognito: false,
            url: "https://chrome.link",
          },
          {
            incognito: true,
            url: "https://incognitochrome.link",
          },
        ] as never);
    });

    it("should return empty object if ignoreOpenTabs is true and cleanDiscardedTabs is false", () => {
      return returnContainersOfOpenTabDomains(true, false).then((results) => {
        expect(Object.keys(results).length).toEqual(0);
        return Promise.resolve();
      });
    });

    it("should return empty object if ignoreOpenTabs is true and cleanDiscardedTabs is true", () => {
      return returnContainersOfOpenTabDomains(true, true).then((results) => {
        expect(Object.keys(results).length).toEqual(0);
        return Promise.resolve();
      });
    });

    it("sort tab query result accordingly, cleanDiscardedTabs is false", () => {
      return returnContainersOfOpenTabDomains(false, false).then((results) => {
        expect(Object.keys(results).length).toBe(2);

        // Chrome Regular cookieStore.
        expect(results["0"]).toHaveLength(4);
        expect(results["0"]).toEqual([
          "google.com",
          "facebook.com",
          "domain.com",
          "chrome.link",
        ]);

        // Chrome Incognito cookieStore.
        expect(results["1"]).toHaveLength(3);
        expect(results["1"]).toEqual([
          "domain.com",
          "discarded.net",
          "incognitochrome.link",
        ]);
        return Promise.resolve();
      });
    });

    it("should not have youtube.com in any cookie stores, cleanDiscardedTabs is false", () => {
      return returnContainersOfOpenTabDomains(false, false).then((results) => {
        expect(results["0"]).not.toContain("youtube.com");
        expect(results["1"]).not.toContain("youtube.com");
        return Promise.resolve();
      });
    });

    // Firefox tabs expose their real store id; grouping must use it so
    // containers protect their own tabs only.
    it("should group Firefox tabs by their real cookieStoreId", () => {
      when(global.browser.tabs.query)
        .calledWith(expect.any(Object))
        .mockResolvedValue([
          {
            cookieStoreId: "firefox-default",
            incognito: false,
            url: "https://google.com/search",
          },
          {
            cookieStoreId: "firefox-private",
            incognito: true,
            url: "https://secret.example/inbox",
          },
          {
            cookieStoreId: "firefox-container-1",
            incognito: false,
            url: "https://work.example/dashboard",
          },
          {
            cookieStoreId: "firefox-container-2",
            incognito: false,
            url: "https://work.example/personal",
          },
        ] as never);
      return returnContainersOfOpenTabDomains(false, false).then((results) => {
        expect(results["firefox-default"]).toEqual(["google.com"]);
        expect(results["firefox-private"]).toEqual(["secret.example"]);
        expect(results["firefox-container-1"]).toEqual(["work.example"]);
        expect(results["firefox-container-2"]).toEqual(["work.example"]);
        // No incognito-flag pseudo keys when the real store id exists.
        expect(results["0"]).toBeUndefined();
        expect(results["1"]).toBeUndefined();
        return Promise.resolve();
      });
    });

    it("should not have discarded.net in the incognito store when cleanDiscardedTabs is true", () => {
      return returnContainersOfOpenTabDomains(false, true).then((results) => {
        expect(results["1"]).not.toContain("discarded.net");
        return Promise.resolve();
      });
    });
  });

  // Regression: the keys returnContainersOfOpenTabDomains emits must be the
  // SAME key space as cookie.storeId, because isSafeToClean indexes
  // openTabDomains[cookie.storeId] directly. Upstream keyed tabs by the
  // incognito flag while Firefox cookies carried firefox-* ids, which
  // silently disabled open-tab protection there.
  describe("open-tab protection key space (tab grouping ↔ cookie storeId)", () => {
    const baseCleanupProperties = {
      greyCleanup: false,
      ignoreOpenTabs: false,
    };

    it("protects a Firefox container tab's domain only within that container", async () => {
      when(global.browser.tabs.query)
        .calledWith(expect.any(Object))
        .mockResolvedValue([
          {
            cookieStoreId: "firefox-container-1",
            incognito: false,
            url: "https://work.example/dashboard",
          },
        ] as never);
      const openTabDomains = await returnContainersOfOpenTabDomains(
        false,
        false
      );
      const containerCookie: CookiePropertiesCleanup = {
        ...mockCookie,
        hostname: "work.example",
        mainDomain: "work.example",
        storeId: "firefox-container-1",
      };

      const sameContainer = isSafeToClean(sampleState, containerCookie, {
        ...baseCleanupProperties,
        openTabDomains,
      });
      expect(sameContainer.reason).toBe(ReasonKeep.OpenTabs);
      expect(sameContainer.cleanCookie).toBe(false);

      // Same domain open, but the cookie lives in a different container:
      // no open-tab protection across stores.
      const otherContainer = isSafeToClean(
        sampleState,
        { ...containerCookie, storeId: "firefox-container-2" },
        { ...baseCleanupProperties, openTabDomains }
      );
      expect(otherContainer.reason).toBe(ReasonClean.NoMatchedExpression);
      expect(otherContainer.cleanCookie).toBe(true);
    });

    it("keeps Chrome normal/incognito grouping working end to end", async () => {
      when(global.browser.tabs.query)
        .calledWith(expect.any(Object))
        .mockResolvedValue([
          { incognito: false, url: "https://open.example/page" },
          { incognito: true, url: "https://hidden.example/page" },
        ] as never);
      const openTabDomains = await returnContainersOfOpenTabDomains(
        false,
        false
      );
      expect(openTabDomains).toEqual({
        "0": ["open.example"],
        "1": ["hidden.example"],
      });

      const normalCookie: CookiePropertiesCleanup = {
        ...mockCookie,
        hostname: "open.example",
        mainDomain: "open.example",
        storeId: "0",
      };
      const protectedNormal = isSafeToClean(sampleState, normalCookie, {
        ...baseCleanupProperties,
        openTabDomains,
      });
      expect(protectedNormal.reason).toBe(ReasonKeep.OpenTabs);

      const incognitoCookie: CookiePropertiesCleanup = {
        ...normalCookie,
        hostname: "hidden.example",
        mainDomain: "hidden.example",
        storeId: "1",
      };
      const protectedIncognito = isSafeToClean(sampleState, incognitoCookie, {
        ...baseCleanupProperties,
        openTabDomains,
      });
      expect(protectedIncognito.reason).toBe(ReasonKeep.OpenTabs);
    });
  });

  // Audit bug 2: partitioned third-party cookies (CHIPS on Chrome, TCP on
  // Firefox). Open-tab protection keys on the PARTITION's top-level site —
  // the site the user actually visits — while keep rules match the
  // cookie's own domain (#490) and removal targets that domain with the
  // exact enumerated partitionKey echoed back.
  describe("partitioned cookies (CHIPS/TCP)", () => {
    const partitionedCookie: browser.cookies.Cookie = {
      domain: "tracker.example",
      hostOnly: true,
      httpOnly: false,
      name: "ptrack",
      partitionKey: { topLevelSite: "https://shop.example" },
      path: "/",
      sameSite: "no_restriction",
      secure: true,
      session: false,
      storeId: "0",
      value: "x",
    };
    const baseCleanupProperties = {
      greyCleanup: false,
      ignoreOpenTabs: false,
    };

    it("keys open tabs on the partition's top-level site, rules and removal on the cookie domain", () => {
      const prepared = prepareCookie(partitionedCookie);
      expect(prepared.hostname).toBe("tracker.example");
      expect(prepared.mainDomain).toBe("shop.example");
      expect(prepared.preparedCookieDomain).toBe("https://tracker.example/");
    });

    it("keeps a subdomain cookie's own host for rules to match", () => {
      const prepared = prepareCookie({
        ...partitionedCookie,
        domain: ".cdn.tracker.example",
        hostOnly: false,
        partitionKey: { topLevelSite: "https://www.shop.example" },
      });
      expect(prepared.hostname).toBe("cdn.tracker.example");
      expect(prepared.mainDomain).toBe("shop.example");
    });

    it("keeps unpartitioned cookie keying unchanged", () => {
      const prepared = prepareCookie({
        ...partitionedCookie,
        partitionKey: undefined,
      });
      expect(prepared.hostname).toBe("tracker.example");
      expect(prepared.mainDomain).toBe("tracker.example");
    });

    it("keeps the partition while its top-level site is open, cleans it after", () => {
      const prepared = prepareCookie(partitionedCookie);
      const whileOpen = isSafeToClean(sampleState, prepared, {
        ...baseCleanupProperties,
        openTabDomains: { "0": ["shop.example"] },
      });
      expect(whileOpen.reason).toBe(ReasonKeep.OpenTabs);
      expect(whileOpen.cleanCookie).toBe(false);

      const afterClose = isSafeToClean(sampleState, prepared, {
        ...baseCleanupProperties,
        openTabDomains: {},
      });
      expect(afterClose.cleanCookie).toBe(true);
      expect(afterClose.reason).toBe(ReasonClean.NoMatchedExpression);
    });

    const whitelistState = (expression: string): State => ({
      ...initialState,
      lists: {
        default: [
          {
            expression,
            listType: ListType.WHITE,
            storeId: "default",
          },
        ],
      },
    });

    // #490: whitelisting a site kept every third-party cookie that Total
    // Cookie Protection stores under it.
    it("cleans a third-party cookie when only its top-level site is whitelisted", () => {
      const prepared = prepareCookie(partitionedCookie);
      const result = isSafeToClean(whitelistState("shop.example"), prepared, {
        ...baseCleanupProperties,
        openTabDomains: {},
      });
      expect(result.cleanCookie).toBe(true);
      expect(result.reason).toBe(ReasonClean.NoMatchedExpression);
    });

    it("still protects it while the whitelisted top-level site is open", () => {
      const prepared = prepareCookie(partitionedCookie);
      const result = isSafeToClean(whitelistState("shop.example"), prepared, {
        ...baseCleanupProperties,
        openTabDomains: { "0": ["shop.example"] },
      });
      expect(result.cleanCookie).toBe(false);
      expect(result.reason).toBe(ReasonKeep.OpenTabs);
    });

    // #511: its own domain's rule alone no longer keeps it. The cookie is
    // only ever sent on the site it is partitioned under, so that site
    // has to be kept too.
    it("cleans a third-party cookie whose own domain is whitelisted but whose top-level site is not", () => {
      const prepared = prepareCookie(partitionedCookie);
      const result = isSafeToClean(
        whitelistState("tracker.example"),
        prepared,
        {
          ...baseCleanupProperties,
          openTabDomains: {},
        }
      );
      expect(result.cleanCookie).toBe(true);
      expect(result.reason).toBe(ReasonClean.PartitionNotKept);
    });

    it("keeps a third-party cookie when its own domain and its top-level site are whitelisted", () => {
      const prepared = prepareCookie(partitionedCookie);
      const both: State = {
        ...initialState,
        lists: {
          default: ["tracker.example", "shop.example"].map((expression) => ({
            expression,
            listType: ListType.WHITE,
            storeId: "default",
          })),
        },
      };
      const result = isSafeToClean(both, prepared, {
        ...baseCleanupProperties,
        openTabDomains: {},
      });
      expect(result.cleanCookie).toBe(false);
      expect(result.reason).toBe(ReasonKeep.MatchedExpression);
    });

    it("keeps a whitelisted site's own partitioned cookie (CHIPS)", () => {
      const prepared = prepareCookie({
        ...partitionedCookie,
        domain: "shop.example",
      });
      const result = isSafeToClean(whitelistState("shop.example"), prepared, {
        ...baseCleanupProperties,
        openTabDomains: {},
      });
      expect(result.cleanCookie).toBe(false);
      expect(result.reason).toBe(ReasonKeep.MatchedExpression);
    });

    it("does not let the cookie domain's own tab protect the partition", () => {
      const prepared = prepareCookie(partitionedCookie);
      const result = isSafeToClean(sampleState, prepared, {
        ...baseCleanupProperties,
        openTabDomains: { "0": ["tracker.example"] },
      });
      expect(result.cleanCookie).toBe(true);
    });

    it("removes with the exact enumerated partitionKey passed verbatim", async () => {
      when(global.browser.cookies.remove)
        .calledWith(expect.any(Object))
        .mockResolvedValue({} as never);
      // Extra future fields (Chrome 130's hasCrossSiteAncestor) must ride
      // along untouched.
      const enumerated = {
        ...partitionedCookie,
        partitionKey: {
          topLevelSite: "https://shop.example",
          hasCrossSiteAncestor: true,
        },
      } as unknown as browser.cookies.Cookie;
      const reasonObj: CleanReasonObject = {
        cached: false,
        cleanCookie: true,
        cookie: prepareCookie(enumerated),
        openTabStatus: OpenTabStatus.TabsWasNotIgnored,
        reason: ReasonClean.NoMatchedExpression,
      };
      await cleanCookies(initialState, [reasonObj]);
      expect(global.browser.cookies.remove).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "ptrack",
          storeId: "0",
          url: "https://tracker.example/",
          partitionKey: {
            topLevelSite: "https://shop.example",
            hasCrossSiteAncestor: true,
          },
        })
      );
    });

    it("does not add a partitionKey to unpartitioned removals", async () => {
      when(global.browser.cookies.remove)
        .calledWith(expect.any(Object))
        .mockResolvedValue({} as never);
      const reasonObj: CleanReasonObject = {
        cached: false,
        cleanCookie: true,
        cookie: prepareCookie({
          ...partitionedCookie,
          partitionKey: undefined,
        }),
        openTabStatus: OpenTabStatus.TabsWasNotIgnored,
        reason: ReasonClean.NoMatchedExpression,
      };
      await cleanCookies(initialState, [reasonObj]);
      const removeArg = global.browser.cookies.remove.mock.calls[0][0];
      expect(removeArg).not.toHaveProperty("partitionKey");
    });
  });
  // Chrome's cookies.remove resolves with its details even when no cookie
  // matched, so one #464 cleanup logged 29 removals while 20 of those
  // cookies were still there. Only cookies gone on a second read count.
  describe("removal confirmation on Chrome", () => {
    const cleanupProperties: CleanupProperties = {
      greyCleanup: false,
      ignoreOpenTabs: true,
    };
    const siteA: browser.cookies.Cookie = {
      ...mockCookie,
      domain: "a.example",
      name: "a",
    };
    const siteB: browser.cookies.Cookie = {
      ...mockCookie,
      domain: "b.example",
      name: "b",
    };
    // Scheme-bound twins: Chrome keys them apart by source scheme, which
    // the cookies API does not show, so they look identical here.
    const twinHttps: browser.cookies.Cookie = {
      ...mockCookie,
      domain: "twin.example",
      name: "sid",
      secure: false,
    };
    const twinHttp: browser.cookies.Cookie = { ...twinHttps };
    const marked = (cookie: browser.cookies.Cookie): CleanReasonObject => ({
      cached: false,
      cleanCookie: true,
      cookie: prepareCookie(cookie),
      openTabStatus: OpenTabStatus.TabsWereIgnored,
      reason: ReasonClean.NoMatchedExpression,
    });

    beforeEach(() => {
      global.browser.cookies.getAll.mockReset();
      global.browser.cookies.remove.mockReset();
      when(global.browser.tabs.query)
        .calledWith(expect.any(Object))
        .mockResolvedValue([] as never);
      when(global.browser.extension.isAllowedIncognitoAccess)
        .calledWith()
        .mockResolvedValue(false as never);
      when(global.browser.cookies.getAllCookieStores)
        .calledWith()
        .mockResolvedValue([{ id: "0" }] as never);
    });

    it("does not count a cookie that cookies.remove missed", async () => {
      const jar = chromeCookieJar([siteA, siteB], [siteB]);
      const result = await cleanCookies(initialState, [
        marked(siteA),
        marked(siteB),
      ]);
      expect(global.browser.cookies.remove).toHaveBeenCalledTimes(2);
      expect(result.removed.map((o) => o.cookie.name)).toEqual(["a"]);
      expect(result.failedCount).toBe(1);
      expect(result.firstError).toBeUndefined();
      expect(jar).toEqual([siteB]);
    });

    it("reads each store once more after removing", async () => {
      chromeCookieJar([siteA, { ...siteB, storeId: "1" }]);
      await cleanCookies(initialState, [
        marked(siteA),
        marked({ ...siteB, storeId: "1" }),
      ]);
      expect(global.browser.cookies.getAll.mock.calls).toEqual([
        [{ storeId: "0", partitionKey: {} }],
        [{ storeId: "1", partitionKey: {} }],
      ]);
    });

    it("counts one of two scheme-bound twins when only one goes", async () => {
      chromeCookieJar([twinHttps, twinHttp], [twinHttp]);
      const result = await cleanCookies(
        initialState,
        [marked(twinHttps), marked(twinHttp)],
        [[twinHttps, twinHttp]]
      );
      expect(result.removed).toHaveLength(1);
      expect(result.failedCount).toBe(1);
    });

    it("keeps what cookies.remove reported when the store cannot be read again", async () => {
      when(global.browser.cookies.remove)
        .calledWith(expect.any(Object))
        .mockResolvedValue({} as never);
      when(global.browser.cookies.getAll)
        .calledWith(expect.any(Object))
        .mockRejectedValue(new Error("No cookie store found") as never);
      const result = await cleanCookies(initialState, [marked(siteA)]);
      expect(result.removed).toHaveLength(1);
      expect(spyLib.adcpLog).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: expect.stringContaining("could not read store 0 again"),
          type: "warn",
        }),
        false
      );
    });

    it("logs a cookie that is still there after removing", async () => {
      chromeCookieJar([siteA], [siteA]);
      await cleanCookies(initialState, [marked(siteA)]);
      expect(spyLib.adcpLog).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: expect.stringContaining("the cookie is still there"),
          x: expect.objectContaining({ name: "a", domain: "a.example" }),
        }),
        false
      );
    });

    it("leaves missed cookies out of the log count, the stores and the domains", async () => {
      chromeCookieJar([siteA, siteB, twinHttps, twinHttp], [siteB, twinHttp]);
      const result = await cleanCookiesOperation(
        sampleState,
        cleanupProperties
      );
      expect(global.browser.cookies.remove).toHaveBeenCalledTimes(4);
      expect(result.cachedResults.recentlyCleaned).toBe(2);
      expect(
        result.cachedResults.storeIds["0"].map(
          (o: CleanReasonObject) => o.cookie.domain
        )
      ).toEqual(["a.example", "twin.example"]);
      expect(result.setOfDeletedDomainCookies).toEqual([
        "a.example",
        "twin.example",
      ]);
    });

    it("counts a cookie a page set again before the second read as not removed", async () => {
      const jar = chromeCookieJar([siteA]);
      when(global.browser.cookies.remove)
        .calledWith(expect.any(Object))
        .mockImplementationOnce(async (details: object) => {
          // Removed, then set again by the page straight away.
          return details;
        });
      const result = await cleanCookiesOperation(
        sampleState,
        cleanupProperties
      );
      expect(jar).toEqual([siteA]);
      expect(result.cachedResults.recentlyCleaned).toBe(0);
      expect(result.setOfDeletedDomainCookies).toEqual([]);
    });

    describe("clearCookiesForThisDomain()", () => {
      const tab: browser.tabs.Tab = { ...sampleTab, url: "https://a.example" };
      const siteA2: browser.cookies.Cookie = { ...siteA, name: "a2" };

      beforeEach(() => {
        when(global.browser.i18n.getMessage)
          .calledWith(expect.any(String))
          .mockReturnValue("");
        when(global.browser.i18n.getMessage)
          .calledWith(expect.any(String), expect.any(Array))
          .mockReturnValue("");
        for (const topLevelSite of ["https://a.example", "http://a.example"]) {
          when(global.browser.cookies.getAll)
            .calledWith({ partitionKey: { topLevelSite }, storeId: "0" })
            .mockResolvedValue([] as never);
        }
      });
      const trainDomainQuery = (jar: browser.cookies.Cookie[]) =>
        when(global.browser.cookies.getAll)
          .calledWith({ domain: "a.example", storeId: "0", partitionKey: {} })
          .mockImplementation(async () => [...jar]);

      it("reports only the cookies that are really gone", async () => {
        trainDomainQuery(chromeCookieJar([siteA, siteA2], [siteA2]));
        expect(await clearCookiesForThisDomain(initialState, tab)).toBe(true);
        expect(global.browser.cookies.remove).toHaveBeenCalledTimes(2);
        expect(global.browser.i18n.getMessage).toHaveBeenCalledWith(
          "manualCleanRemoved",
          ["1", "2"]
        );
      });

      it("returns false when every removal missed", async () => {
        trainDomainQuery(chromeCookieJar([siteA, siteA2], [siteA, siteA2]));
        expect(await clearCookiesForThisDomain(initialState, tab)).toBe(false);
        expect(global.browser.i18n.getMessage).toHaveBeenCalledWith(
          "manualCleanRemoved",
          ["0", "2"]
        );
      });

      it("counts the scheme-bound twin that went although only one was listed after dedupe", async () => {
        const twinA: browser.cookies.Cookie = { ...siteA };
        trainDomainQuery(chromeCookieJar([siteA, twinA], [twinA]));
        await clearCookiesForThisDomain(initialState, tab);
        // dedupeCookies keeps one of the twins, so one removal is sent.
        expect(global.browser.cookies.remove).toHaveBeenCalledTimes(1);
        expect(global.browser.i18n.getMessage).toHaveBeenCalledWith(
          "manualCleanRemoved",
          ["1", "1"]
        );
      });
    });
  });

  describe("cookieIdentityKey()", () => {
    it("tells partitions apart by top-level site and cross-site ancestor", () => {
      const base = { ...mockCookie, partitionKey: undefined };
      const keys = new Set(
        [
          base,
          { ...base, partitionKey: { topLevelSite: "https://a.example" } },
          {
            ...base,
            partitionKey: {
              topLevelSite: "https://a.example",
              hasCrossSiteAncestor: true,
            },
          },
          {
            ...base,
            partitionKey: {
              topLevelSite: "https://a.example",
              hasCrossSiteAncestor: false,
            },
          },
          { ...base, storeId: "1" },
          { ...base, path: "/other" },
          { ...base, firstPartyDomain: "test.com" },
        ].map((c) => cookieIdentityKey(c as browser.cookies.Cookie))
      );
      expect(keys.size).toBe(7);
    });

    it("ignores value, expiry and flags", () => {
      expect(
        cookieIdentityKey({
          ...mockCookie,
          value: "other",
          secure: false,
          expirationDate: 1,
        })
      ).toBe(cookieIdentityKey(mockCookie));
    });
  });
});

describe("clearCookieTypeSiteData() (#464)", () => {
  const keptCookie = {
    domain: "keep.ebay.com.au",
    hostOnly: true,
    name: "kept",
    path: "/",
    storeId: "0",
  };
  const removals = (): unknown[][] =>
    global.browser.browsingData.remove.mock.calls.filter(
      (call: unknown[]) =>
        (call[1] as Record<string, boolean> | undefined)?.cookies === true
    );
  beforeEach(() => {
    global.browser.cookies.getAll.mockReset();
    global.browser.browsingData.remove.mockReset();
    global.browser.cookies.getAll.mockResolvedValue([] as never);
    global.browser.browsingData.remove.mockResolvedValue(undefined as never);
  });

  it("clears a site with no cookies left, in one call for all its hosts", async () => {
    expect(
      await clearCookieTypeSiteData(
        [".ebay.com.au", "www.ebay.com.au", "signup.ebay.com.au"],
        "0",
        false
      )
    ).toEqual(["ebay.com.au"]);
    expect(global.browser.browsingData.remove).toHaveBeenCalledTimes(1);
    const [[scope, types]] = global.browser.browsingData.remove.mock.calls;
    expect(types).toEqual({ cookies: true });
    expect(scope.origins).toEqual(
      expect.arrayContaining([
        "https://ebay.com.au",
        "https://www.ebay.com.au",
        "https://signup.ebay.com.au",
        "http://signup.ebay.com.au",
      ])
    );
  });

  it("looks for cookies left on every host and partition of the site, and partitioned under it", async () => {
    await clearCookieTypeSiteData(["www.ebay.com.au"], "0", false);
    expect(global.browser.cookies.getAll).toHaveBeenCalledWith({
      domain: "ebay.com.au",
      storeId: "0",
      partitionKey: {},
    });
    expect(global.browser.cookies.getAll).toHaveBeenCalledWith({
      partitionKey: { topLevelSite: "https://ebay.com.au" },
      storeId: "0",
    });
    expect(global.browser.cookies.getAll).toHaveBeenCalledWith({
      partitionKey: { topLevelSite: "http://ebay.com.au" },
      storeId: "0",
    });
  });

  it("leaves a site alone while a kept cookie is left on any of its hosts", async () => {
    when(global.browser.cookies.getAll)
      .calledWith({ domain: "ebay.com.au", storeId: "0", partitionKey: {} })
      .mockResolvedValue([keptCookie] as never);
    expect(
      await clearCookieTypeSiteData(["www.ebay.com.au"], "0", false)
    ).toEqual([]);
    expect(removals()).toEqual([]);
  });

  it("leaves a site alone while a cookie is partitioned under it", async () => {
    when(global.browser.cookies.getAll)
      .calledWith({
        partitionKey: { topLevelSite: "https://ebay.com.au" },
        storeId: "0",
      })
      .mockResolvedValue([
        { ...keptCookie, domain: "tracker.example" },
      ] as never);
    expect(
      await clearCookieTypeSiteData(["www.ebay.com.au"], "0", false)
    ).toEqual([]);
    expect(removals()).toEqual([]);
  });

  it("decides for each site on its own", async () => {
    when(global.browser.cookies.getAll)
      .calledWith({ domain: "ebay.com.au", storeId: "0", partitionKey: {} })
      .mockResolvedValue([keptCookie] as never);
    expect(
      await clearCookieTypeSiteData(
        ["www.ebay.com.au", "www.example.com"],
        "0",
        false
      )
    ).toEqual(["example.com"]);
    expect(removals()).toHaveLength(1);
  });

  it("keeps going when one site's lookup fails", async () => {
    when(global.browser.cookies.getAll)
      .calledWith({ domain: "ebay.com.au", storeId: "0", partitionKey: {} })
      .mockRejectedValue(new Error("lookup failed") as never);
    expect(
      await clearCookieTypeSiteData(
        ["www.ebay.com.au", "www.example.com"],
        "0",
        false
      )
    ).toEqual(["example.com"]);
  });

  it("does nothing outside Chrome's regular store", async () => {
    expect(
      await clearCookieTypeSiteData(["www.ebay.com.au"], "1", false)
    ).toEqual([]);
    expect(global.browser.cookies.getAll).not.toHaveBeenCalled();
    expect(global.browser.browsingData.remove).not.toHaveBeenCalled();
  });

  it("does nothing without site-data domains", async () => {
    expect(await clearCookieTypeSiteData(["", " "], "0", false)).toEqual([]);
    expect(global.browser.browsingData.remove).not.toHaveBeenCalled();
  });

  it("runs after a cleanup that cleaned a site's storage", async () => {
    const ebayCookie = {
      domain: ".ebay.com.au",
      hostOnly: false,
      httpOnly: false,
      name: "s",
      path: "/",
      sameSite: "no_restriction",
      secure: true,
      session: true,
      storeId: "0",
      value: "x",
    };
    when(global.browser.extension.isAllowedIncognitoAccess)
      .calledWith()
      .mockResolvedValue(false as never);
    when(global.browser.tabs.query)
      .calledWith(expect.any(Object))
      .mockResolvedValue([] as never);
    when(global.browser.cookies.getAllCookieStores)
      .calledWith()
      .mockResolvedValue([{ id: "0" }] as never);
    when(global.browser.cookies.getAll)
      .calledWith({ storeId: "0", partitionKey: {} })
      .mockResolvedValue([ebayCookie] as never);
    global.browser.cookies.remove.mockReset();
    when(global.browser.cookies.remove)
      .calledWith(expect.any(Object))
      .mockResolvedValue({} as never);

    await cleanCookiesOperation(initialState, {
      greyCleanup: false,
      ignoreOpenTabs: false,
    });

    expect(removals()).toHaveLength(1);
    expect(removals()[0][0]).toEqual({
      origins: expect.arrayContaining(["https://www.ebay.com.au"]),
    });
  });
});
