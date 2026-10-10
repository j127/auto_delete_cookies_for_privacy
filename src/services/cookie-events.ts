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
  prepareCookie,
  returnContainersOfOpenTabDomains,
} from "./cleanup-service";
import { adcpLog, extractMainDomain, getHostname, getSetting } from "./libs";
import RecentCleanup from "./recent-cleanup";
import StoreUser from "./store-user";
import TabEvents from "./tab-events";

export default class CookieEvents extends StoreUser {
  public static async onCookieChanged(changeInfo: {
    removed: boolean;
    cookie: browser.cookies.Cookie;
    cause: browser.cookies.OnChangedCause;
  }): Promise<void> {
    // Truncate cookie value (purely for debug)
    changeInfo.cookie.value = "***";
    // Get the current active tab(s)
    const tabQuery = await browser.tabs.query({
      active: true,
      windowType: "normal",
    });
    tabQuery.forEach((tab) => {
      // Tabs.id with tabs.TAB_ID_NONE do not host content tabs
      // Tabs.url is always present as we already have the 'tabs' permission.
      if (!tab.id || !tab.url) return;
      if (
        extractMainDomain(getHostname(tab.url)) ===
        extractMainDomain(changeInfo.cookie.domain)
      ) {
        // Force Tab Update function
        TabEvents.onTabUpdate(tab.id, { cookieChanged: changeInfo }, tab);
      }
    });
  }

  /**
   * Schedules the active-mode cleanup again when a site sets a cookie right
   * after a cleanup emptied it and no tab shows it any more: responses to
   * requests still in flight when its tab closed (see RecentCleanup).
   *
   * The ADCP marker cookie counts like any other. It is only set while a
   * page or same-site frame of its host loads, so with the site still open
   * the open-tab check below stops it, and without one the page that just
   * loaded may have written storage that only another cleanup removes.
   */
  public static async rescheduleCleanupForLateCookie(changeInfo: {
    removed: boolean;
    cookie: browser.cookies.Cookie;
    cause: browser.cookies.OnChangedCause;
  }): Promise<void> {
    const { cause, cookie, removed } = changeInfo;
    // An overwrite reports the replaced cookie as removed, then the new one
    // as added with cause "explicit"; only that second event counts.
    if (removed || cause === "overwrite") return;
    if (!getSetting(StoreUser.store.getState(), SettingID.ACTIVE_MODE)) {
      return;
    }
    await RecentCleanup.settled();
    // The same main domain cleanup weighs the cookie by: a partitioned
    // cookie belongs to its partition's top-level site.
    const { mainDomain } = prepareCookie(cookie);
    if (!RecentCleanup.wasRecentlyCleaned(mainDomain)) return;
    const state = StoreUser.store.getState();
    const openTabDomains = await returnContainersOfOpenTabDomains(
      false,
      getSetting(state, SettingID.CLEAN_DISCARDED) as boolean
    );
    if (openTabDomains[cookie.storeId]?.includes(mainDomain)) return;
    adcpLog(
      {
        msg: "CookieEvents.rescheduleCleanupForLateCookie:  A recently cleaned site with no open tab set a cookie.  Scheduling another cleanup.",
        x: { mainDomain, name: cookie.name, storeId: cookie.storeId },
      },
      getSetting(state, SettingID.DEBUG_MODE) as boolean
    );
    await AlarmEvents.createActiveModeAlarm();
  }
}
