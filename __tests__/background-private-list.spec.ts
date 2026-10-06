/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * The background's wiring for the Private keep list (#468): init(), which
 * runs on every background start or wake-up, must never erase it;
 * runtime.onStartup erases it once per browser session; and a
 * windows.onRemoved listener registered at the top level erases it when
 * the last private window closes.
 *
 * The services init() calls that touch unrelated browser APIs are stubbed,
 * so the real store, StoreUser, SettingService and PrivateWindowEvents run.
 */
import { ListType } from "@/typings/enums";
import { DISPATCH, UPDATE_STATE } from "@/redux/store-bridge";

// The polyfill refuses to load outside an extension; setup.js already
// provides the browser global it would create.
vi.mock("@/init-globals", () => ({}));
vi.mock("@/services/tab-events", () => ({
  default: {
    hydrateFromSession: vi.fn(async () => undefined),
  },
}));
vi.mock("@/services/alarm-events", () => ({
  default: {
    ACTIVE_MODE_ALARM: "activeModeAlarm",
    recoverPendingCleanup: vi.fn(async () => undefined),
  },
}));
vi.mock("@/services/contextual-identity-events", () => ({
  default: { init: vi.fn(async () => undefined) },
}));
vi.mock("@/services/permission-service", () => ({
  default: { checkHostPermissions: vi.fn(async () => true) },
}));
vi.mock("@/services/browser-action-service", () => ({
  checkIfProtected: vi.fn(async () => undefined),
  setGlobalIcon: vi.fn(async () => undefined),
}));
vi.mock("@/services/context-menu-events", () => ({
  default: {
    MenuID: {},
    menuInit: vi.fn(async () => undefined),
    updateMenuItemCheckbox: vi.fn(),
  },
}));

type Listener = (...args: any[]) => any;
const capture = () => ({ addListener: vi.fn() });
/** The one listener background.ts registered on event. */
const registered = (event: { addListener: ReturnType<typeof vi.fn> }) => {
  expect(event.addListener).toHaveBeenCalledTimes(1);
  return event.addListener.mock.calls[0][0] as Listener;
};

const onStartup = capture();
const onMessage = capture();
const onCreated = capture();
const onRemoved = capture();
const b = global.browser as any;
b.runtime.onStartup = onStartup;
b.runtime.onMessage = onMessage;
b.windows.onCreated = onCreated;
b.windows.onRemoved = onRemoved;

const keep = (expression: string, storeId: string) => ({
  expression,
  id: `${storeId}-${expression}`,
  listType: ListType.WHITE,
  storeId,
});

// What storage.local holds: a Private-list rule kept in a private window.
global.browser.storage.local.get.mockResolvedValue({
  state: JSON.stringify({
    lists: {
      default: [keep("normal.example", "default")],
      private: [keep("private.example", "private")],
    },
  }),
} as never);

// A wake-up mid-session: a private session was open, and no private
// window is listed (as when the last one closing is what woke the page).
const session: Record<string, unknown> = { privateSessionOpen: true };
global.browser.storage.session.get.mockImplementation((async (
  defaults: Record<string, unknown>
) => ({ ...defaults, ...session })) as never);
global.browser.storage.session.set.mockImplementation((async (
  items: Record<string, unknown>
) => {
  Object.assign(session, items);
}) as never);
global.browser.windows.getAll.mockResolvedValue([] as never);
global.browser.runtime.getManifest.mockReturnValue({
  version: "1.2.0",
} as never);

await import("@/background");

// Read once now: the config's clearMocks wipes the calls before each test.
const startupListener = registered(onStartup);
const messageListener = registered(onMessage);
registered(onCreated);
const removedListener = registered(onRemoved);

/** Awaits the background's init through the UI bridge, like a page does. */
const currentState = async (): Promise<State> =>
  (await messageListener({ type: UPDATE_STATE })) as State;

describe("background: the Private keep list", () => {
  it("init on a wake-up does not erase it", async () => {
    const state = await currentState();
    expect(state.lists.private).toHaveLength(1);
    expect(state.lists.default).toHaveLength(1);
  });

  it("closing the last private window erases it", async () => {
    await removedListener(7);
    const state = await currentState();
    expect(state.lists.private).toBeUndefined();
    expect(state.lists.default).toHaveLength(1);
  });

  it("onStartup erases it", async () => {
    // Back in the list (an import, say), with no private session open.
    session.privateSessionOpen = false;
    await messageListener({
      type: DISPATCH,
      action: {
        type: "ADD_EXPRESSION",
        payload: {
          expression: "imported.example",
          listType: ListType.WHITE,
          storeId: "private",
        },
      },
    });
    await vi.waitFor(async () => {
      expect((await currentState()).lists.private).toHaveLength(1);
    });
    // A normal window closing leaves it alone...
    await removedListener(1);
    expect((await currentState()).lists.private).toHaveLength(1);
    // ...and the next browser start erases it.
    await startupListener();
    const state = await currentState();
    expect(state.lists.private).toBeUndefined();
    expect(state.lists.default).toHaveLength(1);
  });
});
