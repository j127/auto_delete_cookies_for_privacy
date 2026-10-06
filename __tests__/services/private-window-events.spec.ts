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

const SESSION_KEY = PrivateWindowEvents.SESSION_KEY;

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
    global.browser.windows.getAll.mockResolvedValue([] as never);
    // adcpLog prefixes every line with the manifest version.
    global.browser.runtime.getManifest.mockReturnValue({
      version: "1.2.0",
    } as never);
  });

  it("is supported where the windows API exists", () => {
    expect(PrivateWindowEvents.isSupported()).toBe(true);
  });

  it("clears the Private list when the last private window closes", async () => {
    await PrivateWindowEvents.onWindowCreated(privateWindow(2));
    global.browser.windows.getAll.mockResolvedValue([normalWindow(1)] as never);
    await PrivateWindowEvents.onWindowRemoved(2);
    expect(store.getState().lists.private).toBeUndefined();
    // Only the Private list goes.
    expect(store.getState().lists.default).toHaveLength(1);
    // The session is over: the next window closing erases nothing more.
    expect(session[SESSION_KEY]).toBe(false);
  });

  it("does not clear it when one of two private windows closes", async () => {
    await PrivateWindowEvents.onWindowCreated(privateWindow(2));
    await PrivateWindowEvents.onWindowCreated(privateWindow(3));
    global.browser.windows.getAll.mockResolvedValue([
      normalWindow(1),
      privateWindow(3),
    ] as never);
    await PrivateWindowEvents.onWindowRemoved(2);
    expect(store.getState().lists.private).toHaveLength(1);
  });

  it("does not count the closed window if the browser still lists it", async () => {
    await PrivateWindowEvents.onWindowCreated(privateWindow(2));
    global.browser.windows.getAll.mockResolvedValue([
      privateWindow(2),
    ] as never);
    await PrivateWindowEvents.onWindowRemoved(2);
    expect(store.getState().lists.private).toBeUndefined();
  });

  it("does not clear it when a normal window closes during a private session", async () => {
    await PrivateWindowEvents.onWindowCreated(privateWindow(2));
    global.browser.windows.getAll.mockResolvedValue([
      privateWindow(2),
    ] as never);
    await PrivateWindowEvents.onWindowRemoved(1);
    expect(store.getState().lists.private).toHaveLength(1);
  });

  it("does not clear it when a normal window closes and no private session was open", async () => {
    // Rules added to the Private list from the settings page while no
    // private window exists stay until a private session ends.
    await PrivateWindowEvents.onWindowCreated(normalWindow(4));
    await PrivateWindowEvents.onWindowRemoved(4);
    expect(store.getState().lists.private).toHaveLength(1);
    expect(global.browser.windows.getAll).not.toHaveBeenCalled();
  });

  it("init records an open private window but never erases the list", async () => {
    global.browser.windows.getAll.mockResolvedValue([
      normalWindow(1),
      privateWindow(2),
    ] as never);
    await PrivateWindowEvents.init();
    expect(session[SESSION_KEY]).toBe(true);
    expect(store.getState().lists.private).toHaveLength(1);
  });

  it("init on a wake-up keeps the session flag and the list", async () => {
    // The last private window closing wakes the event page: init runs
    // first and sees no private window, but must neither erase the list
    // nor forget the session, so the onRemoved that follows still erases.
    session[SESSION_KEY] = true;
    global.browser.windows.getAll.mockResolvedValue([] as never);
    await PrivateWindowEvents.init();
    expect(store.getState().lists.private).toHaveLength(1);
    expect(session[SESSION_KEY]).toBe(true);
    await PrivateWindowEvents.onWindowRemoved(2);
    expect(store.getState().lists.private).toBeUndefined();
  });

  it("onBrowserStart clears the Private list", () => {
    PrivateWindowEvents.onBrowserStart();
    expect(store.getState().lists.private).toBeUndefined();
    expect(store.getState().lists.default).toHaveLength(1);
  });

  it("dispatches nothing when there is no Private list", () => {
    store.dispatch({ type: ReduxConstants.REMOVE_LIST, payload: "private" });
    const before = store.getState().lists;
    PrivateWindowEvents.onBrowserStart();
    // Same object: no action ran, so nothing is saved or repainted.
    expect(store.getState().lists).toBe(before);
  });

  it("logs and keeps the list when the windows query fails", async () => {
    session[SESSION_KEY] = true;
    global.browser.windows.getAll.mockRejectedValue(new Error("boom") as never);
    await expect(PrivateWindowEvents.onWindowRemoved(2)).resolves.toBe(
      undefined
    );
    await expect(PrivateWindowEvents.init()).resolves.toBe(undefined);
    expect(store.getState().lists.private).toHaveLength(1);
    expect(global.console.error).toHaveBeenCalled();
  });

  it("logs when storage.session refuses the write", async () => {
    global.browser.storage.session.set.mockRejectedValue(
      new Error("quota") as never
    );
    await expect(
      PrivateWindowEvents.onWindowCreated(privateWindow(2))
    ).resolves.toBe(undefined);
    expect(global.console.error).toHaveBeenCalled();
  });

  describe("without storage.session", () => {
    const realSession = global.browser.storage.session;
    beforeEach(() => {
      (global.browser.storage as { session?: unknown }).session = undefined;
    });
    afterEach(() => {
      (global.browser.storage as { session?: unknown }).session = realSession;
    });

    it("tracks the session in memory", async () => {
      await PrivateWindowEvents.onWindowCreated(privateWindow(2));
      await PrivateWindowEvents.onWindowRemoved(2);
      expect(store.getState().lists.private).toBeUndefined();
      // Flag reset in memory: a later normal window closing erases nothing.
      keep("private.example", "private");
      await PrivateWindowEvents.onWindowRemoved(1);
      expect(store.getState().lists.private).toHaveLength(1);
    });
  });
});
