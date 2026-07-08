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
  clearLocalStorageForThisDomain,
  clearSiteDataForThisDomain,
  filterSiteData,
  isSafeToClean,
  otherBrowsingDataCleanup,
  prepareCookie,
  removeSiteData,
  returnContainersOfOpenTabDomains,
} from "@/services/cleanup-service";

import * as Lib from "@/services/libs";

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
        when(global.browser.cookies.remove)
          .calledWith(expect.any(Object))
          .mockResolvedValue({} as never);
        when(global.browser.cookies.getAllCookieStores)
          .calledWith()
          .mockResolvedValue([{ id: "0" }] as never);
        when(global.browser.cookies.getAll)
          .calledWith({ storeId: "0" })
          .mockResolvedValue([
            mockCookie, // no list
            googleCookie, // greylist, opentab
            youtubeCookie, // whitelist
            yahooCookie, // no list
            openTabCookie, // opentab
            githubCookie, // greylist
          ] as never);
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
          .calledWith({ storeId: "0" })
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
          .calledWith({ storeId: "0" })
          .mockResolvedValue(chromeCookies as never);
      });

      it("Regular clean, exclude open tabs (Chrome).", async () => {
        await cleanCookiesOperation(sampleState, cleanupProperties);
        expect(
          global.browser.extension.isAllowedIncognitoAccess
        ).toHaveBeenCalledTimes(1);
        expect(global.browser.cookies.getAll).toHaveBeenCalledWith({
          storeId: "0",
        });
      });

      it("should include private cookieStores if extension allowed in incognito mode", async () => {
        when(global.browser.extension.isAllowedIncognitoAccess)
          .calledWith()
          .mockResolvedValue(true as never);
        await cleanCookiesOperation(sampleState, cleanupProperties);
        expect(global.browser.cookies.getAll).toHaveBeenCalledWith({
          storeId: "1",
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
      when(global.browser.cookies.getAll)
        .calledWith({ domain: "google.com", storeId: "0" })
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
      when(global.browser.cookies.getAll)
        .calledWith({ domain: "google.com", storeId: "0" })
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
        expect(global.browser.browsingData.remove).toHaveBeenCalledWith(
          { origins: expect.any(Array) },
          { indexedDB: true }
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
        expect(global.browser.browsingData.remove).toHaveBeenCalledWith(
          { origins: expect.any(Array) },
          { serviceWorkers: true }
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
        expect(results["0"] && results["0"].includes("youtube.com")).toBe(
          false
        );
        expect(results["1"] && results["1"].includes("youtube.com")).toBe(
          false
        );
        return Promise.resolve();
      });
    });

    it("should not have discarded.net in the incognito store when cleanDiscardedTabs is true", () => {
      return returnContainersOfOpenTabDomains(false, true).then((results) => {
        expect(results["1"] && results["1"].includes("discarded.net")).toBe(
          false
        );
        return Promise.resolve();
      });
    });
  });
});
