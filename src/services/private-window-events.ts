/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * Private (incognito) window service (#468). Keeping a site from the popup
 * in a private window saves it in the Private keep list, which is stored
 * with the rest of the settings and would otherwise outlive the private
 * session as a record of sites visited privately. The browser erases every
 * private cookie when the last private window closes, so a Private-list
 * rule only matters during the session; this service erases the list when
 * that session ends.
 *
 * - windows.onRemoved (registered synchronously at top level in
 *   src/background.ts, so it wakes the event page): when a private session
 *   was open and no private window is left, the Private list is removed.
 * - runtime.onStartup: erased too, once per browser session. That covers a
 *   crash, a browser quit before the event ran, and an extension without
 *   private-window access, which never sees private windows close.
 * - init() runs on EVERY background start, including wake-ups after idle
 *   suspension, so it only records whether a private window is open and
 *   never erases anything.
 *
 * "A private session was open" is a flag in storage.session, so closing a
 * normal window never erases a Private list that was filled from the
 * settings page or an import while no private window existed. The flag
 * survives event-page restarts and clears with the browser session.
 *
 * Removal goes through the store's usual REMOVE_LIST action, so the
 * persisted state and the toolbar repaint follow the normal path.
 */

import { SettingID } from "@/typings/enums";
import { ReduxConstants } from "@/typings/redux-constants";
import { adcpLog, getSetting } from "./libs";
import StoreUser from "./store-user";

export default class PrivateWindowEvents extends StoreUser {
  /** The Private list's key in state.lists (see getStoreId in libs.ts). */
  public static readonly LIST_KEY = "private";

  /** storage.session key: a private window has been open this session. */
  public static readonly SESSION_KEY = "privateSessionOpen";

  /** Whether the windows API exists on this build at all. */
  public static isSupported(): boolean {
    return browser.windows !== undefined;
  }

  /**
   * Runs on every background start. Records a private window that is open
   * right now (for instance after an install or update mid-session), and
   * keeps a flag an earlier start recorded. Never clears the flag and never
   * erases the list: on a wake-up caused by the last private window
   * closing, that window is already gone, and onWindowRemoved still needs
   * to know a private session was open.
   */
  public static async init(): Promise<void> {
    if (!PrivateWindowEvents.isSupported()) return;
    try {
      if (await PrivateWindowEvents.anyPrivateWindowOpen()) {
        await PrivateWindowEvents.setSessionOpen(true);
      }
    } catch (e: unknown) {
      PrivateWindowEvents.logError("init", e);
    }
  }

  public static async onWindowCreated(
    window: browser.windows.Window
  ): Promise<void> {
    if (!window.incognito) return;
    try {
      await PrivateWindowEvents.setSessionOpen(true);
    } catch (e: unknown) {
      PrivateWindowEvents.logError("onWindowCreated", e);
    }
  }

  /**
   * A window closed. When a private session was open and no private window
   * is left, the session has ended: erase the Private list. Closing one of
   * several private windows, or a normal window, changes nothing.
   */
  public static async onWindowRemoved(windowId: number): Promise<void> {
    try {
      if (!(await PrivateWindowEvents.isSessionOpen())) return;
      // The closed window is filtered out too, in case the browser still
      // lists it while the event is delivered.
      if (await PrivateWindowEvents.anyPrivateWindowOpen(windowId)) return;
      await PrivateWindowEvents.setSessionOpen(false);
      PrivateWindowEvents.clearPrivateList("the last private window closed");
    } catch (e: unknown) {
      PrivateWindowEvents.logError("onWindowRemoved", e);
    }
  }

  /** runtime.onStartup: a new browser session starts with no Private list. */
  public static onBrowserStart(): void {
    PrivateWindowEvents.clearPrivateList("the browser started");
  }

  /** Removes the Private list, if there is one, through REMOVE_LIST. */
  public static clearPrivateList(reason: string): void {
    const state = StoreUser.store.getState();
    if (state.lists[PrivateWindowEvents.LIST_KEY] === undefined) return;
    StoreUser.store.dispatch({
      payload: PrivateWindowEvents.LIST_KEY,
      type: ReduxConstants.REMOVE_LIST,
    });
    adcpLog(
      {
        msg: `PrivateWindowEvents: erased the Private keep list because ${reason}.`,
      },
      getSetting(state, SettingID.DEBUG_MODE) as boolean
    );
  }

  protected static async anyPrivateWindowOpen(
    closedWindowId?: number
  ): Promise<boolean> {
    const windows = await browser.windows.getAll();
    return windows.some((w) => w.incognito && w.id !== closedWindowId);
  }

  protected static async isSessionOpen(): Promise<boolean> {
    if (!browser.storage.session) return PrivateWindowEvents.sessionOpen;
    const data = await browser.storage.session.get({
      [PrivateWindowEvents.SESSION_KEY]: false,
    });
    return data[PrivateWindowEvents.SESSION_KEY] === true;
  }

  protected static async setSessionOpen(open: boolean): Promise<void> {
    PrivateWindowEvents.sessionOpen = open;
    if (!browser.storage.session) return;
    await browser.storage.session.set({
      [PrivateWindowEvents.SESSION_KEY]: open,
    });
  }

  protected static logError(where: string, e: unknown): void {
    adcpLog(
      {
        msg: `PrivateWindowEvents.${where} failed: ${e instanceof Error ? e.message : e}`,
        type: "error",
      },
      true
    );
  }

  // Fallback for a browser without storage.session (lost on a restart of
  // the background, which then errs on the side of keeping the list).
  protected static sessionOpen = false;
}
