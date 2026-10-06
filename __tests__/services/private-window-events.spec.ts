/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */
import { initialState } from "@/redux/state";
import createStore from "@/redux/store";
import PrivateWindowEvents from "@/services/private-window-events";
import StoreUser from "@/services/store-user";
import { ListType } from "@/typings/enums";
import { ReduxConstants } from "@/typings/redux-constants";

const store = createStore(initialState);
StoreUser.init(store);

const PRIVATE = PrivateWindowEvents.PRIVATE_SESSION_KEY;
const NORMAL = PrivateWindowEvents.NORMAL_WINDOW_KEY;

const privateWindow = (id: number) =>
  ({ id, incognito: true }) as browser.windows.Window;
const normalWindow = (id: number) =>
  ({ id, incognito: false }) as browser.windows.Window;

/** A storage.session stand-in that remembers what was set. */
let session: Record<string, unknown>;

const keep = (expression: string, storeId: string) =>
  store.dispatch({
    payload: { expression, listType: ListType.WHITE, storeId },
    type: ReduxConstants.ADD_EXPRESSION,
  });

const privateList = () => store.getState().lists.private;

const openWindows = (...windows: browser.windows.Window[]) =>
  global.browser.windows.getAll.mockResolvedValue(windows as never);

describe("PrivateWindowEvents", () => {
  beforeEach(() => {
    store.dispatch({ type: ReduxConstants.RESET_ALL });
    keep("private.example", "private");
    keep("normal.example", "default");
    session = {};
    global.browser.storage.session.get.mockImplementation((async (
      defaults: Record<string, unknown>
    ) => ({ ...defaults, ...session })) as never);
    global.browser.storage.session.set.mockImplementation((async (
      items: Record<string, unknown>
    ) => {
      Object.assign(session, items);
    }) as never);
    openWindows();
    // adcpLog prefixes every line with the manifest version.
    global.browser.runtime.getManifest.mockReturnValue({
      version: "1.2.0",
    } as never);
  });

  it("is supported where the windows API exists", () => {
    expect(PrivateWindowEvents.isSupported()).toBe(true);
  });

  describe("in normal mode (a normal window was seen)", () => {
    beforeEach(() => {
      session[NORMAL] = true;
    });

    it("clears the Private list when the last private window closes", async () => {
      await PrivateWindowEvents.onWindowCreated(privateWindow(2));
      openWindows(normalWindow(1));
      await PrivateWindowEvents.onWindowRemoved(2);
      expect(privateList()).toBeUndefined();
      // Only the Private list goes.
      expect(store.getState().lists.default).toHaveLength(1);
      // The session is over: the next window closing erases nothing more.
      expect(session[PRIVATE]).toBe(false);
    });

    it("does not clear it when one of two private windows closes", async () => {
      await PrivateWindowEvents.onWindowCreated(privateWindow(2));
      await PrivateWindowEvents.onWindowCreated(privateWindow(3));
      openWindows(normalWindow(1), privateWindow(3));
      await PrivateWindowEvents.onWindowRemoved(2);
      expect(privateList()).toHaveLength(1);
    });

    it("does not count the closed window if the browser still lists it", async () => {
      await PrivateWindowEvents.onWindowCreated(privateWindow(2));
      openWindows(privateWindow(2));
      await PrivateWindowEvents.onWindowRemoved(2);
      expect(privateList()).toBeUndefined();
    });

    it("does not clear it when a normal window closes during a private session", async () => {
      await PrivateWindowEvents.onWindowCreated(privateWindow(2));
      openWindows(privateWindow(2));
      await PrivateWindowEvents.onWindowRemoved(1);
      expect(privateList()).toHaveLength(1);
    });

    it("does not clear it when a normal window closes and no private session was open", async () => {
      // Rules added to the Private list from the settings page while no
      // private window exists stay until a private session ends.
      await PrivateWindowEvents.onWindowCreated(normalWindow(4));
      await PrivateWindowEvents.onWindowRemoved(4);
      expect(privateList()).toHaveLength(1);
      expect(global.browser.windows.getAll).not.toHaveBeenCalled();
    });

    it("init on a wake-up erases nothing", async () => {
      // The last private window closing wakes the event page: init runs
      // first, sees no private window, and must neither erase the list nor
      // forget the session, so the onRemoved that follows still erases.
      session[PRIVATE] = true;
      openWindows(normalWindow(1));
      await PrivateWindowEvents.init();
      expect(privateList()).toHaveLength(1);
      expect(session[PRIVATE]).toBe(true);
      await PrivateWindowEvents.onWindowRemoved(2);
      expect(privateList()).toBeUndefined();
    });

    it("init records an open private window", async () => {
      openWindows(normalWindow(1), privateWindow(2));
      await PrivateWindowEvents.init();
      expect(session[PRIVATE]).toBe(true);
      expect(privateList()).toHaveLength(1);
    });
  });

  describe("the first normal window of a session", () => {
    it("erases a stale Private list when no private window is open (browser start)", async () => {
      openWindows(normalWindow(1));
      await PrivateWindowEvents.init();
      expect(session[NORMAL]).toBe(true);
      expect(privateList()).toBeUndefined();
      expect(store.getState().lists.default).toHaveLength(1);
    });

    it("erases it when the normal window opens after the background started", async () => {
      await PrivateWindowEvents.init();
      expect(privateList()).toHaveLength(1);
      openWindows(normalWindow(1));
      await PrivateWindowEvents.onWindowCreated(normalWindow(1));
      expect(session[NORMAL]).toBe(true);
      expect(privateList()).toBeUndefined();
    });

    it("keeps it while a private window is open, and erases it when that one closes", async () => {
      openWindows(privateWindow(2), normalWindow(1));
      await PrivateWindowEvents.init();
      expect(session[NORMAL]).toBe(true);
      expect(privateList()).toHaveLength(1);
      openWindows(normalWindow(1));
      await PrivateWindowEvents.onWindowRemoved(2);
      expect(privateList()).toBeUndefined();
    });

    it("erases only once per session: later normal windows change nothing", async () => {
      openWindows(normalWindow(1));
      await PrivateWindowEvents.init();
      keep("private.example", "private");
      await PrivateWindowEvents.onWindowCreated(normalWindow(5));
      await PrivateWindowEvents.init();
      expect(privateList()).toHaveLength(1);
    });
  });

  describe("in all-private mode (Firefox never remembers history)", () => {
    it("never erases: not at start, not when the last private window closes", async () => {
      openWindows(privateWindow(2));
      await PrivateWindowEvents.init();
      expect(privateList()).toHaveLength(1);
      await PrivateWindowEvents.onWindowCreated(privateWindow(3));
      openWindows();
      await PrivateWindowEvents.onWindowRemoved(2);
      await PrivateWindowEvents.onWindowRemoved(3);
      expect(privateList()).toHaveLength(1);
      expect(session[NORMAL]).toBeUndefined();
    });
  });

  it("serializes handlers: a private window opened during the last one's close keeps its session", async () => {
    session[NORMAL] = true;
    session[PRIVATE] = true;
    // windows.getAll for the close resolves only after the new private
    // window's onCreated was delivered.
    let releaseGetAll: (w: browser.windows.Window[]) => void = () => undefined;
    global.browser.windows.getAll.mockImplementationOnce(
      (() =>
        new Promise<browser.windows.Window[]>((resolve) => {
          releaseGetAll = resolve;
        })) as never
    );
    const closing = PrivateWindowEvents.onWindowRemoved(2);
    const opening = PrivateWindowEvents.onWindowCreated(privateWindow(3));
    await vi.waitFor(() =>
      expect(global.browser.windows.getAll).toHaveBeenCalledTimes(1)
    );
    releaseGetAll([normalWindow(1)]);
    await closing;
    await opening;
    // The close erased (no private window was listed), then the new
    // window's session was recorded after it, not overwritten by it.
    expect(privateList()).toBeUndefined();
    expect(session[PRIVATE]).toBe(true);
  });

  it("dispatches nothing when there is no Private list", () => {
    store.dispatch({ type: ReduxConstants.REMOVE_LIST, payload: "private" });
    const before = store.getState().lists;
    PrivateWindowEvents.clearPrivateList("a test");
    // Same object: no action ran, so nothing is saved or repainted.
    expect(store.getState().lists).toBe(before);
  });

  it("logs and keeps the list when the windows query fails, and keeps handling events", async () => {
    session[PRIVATE] = true;
    session[NORMAL] = true;
    global.browser.windows.getAll.mockRejectedValueOnce(
      new Error("boom") as never
    );
    await expect(PrivateWindowEvents.onWindowRemoved(2)).resolves.toBe(
      undefined
    );
    expect(privateList()).toHaveLength(1);
    expect(global.console.error).toHaveBeenCalled();
    // The chain still runs the next handler.
    await PrivateWindowEvents.onWindowRemoved(2);
    expect(privateList()).toBeUndefined();
  });

  describe("readNormalWindowSeen (for the settings page and the popup)", () => {
    it("reads the flag", async () => {
      expect(await PrivateWindowEvents.readNormalWindowSeen()).toBe(false);
      session[NORMAL] = true;
      expect(await PrivateWindowEvents.readNormalWindowSeen()).toBe(true);
    });

    it("is false when storage.session refuses", async () => {
      global.browser.storage.session.get.mockRejectedValueOnce(
        new Error("no") as never
      );
      expect(await PrivateWindowEvents.readNormalWindowSeen()).toBe(false);
    });
  });

  describe("without storage.session", () => {
    const realSession = global.browser.storage.session;
    beforeEach(() => {
      (global.browser.storage as { session?: unknown }).session = undefined;
    });
    afterEach(() => {
      (global.browser.storage as { session?: unknown }).session = realSession;
    });

    it("tracks both flags in memory", async () => {
      expect(await PrivateWindowEvents.readNormalWindowSeen()).toBe(false);
      openWindows(normalWindow(1));
      await PrivateWindowEvents.init();
      // First normal window, no private one: the stale list goes.
      expect(privateList()).toBeUndefined();
      keep("private.example", "private");
      await PrivateWindowEvents.onWindowCreated(privateWindow(2));
      await PrivateWindowEvents.onWindowRemoved(2);
      expect(privateList()).toBeUndefined();
      // Session flag reset in memory: a normal window closing erases nothing.
      keep("private.example", "private");
      await PrivateWindowEvents.onWindowRemoved(1);
      expect(privateList()).toHaveLength(1);
    });
  });
});
