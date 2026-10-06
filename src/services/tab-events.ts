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
  getExactHostname,
  getHostname,
  getSetting,
  hasSiteDataCleanupEnabled,
  isAWebpage,
  isMarkerCookieFor,
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
      if (!TabEvents.pendingTabUpdates.has(tabId)) {
        TabEvents.pendingTabUpdates.set(tabId, tab);
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
          const latestTab = TabEvents.pendingTabUpdates.get(tabId);
          TabEvents.pendingTabUpdates.delete(tabId);
          if (latestTab) TabEvents.getAllCookieActions(latestTab);
          adcpLog(
            {
              msg: "TabEvents.onTabUpdate: actions have been processed and flag cleared.",
            },
            debug
          );
        }, 750);
      } else {
        // Refresh the stored tab so the flush uses the newest snapshot.
        TabEvents.pendingTabUpdates.set(tabId, tab);
        adcpLog(
          {
            msg: "TabEvents.onTabUpdate: actions delay is pending already for this tab.",
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

    // The marker belongs to the tab's EXACT host. getAllCookiesForDomain
    // looks up the www-stripped host and its subdomains, so a marker on
    // some other host of the site (a frame's, say) must not count as this
    // host's own.
    const exactHost = getExactHostname(tab.url);
    // Chrome tabs carry no cookieStoreId, so an incognito tab's marker
    // used to land in the REGULAR store (cookies.set's default): a hidden,
    // year-long record of a private visit that also surfaced in the
    // cleanup log. Chrome cannot clear incognito storage per site anyway,
    // so those tabs get no marker. Firefox private tabs name their own
    // in-memory store and keep theirs.
    const unnamedPrivateStore =
      tab.incognito === true && tab.cookieStoreId === undefined;
    if (
      !unnamedPrivateStore &&
      exactHost !== "" &&
      hasSiteDataCleanupEnabled(StoreUser.store.getState()) &&
      isAWebpage(tab.url) &&
      !tab.url.startsWith("file:")
    ) {
      await TabEvents.ensureSiteDataMarker(
        {
          firstPartyDomain: extractMainDomain(getHostname(tab.url)),
          host: exactHost,
          storeId: tab.cookieStoreId,
          url: tab.url,
        },
        async () =>
          internalCookies.some((c) => isMarkerCookieFor(c, exactHost)),
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
   * Sets the hidden ADCP marker cookie on one exact host unless it already
   * has one. Cleanup puts the site data of every host that owns a cookie
   * in its scope, so the marker is what gets a host's storage cleaned when
   * the site keeps its own cookies elsewhere (or sets none). The random
   * path keeps the browser from ever sending it to the site, and isSafeToClean
   * weighs keep rules and open tabs for it like for any cookie.
   *
   * Requests for the same store and host share one write: a lookup that
   * runs while another is still setting the marker would miss it and set a
   * second one (every marker has its own path). Never throws: a failed
   * lookup or write only means this host's storage is not cleaned.
   */
  protected static async ensureSiteDataMarker(
    target: {
      /** The page or frame url the cookie is set for. */
      url: string;
      /** The url's exact host, as getExactHostname returns it. */
      host: string;
      /** Raw cookie store id; undefined means the browser's default. */
      storeId: string | undefined;
      /** The first-party domain to set under First-Party Isolation. */
      firstPartyDomain: string;
    },
    hasMarker: () => Promise<boolean>,
    debug: boolean
  ): Promise<void> {
    const key = `${target.storeId ?? ""}|${target.host}`;
    if (TabEvents.markersInFlight.has(key)) return;
    TabEvents.markersInFlight.add(key);
    try {
      if (await hasMarker()) return;
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
        storeId: target.storeId,
        value: ADCPCOOKIENAME,
      };
      // Under FPI, cookies.set without firstPartyDomain rejects; with FPI
      // off, a non-empty firstPartyDomain rejects — hence the probe. The
      // marker still surfaces to cleanup either way, because enumeration
      // passes firstPartyDomain: null (match any).
      if (await isFirstPartyIsolationOn()) {
        cookiesAttributes.firstPartyDomain = target.firstPartyDomain;
      }
      await browser.cookies.set({ ...cookiesAttributes, url: target.url });
      adcpLog(
        {
          msg: "TabEvents.ensureSiteDataMarker:  A marker cookie has been set so a later cleanup also clears this host's site data.",
          x: { host: target.host, cadLSCookie: cookiesAttributes },
        },
        debug
      );
    } catch (e: unknown) {
      adcpLog(
        {
          msg: "TabEvents.ensureSiteDataMarker:  Could not set the marker cookie; this host's site data will not be cleaned.",
          type: "warn",
          x: { host: target.host, error: e instanceof Error ? e.message : e },
        },
        debug
      );
    } finally {
      TabEvents.markersInFlight.delete(key);
    }
  }

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
  // event, and resetting to empty on a worker restart is the safe default.
  // PER TAB (tabId -> latest tab snapshot): the old single boolean made the
  // first completing tab swallow every OTHER tab that completed inside its
  // 750ms window — their marker cookie and badge actions simply never ran
  // (caught by the E2E FPI marker test, #321).
  protected static pendingTabUpdates: Map<number, browser.tabs.Tab> = new Map();

  protected static tabToDomain: { [key: number]: string } = {};

  // Store-and-host keys of marker writes in progress (ensureSiteDataMarker).
  // In-memory is fine: it only spans one lookup-and-set.
  protected static markersInFlight: Set<string> = new Set();
}
