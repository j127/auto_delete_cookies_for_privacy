/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * The background's wiring for the Private keep list (#468): init() on a
 * wake-up never erases it; windows.onRemoved, registered at the top level,
 * erases it when the last private window closes; windows.onCreated erases a
 * stale list at the session's first normal window; and a session with
 * private windows only (Firefox never remembers history) erases nothing,
 * runtime.onStartup included.
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

// A wake-up mid-session in normal mode: a normal window was seen, a
// private session was open, and no private window is listed (as when the
// last one closing is what woke the page).
const session: Record<string, unknown> = {
  normalWindowSeen: true,
  privateSessionOpen: true,
};
global.browser.storage.session.get.mockImplementation((async (
  defaults: Record<string, unknown>
) => ({ ...defaults, ...session })) as never);
global.browser.storage.session.set.mockImplementation((async (
  items: Record<string, unknown>
) => {
  Object.assign(session, items);
}) as never);
const normalWindow = { id: 1, incognito: false };
const privateWindow = { id: 2, incognito: true };
global.browser.windows.getAll.mockResolvedValue([normalWindow] as never);
global.browser.runtime.getManifest.mockReturnValue({
  version: "1.2.0",
} as never);

await import("@/background");

// Read once now: the config's clearMocks wipes the calls before each test.
const startupListener = registered(onStartup);
const messageListener = registered(onMessage);
const createdListener = registered(onCreated);
const removedListener = registered(onRemoved);

/** Awaits the background's init through the UI bridge, like a page does. */
const currentState = async (): Promise<State> =>
  (await messageListener({ type: UPDATE_STATE })) as State;

/** Adds a Private-list rule through the UI bridge, like Saved sites does. */
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

  it("a normal window closing leaves it, and so does onStartup", async () => {
    // Back in the list (an import, say), with no private session open.
    session.privateSessionOpen = false;
    await keepPrivately("imported.example");
    await removedListener(1);
    expect((await currentState()).lists.private).toHaveLength(1);
    // Browser start no longer erases on its own: the first normal window
    // of the session does, below.
    await startupListener();
    expect((await currentState()).lists.private).toHaveLength(1);
  });

  it("the first normal window of a new session erases a stale list", async () => {
    // A new browser session: storage.session starts empty.
    for (const key of Object.keys(session)) delete session[key];
    global.browser.windows.getAll.mockResolvedValue([normalWindow] as never);
    await createdListener(normalWindow);
    const state = await currentState();
    expect(state.lists.private).toBeUndefined();
    expect(state.lists.default).toHaveLength(1);
    expect(session.normalWindowSeen).toBe(true);
  });

  it("in all-private mode nothing is erased", async () => {
    // A session with private windows only: Firefox never remembers history.
    for (const key of Object.keys(session)) delete session[key];
    await keepPrivately("kept.example");
    global.browser.windows.getAll.mockResolvedValue([privateWindow] as never);
    await createdListener(privateWindow);
    global.browser.windows.getAll.mockResolvedValue([] as never);
    await removedListener(privateWindow.id);
    await startupListener();
    expect((await currentState()).lists.private).toHaveLength(1);
    expect(session.normalWindowSeen).toBeUndefined();
  });
});
