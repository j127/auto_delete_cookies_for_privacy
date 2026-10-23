/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * The background on Firefox for Android (#534): it starts without the
 * contextualIdentities, contextMenus and windows APIs, and its tab
 * listeners list the open tabs on every navigation and tab close, which
 * records their sites for the next restart (src/services/carried-open-tabs.ts).
 * They also follow private tabs, so the Private keep list is erased when
 * the last one closes (#537, src/services/private-window-events.ts).
 *
 * The services init() calls that touch unrelated browser APIs are stubbed,
 * as in background-private-list.spec.ts.
 */
import { DISPATCH, UPDATE_STATE } from "@/redux/store-bridge";
import { ListType } from "@/typings/enums";
import { installAndroidFlavor } from "./android-flavor";

vi.mock("@/init-globals", () => ({}));
vi.mock("@/services/tab-events", () => ({
  default: {
    cleanFromTabEvents: vi.fn(async () => undefined),
    hydrateFromSession: vi.fn(async () => undefined),
    onDomainChange: vi.fn(),
    onDomainChangeRemove: vi.fn(),
    onTabDiscarded: vi.fn(),
    onTabUpdate: vi.fn(),
  },
}));
vi.mock("@/services/alarm-events", () => ({
  default: {
    ACTIVE_MODE_ALARM: "activeModeAlarm",
    recoverPendingCleanup: vi.fn(async () => undefined),
  },
}));
vi.mock("@/services/permission-service", () => ({
  default: { checkHostPermissions: vi.fn(async () => true) },
}));
vi.mock("@/services/browser-action-service", () => ({
  checkIfProtected: vi.fn(async () => undefined),
  setGlobalIcon: vi.fn(async () => undefined),
}));
vi.mock("@/services/carried-open-tabs", () => ({
  default: { appliesHere: vi.fn(async () => true) },
}));
vi.mock("@/services/cleanup-service", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  returnContainersOfOpenTabDomains: vi.fn(async () => ({})),
}));

vi.stubGlobal("__BROWSER__", "firefox");
installAndroidFlavor();

type Listener = (...args: any[]) => any;
const capture = () => ({ addListener: vi.fn() });
const registered = (event: { addListener: ReturnType<typeof vi.fn> }) => {
  expect(event.addListener).toHaveBeenCalledTimes(1);
  return event.addListener.mock.calls[0][0] as Listener;
};

const onMessage = capture();
const onTabUpdated = capture();
const onTabRemoved = capture();
const onTabCreated = capture();
const b = global.browser as any;
b.runtime.onMessage = onMessage;
b.tabs.onUpdated = onTabUpdated;
b.tabs.onRemoved = onTabRemoved;
b.tabs.onCreated = onTabCreated;
global.browser.storage.local.get.mockResolvedValue({} as never);
// A wake-up mid-session: the browser start was already checked, so init
// erases nothing (src/services/private-window-events.ts).
const session: Record<string, unknown> = { privateTabsStarted: true };
global.browser.storage.session.get.mockImplementation((async (
  defaults: Record<string, unknown>
) => ({ ...defaults, ...session })) as never);
global.browser.storage.session.set.mockImplementation((async (
  items: Record<string, unknown>
) => {
  Object.assign(session, items);
}) as never);
global.browser.runtime.getManifest.mockReturnValue({
  version: "1.2.0",
} as never);

await import("@/background");
const { returnContainersOfOpenTabDomains } =
  await import("@/services/cleanup-service");
const { default: CarriedOpenTabs } =
  await import("@/services/carried-open-tabs");

const messageListener = registered(onMessage);
const updatedListener = registered(onTabUpdated);
const removedListener = registered(onTabRemoved);
const createdListener = registered(onTabCreated);
const { default: TabEvents } = await import("@/services/tab-events");

const currentState = async (): Promise<State> =>
  (await messageListener({ type: UPDATE_STATE })) as State;

const listed = () =>
  vi.waitFor(() =>
    expect(returnContainersOfOpenTabDomains).toHaveBeenCalledWith(false, false)
  );

describe("background on Firefox for Android (#534)", () => {
  it("starts without containers, context menus or windows", async () => {
    const state = (await messageListener({ type: UPDATE_STATE })) as State;
    expect(state.settings).toBeDefined();
    expect(global.browser.contextualIdentities).toBeUndefined();
    expect(global.browser.windows).toBeUndefined();
  });

  it("records the open tabs when a tab navigates", async () => {
    await updatedListener(
      1,
      { url: "https://example.com/" },
      { id: 1, url: "https://example.com/" }
    );
    await listed();
  });

  it("does not list tabs for an update that changes no address", async () => {
    await updatedListener(1, { status: "loading" }, { id: 1 });
    await new Promise((r) => setTimeout(r, 0));
    expect(returnContainersOfOpenTabDomains).not.toHaveBeenCalled();
  });

  it("records the open tabs when a tab closes", async () => {
    await removedListener(1, { isWindowClosing: false, windowId: 1 });
    await listed();
  });

  describe("private tabs (#537)", () => {
    const keepPrivately = async (expression: string): Promise<void> => {
      await messageListener({
        type: DISPATCH,
        action: {
          type: "ADD_EXPRESSION",
          payload: { expression, listType: ListType.WHITE, storeId: "private" },
        },
      });
      await vi.waitFor(async () => {
        expect((await currentState()).lists.private).toHaveLength(1);
      });
    };

    it("caches a private tab when it is created", async () => {
      await createdListener({ id: 7, incognito: true });
      expect(session.privateTabIds).toEqual([7]);
    });

    it("caches a private tab when it updates", async () => {
      await updatedListener(
        8,
        { status: "loading" },
        { id: 8, incognito: true }
      );
      expect(session.privateTabIds).toEqual(expect.arrayContaining([8]));
    });

    it("erases the Private list when the last private tab closes, before the tab-close cleanup", async () => {
      session.privateTabIds = [];
      await keepPrivately("private.example");
      await createdListener({ id: 9, incognito: true });
      global.browser.tabs.query.mockResolvedValue([] as never);
      vi.mocked(TabEvents.cleanFromTabEvents).mockImplementationOnce(
        async () => {
          // The cleanup that follows sees the list already gone.
          expect((await currentState()).lists.private).toBeUndefined();
        }
      );
      await removedListener(9, { isWindowClosing: false, windowId: 1 });
      expect((await currentState()).lists.private).toBeUndefined();
      expect(TabEvents.cleanFromTabEvents).toHaveBeenCalledTimes(1);
    });

    it("keeps it when a normal tab closes", async () => {
      session.privateTabIds = [10];
      await keepPrivately("private.example");
      await removedListener(1, { isWindowClosing: false, windowId: 1 });
      expect((await currentState()).lists.private).toHaveLength(1);
      expect(TabEvents.cleanFromTabEvents).toHaveBeenCalledTimes(1);
    });
  });

  it("lists nothing where every tab is listed anyway (desktop)", async () => {
    vi.mocked(CarriedOpenTabs.appliesHere).mockResolvedValueOnce(false);
    await removedListener(1, { isWindowClosing: false, windowId: 1 });
    await new Promise((r) => setTimeout(r, 0));
    expect(returnContainersOfOpenTabDomains).not.toHaveBeenCalled();
  });
});
