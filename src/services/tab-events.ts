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

import { SettingID } from "@/typings/enums";
import AlarmEvents from "./alarm-events";
import {
  checkIfProtected,
  showNumberOfCookiesInIcon,
} from "./browser-action-service";
import { isFirstPartyIsolationOn } from "./first-party-isolation";
import {
  ADCPCOOKIENAME,
  adcpLog,
  createPartialTabInfo,
  extractMainDomain,
  getAllCookiesForDomain,
  getHostname,
  getSetting,
  isAWebpage,
  uid,
} from "./libs";
import StoreUser from "./store-user";

export default class TabEvents extends StoreUser {
  public static onTabDiscarded(
    tabId: number,
    changeInfo: browser.tabs.TabChangeInfo,
    tab: browser.tabs.Tab
  ): void {
    if (getSetting(StoreUser.store.getState(), SettingID.CLEAN_DISCARDED)) {
      const debug = getSetting(
        StoreUser.store.getState(),
        SettingID.DEBUG_MODE
      ) as boolean;
      const partialTabInfo = createPartialTabInfo(tab);
      // Truncate ChangeInfo.favIconUrl as we have no use for it in debug.
      if (changeInfo.favIconUrl && debug) {
        changeInfo.favIconUrl = "***";
      }
      if (changeInfo.discarded || tab.discarded) {
        adcpLog(
          {
            msg: "TabEvents.onTabDiscarded: Tab was discarded.  Executing cleanFromTabEvents",
            x: { tabId, changeInfo, partialTabInfo },
          },
          debug
        );
        TabEvents.cleanFromTabEvents();
      } else {
        adcpLog(
          {
            msg: "TabEvents.onTabDiscarded:  Tab was not discarded.",
            x: { tabId, changeInfo, partialTabInfo },
          },
          debug
        );
      }
    }
  }
  public static onTabUpdate(
    tabId: number,
    changeInfo: browser.tabs.TabChangeInfo,
    tab: browser.tabs.Tab
  ): void {
    if (tab.status === "complete") {
      const debug = getSetting(
        StoreUser.store.getState(),
        SettingID.DEBUG_MODE
      ) as boolean;
      const partialTabInfo = createPartialTabInfo(tab);
      // Truncate ChangeInfo.favIconUrl as we have no use for it in debug.
      if (changeInfo.favIconUrl && debug) {
        changeInfo.favIconUrl = "***";
      }
      if (!TabEvents.onTabUpdateDelay) {
        TabEvents.onTabUpdateDelay = true;
        adcpLog(
          {
            msg: "TabEvents.onTabUpdate: action delay has been set for ~750 ms.",
            x: { tabId, changeInfo, partialTabInfo },
          },
          debug
        );
        setTimeout(() => {
          adcpLog(
            {
              msg: "TabEvents.onTabUpdate: actions will now commence.",
              x: { tabId, changeInfo, partialTabInfo },
            },
            debug
          );
          TabEvents.getAllCookieActions(tab);
          TabEvents.onTabUpdateDelay = false;
          adcpLog(
            {
              msg: "TabEvents.onTabUpdate: actions have been processed and flag cleared.",
            },
            debug
          );
        }, 750);
      } else {
        adcpLog(
          {
            msg: "TabEvents.onTabUpdate: actions delay is pending already.",
            x: { tabId, changeInfo, partialTabInfo },
          },
          debug
        );
      }
    }
  }

  public static onDomainChange(
    tabId: number,
    changeInfo: browser.tabs.TabChangeInfo,
    tab: browser.tabs.Tab
  ): void {
    const debug = getSetting(
      StoreUser.store.getState(),
      SettingID.DEBUG_MODE
    ) as boolean;
    if (tab.status === "complete") {
      const partialTabInfo = createPartialTabInfo(tab);
      const mainDomain = extractMainDomain(getHostname(tab.url));
      // Truncate ChangeInfo.favIconUrl as we have no use for it in debug.
      if (changeInfo.favIconUrl && debug) {
        changeInfo.favIconUrl = "***";
      }
      if (TabEvents.tabToDomain[tabId] === undefined && mainDomain !== "") {
        adcpLog(
          {
            msg: "TabEvents.onDomainChange: First mainDomain set.",
            x: { tabId, changeInfo, mainDomain, partialTabInfo },
          },
          debug
        );
        TabEvents.tabToDomain[tabId] = mainDomain;
        TabEvents.persistTabToDomain();
      } else if (
        TabEvents.tabToDomain[tabId] !== mainDomain &&
        (mainDomain !== "" ||
          tab.url === "about:blank" ||
          tab.url === "about:home" ||
          tab.url === "about:newtab" ||
          tab.url === "chrome://newtab/")
      ) {
        const oldMainDomain = TabEvents.tabToDomain[tabId];
        TabEvents.tabToDomain[tabId] = mainDomain;
        TabEvents.persistTabToDomain();
        if (
          getSetting(StoreUser.store.getState(), SettingID.CLEAN_DOMAIN_CHANGE)
        ) {
          if (oldMainDomain === "") {
            adcpLog(
              {
                msg: "TabEvents.onDomainChange: mainDomain has changed, but previous domain may have been a blank or new tab.  Not executing domainChangeCleanup",
                x: { tabId, changeInfo, partialTabInfo },
              },
              debug
            );
            return;
          }
          adcpLog(
            {
              msg: "TabEvents.onDomainChange: mainDomain has changed.  Executing domainChangeCleanup",
              x: {
                tabId,
                changeInfo,
                oldMainDomain,
                mainDomain,
                partialTabInfo,
              },
            },
            debug
          );
          TabEvents.cleanFromTabEvents();
        } else {
          adcpLog(
            {
              msg: "TabEvents.onDomainChange: mainDomain has changed, but cleanOnDomainChange is not enabled.  Not cleaning.",
              x: {
                tabId,
                changeInfo,
                oldMainDomain,
                mainDomain,
                partialTabInfo,
              },
            },
            debug
          );
        }
      } else {
        adcpLog(
          {
            msg: "TabEvents.onDomainChange: mainDomain has not changed yet.",
            x: { tabId, changeInfo, mainDomain, partialTabInfo },
          },
          debug
        );
      }
    }
  }

  public static onDomainChangeRemove(
    tabId: number,
    removeInfo: {
      windowId: number;
      isWindowClosing: boolean;
    }
  ): void {
    adcpLog(
      {
        msg: "TabEvents.onDomainChangeRemove: Tab was closed.  Removing old tabToDomain info.",
        x: { tabId, mainDomain: TabEvents.tabToDomain[tabId], removeInfo },
      },
      getSetting(StoreUser.store.getState(), SettingID.DEBUG_MODE) as boolean
    );
    delete TabEvents.tabToDomain[tabId];
    TabEvents.persistTabToDomain();
  }

  public static cleanFromTabEvents = async (): Promise<void> => {
    const debug = getSetting(
      StoreUser.store.getState(),
      SettingID.DEBUG_MODE
    ) as boolean;
    if (getSetting(StoreUser.store.getState(), SettingID.ACTIVE_MODE)) {
      const alarm = await browser.alarms.get("activeModeAlarm");
      if (!alarm || (alarm.name && alarm.name !== "activeModeAlarm")) {
        adcpLog(
          {
            msg: "TabEvents.cleanFromTabEvents:  No Alarms detected.  Creating alarm for cleaning...",
          },
          debug
        );
        await AlarmEvents.createActiveModeAlarm();
      } else {
        adcpLog(
          {
            msg: "TabEvents.cleanFromTabEvents:  An alarm for cleaning was created already.  Cleaning will commence soon.",
            x: alarm,
          },
          debug
        );
      }
    }
  };

  public static getAllCookieActions = async (
    tab: browser.tabs.Tab
  ): Promise<void> => {
    if (!tab.url || tab.url === "") return;
    if (tab.url.startsWith("about:") || tab.url.startsWith("chrome:")) return;
    const debug = getSetting(
      StoreUser.store.getState(),
      SettingID.DEBUG_MODE
    ) as boolean;
    const partialTabInfo = createPartialTabInfo(tab);
    const cookies = await getAllCookiesForDomain(
      StoreUser.store.getState(),
      tab
    );

    if (!cookies) {
      adcpLog(
        {
          msg: "TabEvents.getAllCookieActions: Libs.getAllCookiesForDomain returned undefined.  Skipping Cookie Actions.",
          x: { partialTabInfo },
        },
        debug
      );
      return;
    }

    const internalCookies = cookies.filter((c) => {
      return c.name === ADCPCOOKIENAME;
    });

    if (
      internalCookies.length === 0 &&
      (getSetting(StoreUser.store.getState(), SettingID.CLEANUP_CACHE) ||
        getSetting(StoreUser.store.getState(), SettingID.CLEANUP_INDEXEDDB) ||
        getSetting(
          StoreUser.store.getState(),
          SettingID.CLEANUP_LOCALSTORAGE
        ) ||
        getSetting(StoreUser.store.getState(), SettingID.CLEANUP_PLUGINDATA) ||
        getSetting(
          StoreUser.store.getState(),
          SettingID.CLEANUP_SERVICEWORKERS
        )) &&
      isAWebpage(tab.url) &&
      !tab.url.startsWith("file:")
    ) {
      const cookiesAttributes: {
        expirationDate: number;
        name: string;
        path: string;
        storeId: string | undefined;
        value: string;
        firstPartyDomain?: string;
      } = {
        expirationDate: Math.floor(Date.now() / 1000 + 31557600),
        name: ADCPCOOKIENAME,
        path: `/${uid()}`,
        storeId: tab.cookieStoreId,
        value: ADCPCOOKIENAME,
      };
      // Under FPI, cookies.set without firstPartyDomain rejects; with FPI
      // off, a non-empty firstPartyDomain rejects — hence the probe. The
      // marker still surfaces to cleanup either way, because enumeration
      // passes firstPartyDomain: null (match any).
      if (await isFirstPartyIsolationOn()) {
        cookiesAttributes.firstPartyDomain = extractMainDomain(
          getHostname(tab.url)
        );
      }
      await browser.cookies.set({ ...cookiesAttributes, url: tab.url });
      adcpLog(
        {
          msg: "TabEvents.getAllCookieActions:  A temporary cookie has been set for future BrowsingData cleaning as the site did not set any cookies yet.",
          x: { partialTabInfo, cadLSCookie: cookiesAttributes },
        },
        debug
      );
    }
    // Filter out cookie(s) that were set by this extension.
    const cookieLength = cookies.length - internalCookies.length;
    if (cookies.length !== cookieLength) {
      adcpLog(
        {
          msg: "TabEvents.getAllCookieActions:  New Cookie Count after filtering out cookie set by extension",
          x: { preFilterCount: cookies.length, newCookieCount: cookieLength },
        },
        debug
      );
    }
    adcpLog(
      {
        msg: "TabEvents.getAllCookieActions: executing checkIfProtected to update Icons and Title.",
      },
      debug
    );
    await checkIfProtected(StoreUser.store.getState(), tab, cookieLength);

    if (getSetting(StoreUser.store.getState(), SettingID.NUM_COOKIES_ICON)) {
      adcpLog(
        {
          msg: "TabEvents.getAllCookieActions: executing showNumberOfCookiesInIcon.",
        },
        debug
      );
      showNumberOfCookiesInIcon(tab, cookieLength);
    }
  };
  /**
   * Rehydrate the tab->domain cache from storage.session on service worker
   * start. Without this, clean-on-domain-change silently stops working after
   * the worker's first idle suspension (~30s), because the in-memory map
   * resets to empty. storage.session clears on browser exit, which matches
   * the lifetime the map had in the MV2 persistent background page.
   */
  public static hydrateFromSession = async (): Promise<void> => {
    if (!browser.storage.session) return;
    const data = await browser.storage.session.get({ tabToDomain: {} });
    TabEvents.tabToDomain =
      (data.tabToDomain as { [key: number]: string }) || {};
  };

  /** Write-through persistence for the in-memory tabToDomain cache. */
  protected static persistTabToDomain(): void {
    // Promise.resolve guards both a missing storage.session and non-promise
    // returns from test mocks.
    Promise.resolve(
      browser.storage.session?.set({ tabToDomain: TabEvents.tabToDomain })
    ).catch(() => undefined);
  }

  // Add a delay to prevent multiple spawns of the browsingDataCleanup cookie
  // In-memory is fine in MV3: it guards a 750ms window armed right after an
  // event, and resetting to false on a worker restart is the safe default.
  protected static onTabUpdateDelay = false;

  protected static tabToDomain: { [key: number]: string } = {};
}
