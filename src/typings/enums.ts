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

// All of these are PLAIN enums on purpose. They used to be ambient
// `declare const enum`s in global.d.ts, which only worked while the build
// had whole-program type information to inline the members (ts-loader,
// ts-jest). Bun.build transpiles file-by-file and never reads .d.ts files,
// so the members must exist as real runtime objects that get imported.
// global.d.ts re-exposes each of them as a global TYPE alias, so
// type-position uses still work without an import.

export enum FilterOptions {
  NONE,
  CLEAN,
  KEEP,
}

export enum SiteDataType {
  CACHE = "Cache",
  INDEXEDDB = "IndexedDB",
  LOCALSTORAGE = "LocalStorage",
  PLUGINDATA = "PluginData",
  SERVICEWORKERS = "ServiceWorkers",
}

export enum SettingID {
  ACTIVE_MODE = "activeMode",
  CLEAN_DELAY = "delayBeforeClean",
  CLEAN_DISCARDED = "discardedCleanup",
  CLEAN_DOMAIN_CHANGE = "domainChangeCleanup",
  CLEAN_EXPIRED = "cleanExpiredCookies",
  CLEAN_OPEN_TABS_STARTUP = "cleanCookiesFromOpenTabsOnStartup",
  CLEANUP_CACHE = "cacheCleanup",
  CLEANUP_INDEXEDDB = "indexedDBCleanup",
  CLEANUP_LOCALSTORAGE = "localStorageCleanup",
  CLEANUP_LOCALSTORAGE_OLD = "localstorageCleanup",
  CLEANUP_PLUGINDATA = "pluginDataCleanup",
  CLEANUP_SERVICEWORKERS = "serviceWorkersCleanup",
  CONTEXT_MENUS = "contextMenus",
  // Firefox containers. Value matches upstream Cookie AutoDelete's setting
  // name so exported settings stay interchangeable. The setting's UI and
  // defaults arrive with the container service (#283); until then reads
  // must use optional access since initialState carries no entry.
  CONTEXTUAL_IDENTITIES = "contextualIdentities",
  DEBUG_MODE = "debugMode",
  ENABLE_GREYLIST = "enableGreyListCleanup",
  ENABLE_NEW_POPUP = "enableNewVersionPopup",
  KEEP_DEFAULT_ICON = "keepDefaultIcon",
  NOTIFY_AUTO = "showNotificationAfterCleanup",
  NOTIFY_MANUAL = "manualNotifications",
  NOTIFY_DURATION = "notificationOnScreen",
  NUM_COOKIES_ICON = "showNumOfCookiesInIcon",
  OLD_GREY_CLEAN_LOCALSTORAGE = "greyCleanLocalstorage",
  OLD_WHITE_CLEAN_LOCALSTORAGE = "whiteCleanLocalstorage",
  POPUP_ADVANCED = "showAdvancedPopupControls",
  SITEDATA_EMPTY_ON_ENABLE = "siteDataEmptyOnEnable",
  SIZE_POPUP = "sizePopup",
  SIZE_SETTING = "sizeSetting",
  STAT_LOGGING = "statLogging",
}

export enum ListType {
  WHITE = "WHITE",
  GREY = "GREY",
}

export enum EventListenerAction {
  ADD = "ADD",
  REMOVE = "REMOVE",
}

export enum ReasonKeep {
  OpenTabs = "reasonKeepOpenTab",
  MatchedExpression = "reasonKeep",
}

export enum ReasonClean {
  StartupNoMatchedExpression = "reasonCleanStartupNoList",
  StartupCleanupAndGreyList = "reasonCleanGreyList",
  NoMatchedExpression = "reasonCleanNoList",
  MatchedExpressionButNoCookieName = "reasonCleanCookieName",
  ExpiredCookie = "reasonCleanCookieExpired",
  ExpiredCookieRestart = "reasonCleanCookieExpiredRestart",
  CADSiteDataCookie = "reasonCADSiteDataCookie",
  CADSiteDataCookieRestart = "reasonCADSiteDataCookieRestart",
}

export enum OpenTabStatus {
  TabsWasNotIgnored = "reasonTabsWereNotIgnored",
  TabsWereIgnored = "reasonTabsWereIgnored",
}
