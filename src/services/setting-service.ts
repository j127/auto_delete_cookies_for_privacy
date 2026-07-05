/**
 * Copyright (c) 2020-2022 Kenneth Tran and CAD Team (https://github.com/Cookie-AutoDelete/Cookie-AutoDelete/graphs/contributors)
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

import { SettingID, SiteDataType } from "../typings/enums";
import StoreUser from "./store-user";
import { validateSettings } from "../redux/actions";
import { adcpLog, siteDataToBrowser, SITEDATATYPES } from "./libs";
import { checkIfProtected, setGlobalIcon } from "./browser-action-service";
import ContextMenuEvents from "./context-menu-events";
import { ReduxConstants } from "../typings/redux-constants";

export default class SettingService extends StoreUser {
  public static init(): void {
    SettingService.current = StoreUser.store.getState().settings;
    SettingService.isInitialized = true;
  }

  public static async onSettingsChange(): Promise<void> {
    if (!SettingService.isInitialized) {
      SettingService.init();
    }
    const previous = SettingService.current;
    SettingService.current = StoreUser.store.getState().settings;

    // BrowsingData Settings Check
    for (const siteData of SITEDATATYPES) {
      const sd = `${siteDataToBrowser(siteData)}Cleanup`;
      if (
        (previous[sd] === undefined || !previous[sd].value) &&
        SettingService.current[sd].value
      ) {
        // Migration Check to prevent LocalStorage from being cleaned again.
        // Only if migrating from 3.4.0 to 3.5.1+
        if (
          siteData === SiteDataType.LOCALSTORAGE &&
          previous[SettingID.CLEANUP_LOCALSTORAGE_OLD] !== undefined &&
          previous[SettingID.CLEANUP_LOCALSTORAGE_OLD].value
        ) {
          continue;
        }
        if (
          SettingService.getCurrent(SettingID.SITEDATA_EMPTY_ON_ENABLE) ===
          false
        ) {
          adcpLog(
            {
              msg: `${siteData} setting activated, but Empty Site Data on Enable is false. Existing site data kept.`,
              type: "info",
            },
            SettingService.getCurrent(SettingID.DEBUG_MODE) as boolean
          );
          continue;
        }
        await browser.browsingData.remove(
          { since: 0 },
          { [siteDataToBrowser(siteData)]: true }
        );
        adcpLog(
          {
            msg: `${siteData} setting activated.  All previous ${siteData} has been cleared for a clean slate.`,
            type: "info",
          },
          SettingService.getCurrent(SettingID.DEBUG_MODE) as boolean
        );
      }
    }

    // Active Mode (Automatic Cleanup) changes
    if (SettingService.hasNewValue(previous, SettingID.ACTIVE_MODE)) {
      const active = SettingService.getCurrent(
        SettingID.ACTIVE_MODE
      ) as boolean;
      if (!active) {
        await browser.alarms.clear("activeModeAlarm");
        // Also drop the persisted pending-cleanup record so a scheduled
        // cleanup can't fire after the user turned Automatic Cleaning off.
        await browser.storage.session?.remove("pendingCleanup");
      }
      await setGlobalIcon(active);
      ContextMenuEvents.updateMenuItemCheckbox(
        ContextMenuEvents.MenuID.ACTIVE_MODE,
        active
      );
    }

    // Context Menu Changes
    if (SettingService.hasNewValue(previous, SettingID.CONTEXT_MENUS)) {
      if (SettingService.getCurrent(SettingID.CONTEXT_MENUS)) {
        await ContextMenuEvents.menuInit();
      } else {
        await ContextMenuEvents.menuClear();
      }
    }

    // Deprecated Setting Adjustments
    // Only for localstorageCleanup <-> localStorageCleanup
    SettingService.updateDeprecatedSetting(
      previous,
      SettingID.CLEANUP_LOCALSTORAGE,
      SettingID.CLEANUP_LOCALSTORAGE_OLD
    );
    SettingService.updateDeprecatedSetting(
      previous,
      SettingID.CLEANUP_LOCALSTORAGE_OLD,
      SettingID.CLEANUP_LOCALSTORAGE
    );

    await checkIfProtected(StoreUser.store.getState());

    // Validate Settings Again
    StoreUser.store.dispatch<any>(validateSettings());
  }

  private static getCurrent(s: SettingID): boolean | number | string {
    return SettingService.current[s].value;
  }

  private static hasNewValue(p: MapToSettingObject, s: SettingID): boolean {
    return p[s].value !== SettingService.current[s].value;
  }

  private static updateDeprecatedSetting(
    p: MapToSettingObject,
    a: SettingID,
    b: SettingID
  ): void {
    if (p[a] && SettingService.current[a] && SettingService.hasNewValue(p, a)) {
      StoreUser.store.dispatch({
        payload: {
          name: b,
          value: SettingService.getCurrent(a),
        },
        type: ReduxConstants.UPDATE_SETTING,
      });
    }
  }

  protected static current: MapToSettingObject;
  protected static delaySave = false;
  protected static isInitialized = false;
}
