/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */
import { ListType, SettingID } from "@/typings/enums";
import { addExpression, cookieCleanup } from "@/redux/actions";
import { clearCookiesForThisDomain } from "./cleanup-service";
import { keepTargetFor } from "./keep-target";
import {
  adcpLog,
  effectiveListKey,
  getMatchedExpressions,
  getSetting,
  isAWebpage,
  localFileToRegex,
  parseCookieStoreId,
  tabCookieStoreId,
} from "./libs";
import StoreUser from "./store-user";

/**
 * The optional keyboard commands for the popup's common actions (#588).
 * Like the pause command (TOGGLE_ACTIVE_MODE_COMMAND in pause-service.ts),
 * none ships with a suggested key: users assign keys on the browser's
 * extension shortcuts page. The names must match extension/manifest.json.
 */
export const ShortcutCommand = {
  CLEAN: "clean-now",
  CLEAN_INCLUDING_OPEN_TABS: "clean-now-including-open-tabs",
  DELETE_SITE_COOKIES: "delete-site-cookies",
  KEEP_SITE: "keep-site",
  KEEP_SITE_UNTIL_CLOSE: "keep-site-until-browser-closes",
} as const;

export default class CommandEvents extends StoreUser {
  /**
   * Runs one of the shortcut commands. Each does what its popup button
   * does, through the same background action the popup's dispatch reaches
   * over the store bridge, so notifications and the toolbar icon follow
   * the user's settings exactly as they do for a click. Returns whether
   * the command was one of these, so the caller can ignore the rest.
   */
  public static async onCommand(
    command: string,
    tab?: browser.tabs.Tab
  ): Promise<boolean> {
    switch (command) {
      case ShortcutCommand.CLEAN:
        CommandEvents.clean(false);
        return true;
      case ShortcutCommand.CLEAN_INCLUDING_OPEN_TABS:
        CommandEvents.clean(true);
        return true;
      case ShortcutCommand.DELETE_SITE_COOKIES:
        await CommandEvents.deleteSiteCookies(
          tab ?? (await CommandEvents.activeTab())
        );
        return true;
      case ShortcutCommand.KEEP_SITE:
        CommandEvents.keepSite(
          tab ?? (await CommandEvents.activeTab()),
          ListType.WHITE
        );
        return true;
      case ShortcutCommand.KEEP_SITE_UNTIL_CLOSE:
        CommandEvents.keepSite(
          tab ?? (await CommandEvents.activeTab()),
          ListType.GREY
        );
        return true;
      default:
        return false;
    }
  }

  /** The popup's Clean now (open tabs left alone) and its advanced variant. */
  protected static clean(ignoreOpenTabs: boolean): void {
    StoreUser.store.dispatch(
      cookieCleanup({
        greyCleanup: false,
        ignoreOpenTabs,
      })
    );
  }

  /** The popup's "Delete this site's cookies". */
  protected static async deleteSiteCookies(
    tab: browser.tabs.Tab | undefined
  ): Promise<void> {
    if (!CommandEvents.hasSite(tab)) return;
    await clearCookiesForThisDomain(StoreUser.store.getState(), tab);
  }

  /**
   * The popup's "Keep cookies for this site" (WHITE) and "Keep until
   * browser closes" (GREY): the same expression in the same list. The
   * popup hides both buttons while a rule already matches the site, so a
   * shortcut then adds nothing either, rather than stacking a second rule.
   */
  protected static keepSite(
    tab: browser.tabs.Tab | undefined,
    listType: ListType
  ): void {
    if (!CommandEvents.hasSite(tab)) return;
    const { hostname, keepExpression } = keepTargetFor(tab.url);
    const state = StoreUser.store.getState();
    // The list that governs the tab's store, derived as the popup does.
    const storeId = effectiveListKey(
      state,
      parseCookieStoreId(tabCookieStoreId(tab))
    );
    if (getMatchedExpressions(state.lists, storeId, hostname).length > 0) {
      adcpLog(
        {
          msg: `CommandEvents.keepSite: a rule already matches ${hostname}; nothing added.`,
        },
        getSetting(state, SettingID.DEBUG_MODE) as boolean
      );
      return;
    }
    StoreUser.store.dispatch(
      addExpression({
        expression: localFileToRegex(keepExpression),
        listType,
        storeId,
      })
    );
  }

  /**
   * Whether the tab shows a site the commands can act on: a web page or a
   * local file. A new tab page, a browser page or an extension page has
   * none, and the site commands then do nothing.
   */
  protected static hasSite(
    tab: browser.tabs.Tab | undefined
  ): tab is browser.tabs.Tab {
    return (
      tab !== undefined &&
      isAWebpage(tab.url) &&
      keepTargetFor(tab.url).hostname !== ""
    );
  }

  /** The focused window's active tab, for a browser that passes none. */
  protected static async activeTab(): Promise<browser.tabs.Tab | undefined> {
    const [tab] = await browser.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });
    return tab;
  }
}
