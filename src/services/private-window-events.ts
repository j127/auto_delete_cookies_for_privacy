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
 * Two storage.session flags drive it. They survive event-page restarts and
 * clear with the browser session (and when the extension is updated):
 *
 * - privateSessionOpen: a private window has been open since the last
 *   erase. Set by windows.onCreated for a private window and by init().
 * - normalWindowSeen: a normal (non-private) window has been open this
 *   session. Set by windows.onCreated for a normal window and by init().
 *   Never cleared on a wake-up.
 *
 * When it erases:
 *
 * - The last private window closes (windows.onRemoved, registered
 *   synchronously at top level in src/background.ts, so it wakes the event
 *   page) and a normal window has been seen this session.
 * - The first normal window of a session is seen while no private window is
 *   open. That clears a trail left by a crash, a quit before the event ran,
 *   an extension without private-window access (which never sees private
 *   windows close), or rules that were there before an update.
 *
 * When a session never shows a normal window, Firefox is set to never
 * remember history: every window is private and the Private list holds all
 * of the person's keep rules, so nothing is ever erased. The settings page
 * and the popup read normalWindowSeen to say so (readNormalWindowSeen).
 *
 * init() runs on EVERY background start, including wake-ups after idle
 * suspension. On a wake-up normalWindowSeen is already set, so it only
 * records what is open and erases nothing.
 *
 * Handlers run one at a time (serialize), so a private window opened while
 * the last one's close is still being handled cannot have its flag
 * overwritten by that close.
 *
 * Firefox for Android (#537) has no windows API, so the end of private
 * browsing is seen through tabs instead. Two more storage.session keys:
 *
 * - privateTabIds: the private tabs open right now, as far as the extension
 *   knows. tabs.onRemoved carries no incognito flag, so the closing tab's
 *   flag comes from this cache, the way TabEvents keeps its tab -> domain
 *   cache. Filled by tabs.onCreated / tabs.onUpdated and by init().
 * - privateTabsStarted: init() has checked this browser session's start.
 *
 * When it erases on Android:
 *
 * - The last private tab closes (tabs.onRemoved, registered synchronously
 *   at top level in src/background.ts). Before erasing, tabs.query is asked
 *   once more for a private tab the cache missed.
 * - The first background start of a browser session lists no private tab.
 *   Firefox for Android never restores private tabs after a restart, so
 *   whatever the Private list holds then is from a session that has ended:
 *   the counterpart of the desktop "first normal window" rule. tabs.query
 *   only lists loaded tabs (Mozilla bug 1583281, see ./carried-open-tabs.ts),
 *   but that only hides restored tabs, which are never private.
 *
 * On a wake-up, init() adds the listed private tabs to the cache and
 * erases nothing. A cached tab that closed without the extension hearing of
 * it keeps the list until the next browser start: that errs toward keeping
 * a rule a while longer, never toward erasing one mid-session. Firefox for
 * Android has no "never remember history" mode (every window private), so
 * normalWindowSeen plays no part there.
 *
 * Removal goes through the store's usual REMOVE_LIST action, so the
 * persisted state and the toolbar repaint follow the normal path. It only
 * drops the Private list's rules: no cookie is cleaned because of it.
 */

import { SettingID } from "@/typings/enums";
import { ReduxConstants } from "@/typings/redux-constants";
import { adcpLog, getSetting } from "./libs";
import StoreUser from "./store-user";

type SessionFlag =
  "privateSessionOpen" | "normalWindowSeen" | "privateTabsStarted";

export default class PrivateWindowEvents extends StoreUser {
  /** The Private list's key in state.lists (see getStoreId in libs.ts). */
  public static readonly LIST_KEY = "private";

  /** storage.session key: a private window has been open since the last erase. */
  public static readonly PRIVATE_SESSION_KEY: SessionFlag =
    "privateSessionOpen";

  /** storage.session key: a normal window has been open this session. */
  public static readonly NORMAL_WINDOW_KEY: SessionFlag = "normalWindowSeen";

  /** storage.session key: the open private tabs (Firefox for Android). */
  public static readonly PRIVATE_TABS_KEY = "privateTabIds";

  /** storage.session key: init() checked this browser session's start (Android). */
  public static readonly TABS_STARTED_KEY: SessionFlag = "privateTabsStarted";

  /**
   * Whether the windows API exists. Without it (Firefox for Android) the
   * private session is followed through tabs instead (#537).
   */
  public static isSupported(): boolean {
    return browser.windows !== undefined;
  }

  /**
   * For the settings page and the popup: whether a normal window has been
   * seen this session. False (no normal window, so Firefox never remembers
   * history and the Private list stays saved) when it cannot be read.
   */
  public static async readNormalWindowSeen(): Promise<boolean> {
    try {
      if (!browser.storage.session) return false;
      const key = PrivateWindowEvents.NORMAL_WINDOW_KEY;
      const data = await browser.storage.session.get({ [key]: false });
      return data[key] === true;
    } catch {
      return false;
    }
  }

  /**
   * Runs on every background start. Records the windows open right now.
   * Erases only through noteNormalWindow, the first time a session shows a
   * normal window, which a wake-up never is.
   */
  public static init(): Promise<void> {
    if (!PrivateWindowEvents.isSupported()) {
      return PrivateWindowEvents.serialize("init", () =>
        PrivateWindowEvents.initTabs()
      );
    }
    return PrivateWindowEvents.serialize("init", async () => {
      const windows = await browser.windows.getAll();
      if (windows.some((w) => w.incognito)) {
        await PrivateWindowEvents.setFlag(
          PrivateWindowEvents.PRIVATE_SESSION_KEY,
          true
        );
      }
      if (windows.some((w) => !w.incognito)) {
        await PrivateWindowEvents.noteNormalWindow(windows);
      }
    });
  }

  public static onWindowCreated(window: browser.windows.Window): Promise<void> {
    return PrivateWindowEvents.serialize("onWindowCreated", async () => {
      if (window.incognito) {
        await PrivateWindowEvents.setFlag(
          PrivateWindowEvents.PRIVATE_SESSION_KEY,
          true
        );
        return;
      }
      if (
        await PrivateWindowEvents.getFlag(PrivateWindowEvents.NORMAL_WINDOW_KEY)
      ) {
        return;
      }
      await PrivateWindowEvents.noteNormalWindow(
        await browser.windows.getAll()
      );
    });
  }

  /**
   * A window closed. When a private session was open and no private window
   * is left, the session has ended: erase the Private list, unless no
   * normal window was seen this session. Closing one of several private
   * windows, or a normal window, changes nothing.
   */
  public static onWindowRemoved(windowId: number): Promise<void> {
    return PrivateWindowEvents.serialize("onWindowRemoved", async () => {
      if (
        !(await PrivateWindowEvents.getFlag(
          PrivateWindowEvents.PRIVATE_SESSION_KEY
        ))
      ) {
        return;
      }
      // The closed window is filtered out too, in case the browser still
      // lists it while the event is delivered.
      const windows = await browser.windows.getAll();
      if (windows.some((w) => w.incognito && w.id !== windowId)) return;
      await PrivateWindowEvents.setFlag(
        PrivateWindowEvents.PRIVATE_SESSION_KEY,
        false
      );
      if (
        !(await PrivateWindowEvents.getFlag(
          PrivateWindowEvents.NORMAL_WINDOW_KEY
        ))
      ) {
        PrivateWindowEvents.log(
          "kept the Private keep list: no normal window this session, so Firefox never remembers history and every window is private."
        );
        return;
      }
      PrivateWindowEvents.clearPrivateList("the last private window closed");
    });
  }

  /**
   * Android: a tab was created or updated. A private one joins the cache of
   * open private tabs, so its close can be recognized later. Normal tabs
   * return before touching storage.
   */
  public static onTabSeen(tab: browser.tabs.Tab): Promise<void> {
    if (PrivateWindowEvents.isSupported()) return Promise.resolve();
    if (!tab?.incognito || tab.id === undefined) return Promise.resolve();
    const tabId = tab.id;
    return PrivateWindowEvents.serialize("onTabSeen", async () => {
      const ids = await PrivateWindowEvents.getPrivateTabIds();
      if (ids.includes(tabId)) return;
      await PrivateWindowEvents.setPrivateTabIds([...ids, tabId]);
    });
  }

  /**
   * Android: a tab closed. When it was the last private tab, private
   * browsing has ended: erase the Private list. Closing a normal tab, or
   * one of several private tabs, changes nothing.
   */
  public static onTabRemoved(tabId: number): Promise<void> {
    if (PrivateWindowEvents.isSupported()) return Promise.resolve();
    return PrivateWindowEvents.serialize("onTabRemoved", async () => {
      const ids = await PrivateWindowEvents.getPrivateTabIds();
      if (!ids.includes(tabId)) return;
      // Drop cached ids the browser no longer knows. Opened from a private
      // tab, the extension's own popup is a private tab too, and Firefox for
      // Android sends no tabs.onRemoved when it closes, so its id would
      // otherwise keep the Private list alive for the rest of the session
      // (#550).
      const left = await PrivateWindowEvents.stillOpen(
        ids.filter((id) => id !== tabId)
      );
      if (left.length > 0) {
        await PrivateWindowEvents.setPrivateTabIds(left);
        return;
      }
      // The cache may have missed a private tab: ask once more. The closed
      // tab is filtered out too, in case it is still listed while the
      // event is delivered.
      const listed = PrivateWindowEvents.privateIds(
        await browser.tabs.query({})
      ).filter((id) => id !== tabId);
      await PrivateWindowEvents.setPrivateTabIds(listed);
      if (listed.length > 0) return;
      PrivateWindowEvents.clearPrivateList("the last private tab closed");
    });
  }

  /** Removes the Private list, if there is one, through REMOVE_LIST. */
  public static clearPrivateList(reason: string): void {
    const state = StoreUser.store.getState();
    if (state.lists[PrivateWindowEvents.LIST_KEY] === undefined) return;
    StoreUser.store.dispatch({
      payload: PrivateWindowEvents.LIST_KEY,
      type: ReduxConstants.REMOVE_LIST,
    });
    PrivateWindowEvents.log(`erased the Private keep list because ${reason}.`);
  }

  /**
   * A normal window is open. The first time in a session, record it and,
   * with no private window open, erase whatever the Private list still
   * holds from an earlier session.
   */
  protected static async noteNormalWindow(
    windows: browser.windows.Window[]
  ): Promise<void> {
    if (
      await PrivateWindowEvents.getFlag(PrivateWindowEvents.NORMAL_WINDOW_KEY)
    ) {
      return;
    }
    await PrivateWindowEvents.setFlag(
      PrivateWindowEvents.NORMAL_WINDOW_KEY,
      true
    );
    if (windows.some((w) => w.incognito)) return;
    PrivateWindowEvents.clearPrivateList(
      "the first normal window of this session opened with no private window open"
    );
  }

  /**
   * Android's init(): records the private tabs listed now. At the first
   * start of a browser session, with no private tab listed, erases what
   * the Private list still holds from an earlier session.
   */
  protected static async initTabs(): Promise<void> {
    const listed = PrivateWindowEvents.privateIds(await browser.tabs.query({}));
    if (
      await PrivateWindowEvents.getFlag(PrivateWindowEvents.TABS_STARTED_KEY)
    ) {
      // A wake-up: keep what the cache knows and add what is listed.
      const ids = await PrivateWindowEvents.getPrivateTabIds();
      const merged = Array.from(new Set([...ids, ...listed]));
      if (merged.length !== ids.length) {
        await PrivateWindowEvents.setPrivateTabIds(merged);
      }
      return;
    }
    await PrivateWindowEvents.setFlag(
      PrivateWindowEvents.TABS_STARTED_KEY,
      true
    );
    await PrivateWindowEvents.setPrivateTabIds(listed);
    if (listed.length > 0) return;
    PrivateWindowEvents.clearPrivateList(
      "the browser session started with no private tab open"
    );
  }

  /**
   * The ids among `ids` that still name a tab: tabs.get rejects for a tab
   * that is gone ("Invalid tab ID"). Only ids the cache already holds are
   * checked, and private tabs are never restored after a restart, so each
   * was a loaded tab when it was seen.
   */
  protected static async stillOpen(ids: number[]): Promise<number[]> {
    const open = await Promise.all(
      ids.map((id) =>
        Promise.resolve(browser.tabs.get(id)).then(
          () => true,
          () => false
        )
      )
    );
    return ids.filter((_, i) => open[i]);
  }

  protected static privateIds(tabs: browser.tabs.Tab[]): number[] {
    return tabs
      .filter((t) => t.incognito && t.id !== undefined)
      .map((t) => t.id as number);
  }

  protected static async getPrivateTabIds(): Promise<number[]> {
    if (!browser.storage.session) return PrivateWindowEvents.memoryTabIds;
    const key = PrivateWindowEvents.PRIVATE_TABS_KEY;
    const data = await browser.storage.session.get({ [key]: [] });
    return Array.isArray(data[key]) ? (data[key] as number[]) : [];
  }

  protected static async setPrivateTabIds(ids: number[]): Promise<void> {
    if (!browser.storage.session) {
      PrivateWindowEvents.memoryTabIds = ids;
      return;
    }
    await browser.storage.session.set({
      [PrivateWindowEvents.PRIVATE_TABS_KEY]: ids,
    });
  }

  /**
   * Runs handlers one after another. A failure is logged and never breaks
   * the chain or the background.
   */
  protected static serialize(
    where: string,
    task: () => Promise<void>
  ): Promise<void> {
    const run = PrivateWindowEvents.queue.then(task).catch((e: unknown) => {
      adcpLog(
        {
          msg: `PrivateWindowEvents.${where} failed: ${e instanceof Error ? e.message : e}`,
          type: "error",
        },
        true
      );
    });
    PrivateWindowEvents.queue = run;
    return run;
  }

  protected static async getFlag(key: SessionFlag): Promise<boolean> {
    if (!browser.storage.session) return PrivateWindowEvents.memory[key];
    const data = await browser.storage.session.get({ [key]: false });
    return data[key] === true;
  }

  protected static async setFlag(
    key: SessionFlag,
    value: boolean
  ): Promise<void> {
    if (!browser.storage.session) {
      PrivateWindowEvents.memory[key] = value;
      return;
    }
    await browser.storage.session.set({ [key]: value });
  }

  protected static log(msg: string): void {
    adcpLog(
      { msg: `PrivateWindowEvents: ${msg}` },
      getSetting(StoreUser.store.getState(), SettingID.DEBUG_MODE) as boolean
    );
  }

  protected static queue: Promise<void> = Promise.resolve();

  // Fallback for a browser without storage.session. It is lost when the
  // background restarts, so a wake-up then counts as the session's first
  // normal window; with no private window open that erase is harmless.
  protected static memory: Record<SessionFlag, boolean> = {
    normalWindowSeen: false,
    privateSessionOpen: false,
    privateTabsStarted: false,
  };

  // The same fallback for Android's private tab cache. Lost with a restart,
  // which then counts as a new browser session: init() erases only when no
  // private tab is listed, so a private session still open survives it.
  protected static memoryTabIds: number[] = [];
}
