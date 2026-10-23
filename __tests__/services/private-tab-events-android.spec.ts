/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * The Private keep list on Firefox for Android (#537). Without a windows
 * API the end of private browsing is seen through tabs: the list is erased
 * when the last private tab closes, and at the first start of a browser
 * session that lists no private tab (private tabs are never restored).
 * tabs.onRemoved has no incognito flag, so the private tabs are cached in
 * storage.session as they are seen.
 */
import { initialState } from "@/redux/state";
import { ListType, SettingID } from "@/typings/enums";
import { ReduxConstants } from "@/typings/redux-constants";
import { installAndroidFlavor } from "../android-flavor";

vi.stubGlobal("__BROWSER__", "firefox");
vi.resetModules();
installAndroidFlavor();
const { default: createStore } = await import("@/redux/store");
const { default: PrivateWindowEvents } =
  await import("@/services/private-window-events");
const { default: StoreUser } = await import("@/services/store-user");

const store = createStore(initialState);
StoreUser.init(store);

const TABS = PrivateWindowEvents.PRIVATE_TABS_KEY;
const STARTED = PrivateWindowEvents.TABS_STARTED_KEY;

const privateTab = (id: number) =>
  ({ id, incognito: true }) as browser.tabs.Tab;
const normalTab = (id: number) =>
  ({ id, incognito: false }) as browser.tabs.Tab;

/** A storage.session stand-in that remembers what was set. */
let session: Record<string, unknown>;

const keep = (expression: string, storeId: string) =>
  store.dispatch({
    payload: { expression, listType: ListType.WHITE, storeId },
    type: ReduxConstants.ADD_EXPRESSION,
  });

const privateList = () => store.getState().lists.private;

/** What tabs.query lists (Android lists only loaded tabs). */
const listTabs = (...tabs: browser.tabs.Tab[]) =>
  global.browser.tabs.query.mockResolvedValue(tabs as never);

describe("PrivateWindowEvents on Firefox for Android (#537)", () => {
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
    listTabs();
    global.browser.runtime.getManifest.mockReturnValue({
      version: "1.3.0",
    } as never);
  });

  it("is not supported through windows here", () => {
    expect(global.browser.windows).toBeUndefined();
    expect(PrivateWindowEvents.isSupported()).toBe(false);
  });

  describe("tracking private tabs", () => {
    it("caches a private tab as it is seen, once", async () => {
      await PrivateWindowEvents.onTabSeen(privateTab(5));
      await PrivateWindowEvents.onTabSeen(privateTab(5));
      expect(session[TABS]).toEqual([5]);
    });

    it("leaves storage alone for a normal tab", async () => {
      await PrivateWindowEvents.onTabSeen(normalTab(1));
      expect(global.browser.storage.session.set).not.toHaveBeenCalled();
      expect(global.browser.storage.session.get).not.toHaveBeenCalled();
    });

    it("ignores a tab without an id", async () => {
      await PrivateWindowEvents.onTabSeen({
        incognito: true,
      } as browser.tabs.Tab);
      expect(global.browser.storage.session.set).not.toHaveBeenCalled();
    });
  });

  describe("when a tab closes", () => {
    it("erases the Private list when the last private tab closes", async () => {
      await PrivateWindowEvents.onTabSeen(privateTab(5));
      listTabs(normalTab(1));
      await PrivateWindowEvents.onTabRemoved(5);
      expect(privateList()).toBeUndefined();
      // Only the Private list goes.
      expect(store.getState().lists.default).toHaveLength(1);
      expect(session[TABS]).toEqual([]);
    });

    it("keeps it when one of two private tabs closes", async () => {
      await PrivateWindowEvents.onTabSeen(privateTab(5));
      await PrivateWindowEvents.onTabSeen(privateTab(6));
      await PrivateWindowEvents.onTabRemoved(5);
      expect(privateList()).toHaveLength(1);
      expect(session[TABS]).toEqual([6]);
      // The cache was enough: no need to list the tabs.
      expect(global.browser.tabs.query).not.toHaveBeenCalled();
    });

    it("keeps it when a normal tab closes", async () => {
      await PrivateWindowEvents.onTabSeen(privateTab(5));
      await PrivateWindowEvents.onTabRemoved(1);
      expect(privateList()).toHaveLength(1);
      expect(session[TABS]).toEqual([5]);
    });

    it("keeps it when no private tab was open (a normal tab closing)", async () => {
      await PrivateWindowEvents.onTabRemoved(1);
      expect(privateList()).toHaveLength(1);
    });

    it("keeps it when tabs.query lists a private tab the cache missed", async () => {
      await PrivateWindowEvents.onTabSeen(privateTab(5));
      listTabs(normalTab(1), privateTab(7));
      await PrivateWindowEvents.onTabRemoved(5);
      expect(privateList()).toHaveLength(1);
      expect(session[TABS]).toEqual([7]);
      // That tab closing later ends the session.
      listTabs(normalTab(1));
      await PrivateWindowEvents.onTabRemoved(7);
      expect(privateList()).toBeUndefined();
    });

    it("does not count the closed tab if the browser still lists it", async () => {
      await PrivateWindowEvents.onTabSeen(privateTab(5));
      listTabs(privateTab(5));
      await PrivateWindowEvents.onTabRemoved(5);
      expect(privateList()).toBeUndefined();
    });

    it("drops only the rules, cleaning no cookie, with automatic cleaning on", async () => {
      store.dispatch({
        payload: { name: SettingID.ACTIVE_MODE, value: true },
        type: ReduxConstants.UPDATE_SETTING,
      });
      await PrivateWindowEvents.onTabSeen(privateTab(5));
      await PrivateWindowEvents.onTabRemoved(5);
      expect(privateList()).toBeUndefined();
      expect(store.getState().lists.default).toHaveLength(1);
      expect(global.browser.cookies.remove).not.toHaveBeenCalled();
      expect(global.browser.cookies.getAll).not.toHaveBeenCalled();
      expect(global.browser.browsingData.remove).not.toHaveBeenCalled();
    });

    it("survives a storage failure and keeps handling later events", async () => {
      global.browser.storage.session.get.mockRejectedValueOnce(
        new Error("storage gone")
      );
      await PrivateWindowEvents.onTabRemoved(5);
      expect(privateList()).toHaveLength(1);
      await PrivateWindowEvents.onTabSeen(privateTab(5));
      await PrivateWindowEvents.onTabRemoved(5);
      expect(privateList()).toBeUndefined();
    });
  });

  describe("init", () => {
    it("erases a leftover list at a browser start with no private tab", async () => {
      listTabs(normalTab(1));
      await PrivateWindowEvents.init();
      expect(privateList()).toBeUndefined();
      expect(store.getState().lists.default).toHaveLength(1);
      expect(session[STARTED]).toBe(true);
      expect(session[TABS]).toEqual([]);
    });

    it("keeps it at a start that lists a private tab, and caches that tab", async () => {
      listTabs(normalTab(1), privateTab(5));
      await PrivateWindowEvents.init();
      expect(privateList()).toHaveLength(1);
      expect(session[TABS]).toEqual([5]);
      // Its close then ends the session.
      listTabs(normalTab(1));
      await PrivateWindowEvents.onTabRemoved(5);
      expect(privateList()).toBeUndefined();
    });

    it("erases nothing on a wake-up, even with no private tab listed", async () => {
      session[STARTED] = true;
      session[TABS] = [5];
      listTabs(normalTab(1));
      await PrivateWindowEvents.init();
      expect(privateList()).toHaveLength(1);
      // A cached tab missing from the list may still be open: it stays.
      expect(session[TABS]).toEqual([5]);
    });

    it("adds the private tabs listed on a wake-up to the cache", async () => {
      session[STARTED] = true;
      session[TABS] = [5];
      listTabs(privateTab(5), privateTab(6));
      await PrivateWindowEvents.init();
      expect(session[TABS]).toEqual([5, 6]);
      expect(privateList()).toHaveLength(1);
    });

    it("asks tabs.query for every tab, not the windows API", async () => {
      await expect(PrivateWindowEvents.init()).resolves.toBeUndefined();
      expect(global.browser.tabs.query).toHaveBeenCalledWith({});
    });
  });

  describe("without storage.session", () => {
    const realSession = global.browser.storage.session;

    afterEach(() => {
      (global.browser.storage as { session?: unknown }).session = realSession;
    });

    it("keeps the private tabs in memory and still erases at the last close", async () => {
      (global.browser.storage as { session?: unknown }).session = undefined;
      listTabs(privateTab(5));
      await PrivateWindowEvents.init();
      expect(privateList()).toHaveLength(1);
      await PrivateWindowEvents.onTabSeen(privateTab(6));
      listTabs();
      await PrivateWindowEvents.onTabRemoved(5);
      expect(privateList()).toHaveLength(1);
      await PrivateWindowEvents.onTabRemoved(6);
      expect(privateList()).toBeUndefined();
    });
  });
});
