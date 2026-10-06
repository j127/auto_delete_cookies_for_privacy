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
 * Removal goes through the store's usual REMOVE_LIST action, so the
 * persisted state and the toolbar repaint follow the normal path.
 */

import { SettingID } from "@/typings/enums";
import { ReduxConstants } from "@/typings/redux-constants";
import { adcpLog, getSetting } from "./libs";
import StoreUser from "./store-user";

type SessionFlag = "privateSessionOpen" | "normalWindowSeen";

export default class PrivateWindowEvents extends StoreUser {
  /** The Private list's key in state.lists (see getStoreId in libs.ts). */
  public static readonly LIST_KEY = "private";

  /** storage.session key: a private window has been open since the last erase. */
  public static readonly PRIVATE_SESSION_KEY: SessionFlag =
    "privateSessionOpen";

  /** storage.session key: a normal window has been open this session. */
  public static readonly NORMAL_WINDOW_KEY: SessionFlag = "normalWindowSeen";

  /** Whether the windows API exists on this build at all. */
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
    if (!PrivateWindowEvents.isSupported()) return Promise.resolve();
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
  };
}
