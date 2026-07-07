/**
 * Copyright (c) 2017-2022 Kenny Do and CAD Team (https://github.com/Cookie-AutoDelete/Cookie-AutoDelete/graphs/contributors)
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
import {
  ADCPCOOKIENAME,
  adcpLog,
  extractMainDomain,
  getHostname,
  getSetting,
  isAWebpage,
  prepareCleanupDomains,
  prepareCookieDomain,
  returnMatchedExpressionObject,
  showNotification,
  siteDataToBrowser,
  SITEDATATYPES,
  sleep,
  throwErrorNotification,
  trimDot,
  undefinedIsTrue,
} from "./libs";

/** Prepare a cookie for deletion */
export const prepareCookie = (
  cookie: browser.cookies.Cookie,
  debug = false
): CookiePropertiesCleanup => {
  const cookieProperties = {
    ...cookie,
    hostname: "",
    mainDomain: "",
    preparedCookieDomain: prepareCookieDomain(cookie),
  };
  if (cookieProperties.preparedCookieDomain.startsWith("file:")) {
    cookieProperties.hostname = cookieProperties.preparedCookieDomain;
    cookieProperties.mainDomain = cookieProperties.preparedCookieDomain;
  } else {
    cookieProperties.hostname = getHostname(
      cookieProperties.preparedCookieDomain
    );
    cookieProperties.mainDomain = extractMainDomain(cookieProperties.hostname);
  }
  adcpLog(
    {
      msg: "CleanupService.prepareCookie: results",
      x: {
        domain: cookie.domain,
        path: cookie.path,
        preparedCookieDomain: cookieProperties.preparedCookieDomain,
        mainDomain: cookieProperties.mainDomain,
        hostname: cookieProperties.hostname,
      },
    },
    debug
  );
  return cookieProperties;
};

/** Returns an object representing the cookie with internal flags */
export const isSafeToClean = (
  state: State,
  cookieProperties: CookiePropertiesCleanup,
  cleanupProperties: CleanupPropertiesInternal
): CleanReasonObject => {
  const debug = getSetting(state, SettingID.DEBUG_MODE) as boolean;
  const { mainDomain, storeId, hostname, name, expirationDate, session } =
    cookieProperties;
  const partialCookieInfo = {
    mainDomain,
    storeId,
    hostname,
    name,
    expirationDate,
    session,
  };
  const { greyCleanup, openTabDomains, ignoreOpenTabs } = cleanupProperties;
  const openTabStatus = ignoreOpenTabs
    ? OpenTabStatus.TabsWereIgnored
    : OpenTabStatus.TabsWasNotIgnored;
  adcpLog(
    {
      msg: "CleanupService.isSafeToClean:  Properties Debug",
      x: { partialCookieInfo, cleanupProperties, openTabStatus },
    },
    debug
  );

  // Tests if the main domain is open on that specific storeId/container
  if (openTabDomains[storeId] && openTabDomains[storeId].includes(mainDomain)) {
    adcpLog(
      {
        msg: `CleanupService.isSafeToClean:  mainDomain found in openTabsDomain[${storeId}] - not cleaning.`,
        x: { partialCookieInfo, openTabsInStoreId: openTabDomains[storeId] },
      },
      debug
    );
    return {
      cached: false,
      cleanCookie: false,
      cookie: cookieProperties,
      openTabStatus,
      reason: ReasonKeep.OpenTabs,
    };
  }

  // Checks the list for the first available match
  const matchedExpression = returnMatchedExpressionObject(
    state,
    storeId,
    hostname
  );

  // Internal ADCP marker cookie Checks
  if (
    matchedExpression &&
    cookieProperties.name === ADCPCOOKIENAME &&
    (matchedExpression.listType === ListType.WHITE ||
      (matchedExpression.listType === ListType.GREY &&
        (greyCleanup ||
          (matchedExpression.cleanSiteData &&
            matchedExpression.cleanSiteData.length !== 0))))
  ) {
    adcpLog(
      {
        msg: "CleanupService.isSafeToClean:  Internal ADCP marker cookie.  Removing Cookie to trigger browsingData cleanups.",
        x: {
          partialCookieInfo,
          cleanSiteData: matchedExpression.cleanSiteData,
        },
      },
      debug
    );
    return {
      cached: false,
      cleanCookie: true,
      cookie: cookieProperties,
      expression: matchedExpression,
      openTabStatus,
      reason: greyCleanup
        ? ReasonClean.CADSiteDataCookieRestart
        : ReasonClean.CADSiteDataCookie,
    };
  }

  // Check if cookie is expired.
  if (getSetting(state, SettingID.CLEAN_EXPIRED) as boolean) {
    const now = Math.ceil(Date.now() / 1000);
    if (expirationDate && expirationDate < now) {
      adcpLog(
        {
          msg: `CleanupService.isSafeToClean:  Cookie Expired since ${expirationDate}.  Date.now is ${now}`,
          x: {
            partialCookieInfo,
            cleanSiteData: matchedExpression?.cleanSiteData,
          },
        },
        debug
      );
      return {
        cached: false,
        cleanCookie: true,
        cookie: cookieProperties,
        expression: matchedExpression,
        openTabStatus,
        reason: greyCleanup
          ? ReasonClean.ExpiredCookieRestart
          : ReasonClean.ExpiredCookie,
      };
    }
  }

  // Startup cleanup checks
  if (greyCleanup && !matchedExpression) {
    adcpLog(
      {
        msg: "CleanupService.isSafeToClean:  unmatched and greyCleanup.  Safe to Clean",
        x: partialCookieInfo,
      },
      debug
    );
    return {
      cached: false,
      cleanCookie: true,
      cookie: cookieProperties,
      openTabStatus,
      reason: ReasonClean.StartupNoMatchedExpression,
    };
  }

  if (
    greyCleanup &&
    matchedExpression &&
    matchedExpression.listType === ListType.GREY &&
    // Tests the cleanAllCookies flag and if it doesn't include that name or if there is no cookieNames
    (undefinedIsTrue(matchedExpression.cleanAllCookies) ||
      (matchedExpression.cookieNames &&
        !matchedExpression.cookieNames.includes(cookieProperties.name)))
  ) {
    adcpLog(
      {
        msg: "CleanupService.isSafeToClean:  greyCleanup - matching Expression and cookie name was unchecked.  Safe to Clean.",
        x: { partialCookieInfo, matchedExpression },
      },
      debug
    );
    return {
      cached: false,
      cleanCookie: true,
      cookie: cookieProperties,
      expression: matchedExpression,
      openTabStatus,
      reason: ReasonClean.StartupCleanupAndGreyList,
    };
  }

  // Normal cleanup checks
  if (!matchedExpression) {
    adcpLog(
      {
        msg: "CleanupService.isSafeToClean:  unmatched Expression.  Safe to Clean.",
        x: partialCookieInfo,
      },
      debug
    );
    return {
      cached: false,
      cleanCookie: true,
      cookie: cookieProperties,
      openTabStatus,
      reason: ReasonClean.NoMatchedExpression,
    };
  }
  if (
    matchedExpression &&
    !undefinedIsTrue(matchedExpression.cleanAllCookies) &&
    matchedExpression.cookieNames &&
    !matchedExpression.cookieNames.includes(cookieProperties.name)
  ) {
    adcpLog(
      {
        msg: "CleanupService.isSafeToClean:  matched Expression but unchecked cookie name.  Safe to Clean.",
        x: { partialCookieInfo, matchedExpression },
      },
      debug
    );
    return {
      cached: false,
      cleanCookie: true,
      cookie: cookieProperties,
      expression: matchedExpression,
      openTabStatus,
      reason: ReasonClean.MatchedExpressionButNoCookieName,
    };
  }
  adcpLog(
    {
      msg: "CleanupService.isSafeToClean:  Matched Expression and cookie name.  Cookie stays!",
      x: { partialCookieInfo, matchedExpression },
    },
    debug
  );
  return {
    cached: false,
    cleanCookie: false,
    cookie: cookieProperties,
    expression: matchedExpression,
    openTabStatus,
    reason: ReasonKeep.MatchedExpression,
  };
};

/** Clean cookies */
export const cleanCookies = async (
  state: State,
  markedForDeletion: CleanReasonObject[]
): Promise<void> => {
  // cookies.remove resolves with the removed cookie's details (or null).
  const promiseArr: Promise<unknown>[] = [];
  markedForDeletion.forEach((obj) => {
    const cookieProperties = obj.cookie;
    const cookieRemove = {
      storeId: cookieProperties.storeId,
      name: cookieProperties.name,
      url: cookieProperties.preparedCookieDomain,
    };
    // url: "http://domain.com" + cookies[i].path
    adcpLog(
      {
        msg: "CleanupService.cleanCookies: Cookie being removed through browser.cookies.remove via Promises:",
        x: cookieRemove,
      },
      getSetting(state, SettingID.DEBUG_MODE) as boolean
    );
    const promise = browser.cookies.remove(cookieRemove);
    promiseArr.push(promise);
  });
  await Promise.all(promiseArr).catch((e) => {
    throw e;
  });
};

// Cleanup of all cookies for domain.
export const clearCookiesForThisDomain = async (
  state: State,
  tab: browser.tabs.Tab
): Promise<boolean> => {
  const hostname = getHostname(tab.url);
  const getCookies = await browser.cookies.getAll({
    domain: hostname,
    storeId: tab.cookieStoreId,
  });
  // Filter out our own ADCP marker cookie that cleans up other Browsing Data
  const cookies = getCookies.filter((c) => c.name !== ADCPCOOKIENAME);

  if (cookies.length > 0) {
    let cookieDeletedCount = 0;
    for (const cookie of cookies) {
      const r = await browser.cookies.remove({
        name: cookie.name,
        storeId: cookie.storeId,
        url: prepareCookieDomain(cookie),
      });
      if (r) cookieDeletedCount += 1;
    }
    showNotification(
      {
        duration: getSetting(state, SettingID.NOTIFY_DURATION) as number,
        msg: `${browser.i18n.getMessage("manualCleanSuccess", [
          browser.i18n.getMessage("cookiesText"),
          hostname,
        ])}\n${browser.i18n.getMessage("manualCleanRemoved", [
          cookieDeletedCount.toString(),
          cookies.length.toString(),
        ])}`,
      },
      getSetting(state, SettingID.NOTIFY_MANUAL) as boolean
    );

    return cookieDeletedCount > 0;
  }

  showNotification(
    {
      duration: getSetting(state, SettingID.NOTIFY_DURATION) as number,
      msg: `${browser.i18n.getMessage("manualCleanNothing", [
        browser.i18n.getMessage("cookiesText"),
        hostname,
      ])}`,
    },
    getSetting(state, SettingID.NOTIFY_MANUAL) as boolean
  );

  return cookies.length > 0;
};

/**
 * Injected into the target tab by clearLocalStorageForThisDomain. Serialized
 * by chrome.scripting, so it must stay fully self-contained: no closure
 * references, no imports.
 */
function clearTabStorages(): { local: number; session: number } {
  const r = {
    local: window.localStorage.length,
    session: window.sessionStorage.length,
  };
  window.localStorage.clear();
  window.sessionStorage.clear();
  return r;
}

export const clearLocalStorageForThisDomain = async (
  state: State,
  tab: browser.tabs.Tab
): Promise<boolean> => {
  // MV3: tabs.executeScript with inline code no longer exists; scripting
  // requires an explicit tab id and a serializable function.
  try {
    let local = 0;
    let session = 0;
    const result = await browser.scripting.executeScript({
      target: { tabId: tab.id as number, allFrames: true },
      func: clearTabStorages,
    });
    result.forEach((frame) => {
      // The polyfill types frame.result as unknown; clearTabStorages is the
      // only function we inject, so the shape is known.
      const counts = frame.result as
        { local: number; session: number } | undefined;
      local += counts?.local ?? 0;
      session += counts?.session ?? 0;
    });
    showNotification(
      {
        duration: getSetting(state, SettingID.NOTIFY_DURATION) as number,
        msg: `${browser.i18n.getMessage("manualCleanSuccess", [
          browser.i18n.getMessage("localStorageText"),
          getHostname(tab.url),
        ])}\n${browser.i18n.getMessage("removeStorageCount", [
          local.toString(),
          browser.i18n.getMessage("localStorageText"),
        ])}\n${browser.i18n.getMessage("removeStorageCount", [
          session.toString(),
          browser.i18n.getMessage("sessionStorageText"),
        ])}`,
      },
      getSetting(state, SettingID.NOTIFY_MANUAL) as boolean
    );
    return true;
  } catch (e: unknown) {
    if (e instanceof Error) {
      throwErrorNotification(
        e,
        getSetting(state, SettingID.NOTIFY_DURATION) as number
      );
    }
    await sleep(750);
    showNotification({
      duration: getSetting(state, SettingID.NOTIFY_DURATION) as number,
      msg: `${browser.i18n.getMessage("manualCleanNothing", [
        browser.i18n.getMessage("localStorageText"),
        getHostname(tab.url),
      ])}`,
    });
    return false;
  }
};

export const clearSiteDataForThisDomain = async (
  state: State,
  siteData: SiteDataType | "All",
  hostname: string
): Promise<boolean> => {
  if (hostname.trim() === "") return false;
  const debug = getSetting(state, SettingID.DEBUG_MODE) as boolean;
  adcpLog(
    {
      msg: `CleanupService.clearSiteDataForThisDomain: Received ${siteData} clean request for ${hostname}.`,
    },
    debug
  );
  const domains = prepareCleanupDomains(hostname);
  if (siteData === "All") {
    const siteDataAll: string[] = [];
    for (const sd of SITEDATATYPES) {
      await removeSiteData(state, sd, domains, debug, false);
      siteDataAll.push(browser.i18n.getMessage(`${siteDataToBrowser(sd)}Text`));
    }
    // To consolidate the notification shown, we do it out here.
    showNotification(
      {
        duration: getSetting(state, SettingID.NOTIFY_DURATION) as number,
        msg: browser.i18n.getMessage("activityLogSiteDataDomainsText", [
          siteDataAll.join(", "),
          domains.join(", "),
        ]),
        title: browser.i18n.getMessage("notificationTitleSiteData"),
      },
      getSetting(state, SettingID.NOTIFY_MANUAL) as boolean
    );
  } else {
    await removeSiteData(state, siteData, domains, debug, true);
  }
  return true;
};

export const removeSiteData = async (
  state: State,
  siteData: SiteDataType,
  domains: string[],
  debug: boolean,
  manual = false
): Promise<boolean> => {
  // Chrome's browsingData API scopes removals by origin.
  const listName = "origins";
  const sd = siteDataToBrowser(siteData);
  adcpLog(
    {
      msg: `CleanupService.removeSiteData: Cleanup of ${listName} for ${sd}:`,
      x: domains,
    },
    debug
  );
  try {
    // Chrome's browsingData API scopes removals by `origins`, a key the
    // Firefox-schema-generated polyfill types don't know about.
    await browser.browsingData.remove(
      {
        origins: domains,
      } as import("webextension-polyfill").BrowsingData.RemovalOptions,
      {
        [sd]: true,
      }
    );
    showNotification(
      {
        duration: getSetting(state, SettingID.NOTIFY_DURATION) as number,
        msg: browser.i18n.getMessage("activityLogSiteDataDomainsText", [
          browser.i18n.getMessage(`${sd}Text`),
          domains.join(", "),
        ]),
        title: browser.i18n.getMessage("notificationTitleSiteData"),
      },
      manual && (getSetting(state, SettingID.NOTIFY_MANUAL) as boolean)
    );
    return true;
  } catch (e: unknown) {
    adcpLog(
      {
        msg: `CleanupService.removeSiteData:  browser.browsingData.remove of ${listName} for ${sd} returned an error:`,
        type: "error",
        x: e,
      },
      debug
    );
    if (e instanceof Error) {
      throwErrorNotification(
        e,
        getSetting(state, SettingID.NOTIFY_DURATION) as number
      );
    }

    return false;
  }
};

/** This will use the browsingData's hostname/origin attribute to delete any extra browsing data */
export const otherBrowsingDataCleanup = async (
  state: State,
  isSafeToCleanObjects: CleanReasonObject[]
): Promise<ActivityLog["browsingDataCleanup"]> => {
  const debug = getSetting(state, SettingID.DEBUG_MODE) as boolean;
  const browsingDataResult: ActivityLog["browsingDataCleanup"] = {};
  if (getSetting(state, SettingID.CLEANUP_CACHE)) {
    browsingDataResult[SiteDataType.CACHE] = await cleanSiteData(
      state,
      SiteDataType.CACHE,
      isSafeToCleanObjects,
      debug
    );
  }
  if (getSetting(state, SettingID.CLEANUP_INDEXEDDB)) {
    browsingDataResult[SiteDataType.INDEXEDDB] = await cleanSiteData(
      state,
      SiteDataType.INDEXEDDB,
      isSafeToCleanObjects,
      debug
    );
  }
  if (getSetting(state, SettingID.CLEANUP_LOCALSTORAGE)) {
    browsingDataResult[SiteDataType.LOCALSTORAGE] = await cleanSiteData(
      state,
      SiteDataType.LOCALSTORAGE,
      isSafeToCleanObjects,
      debug
    );
  }
  if (getSetting(state, SettingID.CLEANUP_PLUGINDATA)) {
    browsingDataResult[SiteDataType.PLUGINDATA] = await cleanSiteData(
      state,
      SiteDataType.PLUGINDATA,
      isSafeToCleanObjects,
      debug
    );
  }
  if (getSetting(state, SettingID.CLEANUP_SERVICEWORKERS)) {
    browsingDataResult[SiteDataType.SERVICEWORKERS] = await cleanSiteData(
      state,
      SiteDataType.SERVICEWORKERS,
      isSafeToCleanObjects,
      debug
    );
  }

  return browsingDataResult;
};

/**
 * Filters incoming objects with the site data to clean. (From Autoclean trigger)
 * @param state The State.
 * @param siteData The site data type
 * @param cleanReasonObjects Objects returned from isSafeToClean()
 * @param debug True if debug mode.
 */
export const cleanSiteData = async (
  state: State,
  siteData: SiteDataType,
  cleanReasonObjects: CleanReasonObject[],
  debug: boolean
): Promise<string[]> => {
  const domains = cleanReasonObjects
    .filter((obj) => filterSiteData(obj, siteData, debug))
    .map((o) => o.cookie.domain)
    .filter((domain) => domain.trim() !== "");

  const cleanList: string[] = [];
  for (const domain of domains) {
    cleanList.push(...prepareCleanupDomains(domain));
  }

  if (cleanList.length > 0) {
    const r = await removeSiteData(
      state,
      siteData,
      [...new Set(cleanList)],
      debug,
      false
    );
    if (r) {
      return domains;
    }
  }
  return [];
};

/** Setup SiteData cleaning.  Undefined will not be cleaned. */
export const parseCleanSiteData = (bool?: boolean): boolean => {
  return bool === undefined ? false : bool;
};

/** Filter the deleted cookies from site data type */
export const filterSiteData = (
  obj: CleanReasonObject,
  siteData: SiteDataType,
  debug = false
): boolean => {
  const notProtectedByOpenTab = obj.reason !== ReasonKeep.OpenTabs;
  const notInAnyLists =
    obj.reason === ReasonClean.NoMatchedExpression ||
    obj.reason === ReasonClean.StartupNoMatchedExpression;
  const isExpiredNotRestart = obj.reason === ReasonClean.ExpiredCookie;
  const isExpiredRestart = obj.reason === ReasonClean.ExpiredCookieRestart;
  const isCADCookieNoExpression =
    (obj.reason === ReasonClean.CADSiteDataCookie ||
      obj.reason === ReasonClean.CADSiteDataCookieRestart) &&
    obj.expression === undefined;
  const nonBlankCookieHostName = obj.cookie.hostname.trim() !== "";
  const cleanSiteDataInExpression = parseCleanSiteData(
    obj.expression?.cleanSiteData?.includes(siteData)
  );
  const isRestartCleanup =
    (isExpiredRestart && obj.expression?.listType === ListType.GREY) ||
    (obj.reason === ReasonClean.CADSiteDataCookieRestart &&
      obj.expression?.listType === ListType.GREY) ||
    obj.reason === ReasonClean.StartupCleanupAndGreyList;
  const canCleanSiteData =
    isCADCookieNoExpression || cleanSiteDataInExpression || isRestartCleanup;
  const cro: CleanReasonObject = {
    ...obj,
    cookie: {
      ...obj.cookie,
      value: debug ? "***" : obj.cookie.value,
    },
  };
  adcpLog(
    {
      msg: "CleanupService.filterSiteData: debug data.",
      x: {
        notProtectedByOpenTab,
        notInAnyLists,
        siteData,
        isExpiredNotRestart,
        isExpiredRestart,
        isCADCookieNoExpression,
        cleanSiteDataInExpression,
        isRestartCleanup,
        canCleanSiteData,
        nonBlankCookieHostName,
        notOpenTabAndCanClean: notProtectedByOpenTab && canCleanSiteData,
        CleanReasonObject: cro,
      },
    },
    debug
  );
  const r =
    (notInAnyLists || (notProtectedByOpenTab && canCleanSiteData)) &&
    nonBlankCookieHostName;
  adcpLog(
    {
      msg: `CleanupService.filterSiteData: ${siteData} cleanup returned ${r} for ${cro.cookie.hostname}`,
    },
    debug
  );
  return r;
};

/**
 * Store all tabs' host domains to prevent cookie deletion from those domains
 * returns empty object if we ignore all open Tabs
 * Tabs now grouped by cookie store e.g. '0' (normal), '1' (incognito)
 */
export const returnContainersOfOpenTabDomains = async (
  ignoreOpenTabs: boolean,
  cleanDiscardedTabs: boolean
): Promise<Record<string, string[]>> => {
  if (ignoreOpenTabs) {
    return {};
  }
  const tabs = await browser.tabs.query({
    windowType: "normal",
  });
  const openTabs: { [k: string]: Set<string> } = {};
  for (const tab of tabs) {
    if (isAWebpage(tab.url) && (!cleanDiscardedTabs || !tab.discarded)) {
      // Chrome doesn't have tab.cookieStoreId, so rely on tab.incognito
      const cookieStoreId = tab.incognito ? "1" : "0";
      if (!openTabs[cookieStoreId]) {
        openTabs[cookieStoreId] = new Set<string>();
      }
      openTabs[cookieStoreId].add(extractMainDomain(getHostname(tab.url)));
    }
  }
  const openTabsArray: { [k: string]: string[] } = {};
  for (const id of Object.keys(openTabs)) {
    openTabsArray[id] = Array.from(openTabs[id]);
  }
  return openTabsArray;
};

/** Main function for cookie cleanup. Returns a list of domains that cookies and other site data were deleted from */
export const cleanCookiesOperation = async (
  state: State,
  cleanupProperties: CleanupProperties = {
    greyCleanup: false,
    ignoreOpenTabs: false,
  }
): Promise<Record<string, any>> => {
  const debug = getSetting(state, SettingID.DEBUG_MODE) as boolean;
  const deletedSiteDataArrays: ActivityLog["browsingDataCleanup"] = {};
  const setOfDeletedDomainCookies = new Set<string>();
  const cachedResults: Required<ActivityLog> = {
    dateTime: new Date().toString(),
    recentlyCleaned: 0,
    storeIds: {},
    browsingDataCleanup: {},
    siteDataCleaned: false,
  };
  // Scrub private cookieStores
  const storesIdsToScrub = ["private", "1"];
  const openTabDomains = await returnContainersOfOpenTabDomains(
    cleanupProperties.ignoreOpenTabs,
    getSetting(state, SettingID.CLEAN_DISCARDED) as boolean
  );
  const newCleanupProperties: CleanupPropertiesInternal = {
    ...cleanupProperties,
    openTabDomains,
  };

  const cookieStoreIds = new Set<string>();

  // Manually add Chrome's default stores.
  cookieStoreIds.add("0");
  if (await browser.extension.isAllowedIncognitoAccess()) {
    cookieStoreIds.add("1");
  }

  // Store cookieStoreIds from the cookies API
  const cookieStores = (await browser.cookies.getAllCookieStores()) || [];
  for (const store of cookieStores) {
    cookieStoreIds.add(store.id);
  }

  // Clean for each cookieStore jar
  for (const id of cookieStoreIds) {
    let cookies: browser.cookies.Cookie[] = [];
    try {
      cookies = await browser.cookies.getAll({
        storeId: id,
      });
    } catch (e: unknown) {
      if (e instanceof Error) {
        adcpLog(
          {
            msg: `CleanupService.cleanCookiesOperation:  browser.cookies.getAll for id: ${id} threw an error.`,
            type: "error",
            x: e.message,
          },
          true
        );
      }
    }

    // No cookies from specified container.  Skip rest of cleanup.
    if (!cookies || cookies.length === 0) continue;

    const isSafeToCleanObjects = cookies.map((cookie) => {
      return isSafeToClean(
        state,
        prepareCookie(cookie, debug),
        newCleanupProperties
      );
    });

    if (debug) {
      // We need deep copying object to as to not change actual cookies
      const sanitized: CleanReasonObject[] = isSafeToCleanObjects.map((obj) => {
        return {
          ...obj,
          cookie: {
            ...obj.cookie,
            value: "***",
          },
        };
      });
      adcpLog(
        {
          msg: "CleanupService.cleanCookiesOperation:  isSafeToCleanObjects Result",
          x: sanitized,
        },
        debug
      );
    }

    const markedForDeletion = isSafeToCleanObjects.filter((obj) => {
      const r = obj.cleanCookie && obj.cookie.hostname.trim() !== "";
      adcpLog(
        {
          msg: `CleanupService.cleanCookiesOperation: Clean Cookies returned ${r} for ${obj.cookie.hostname}`,
        },
        debug
      );
      return r;
    });

    if (debug) {
      // We need deep copying object to as to not change actual cookies
      const sanitized: CleanReasonObject[] = markedForDeletion.map((obj) => {
        return {
          ...obj,
          cookie: {
            ...obj.cookie,
            value: "***",
          },
        };
      });
      adcpLog(
        {
          msg: "CleanupService.cleanCookiesOperation:  Cookies markedForDeletion Result",
          x: sanitized,
        },
        debug
      );
    }

    try {
      await cleanCookies(state, markedForDeletion);
    } catch (e: unknown) {
      adcpLog(
        {
          type: "error",
          x: e,
        },
        true
      );
      if (e instanceof Error) {
        throwErrorNotification(
          e,
          getSetting(state, SettingID.NOTIFY_DURATION) as number
        );
      }
    }

    // Extract away the ADCP internal Cookie from Clean Entries.
    const removedCookies = markedForDeletion.filter((c) => {
      return c.cookie.name !== ADCPCOOKIENAME;
    });

    if (removedCookies.length !== 0) {
      cachedResults.storeIds[id] = removedCookies;
    }
    cachedResults.recentlyCleaned += removedCookies.length;
    removedCookies.forEach((obj) => {
      setOfDeletedDomainCookies.add(obj.cookie.hostname);
    });

    // Handle all other browsingData cleanups.
    const storeResults = await otherBrowsingDataCleanup(
      state,
      isSafeToCleanObjects
    );
    // Don't store domains for private browsing data
    if (storesIdsToScrub.includes(id) || !storeResults) continue;
    for (const sd of SITEDATATYPES) {
      if ((storeResults[sd] || []).length > 0) {
        cachedResults.siteDataCleaned = true;
        deletedSiteDataArrays[sd] = (deletedSiteDataArrays[sd] || []).concat(
          (storeResults[sd] as string[]).map((domain) => trimDot(domain))
        );
      }
    }
  }

  for (const sd of SITEDATATYPES) {
    cachedResults.browsingDataCleanup[sd] = deletedSiteDataArrays[sd]
      ? Array.from(new Set(deletedSiteDataArrays[sd] as string[]))
      : [];
  }

  for (const id of storesIdsToScrub) {
    delete cachedResults.storeIds[id];
  }

  return {
    cachedResults,
    setOfDeletedDomainCookies: Array.from(setOfDeletedDomainCookies),
  };
};
