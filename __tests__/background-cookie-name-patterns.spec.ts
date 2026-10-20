/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * Rules saved before cookie-name patterns (#539) named cookies as plain
 * text. On its first start with patterns, the background escapes any `*` in
 * them once, so a rule that kept a cookie literally named `*` doesn't turn
 * into one that keeps every cookie of its site.
 */
import { initialState } from "@/redux/state";
import { COOKIE_NAME_PATTERNS_KEY } from "@/services/cookie-name-patterns";
import { ListType } from "@/typings/enums";

vi.mock("@/init-globals", () => ({}));
vi.mock("@/services/tab-events", () => ({
  default: { hydrateFromSession: vi.fn(async () => undefined) },
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

const b = global.browser as any;
b.runtime.onInstalled = { addListener: vi.fn() };
b.runtime.onStartup = { addListener: vi.fn() };
b.runtime.onMessage = { addListener: vi.fn() };
b.windows.onCreated = { addListener: vi.fn() };
b.windows.onRemoved = { addListener: vi.fn() };

const legacyRule: Expression = {
  cleanAllCookies: false,
  cleanSiteData: [],
  cookieNames: ["sid", "*"],
  expression: "example.com",
  id: "legacy",
  listType: ListType.WHITE,
  storeId: "default",
};

const storedState = JSON.stringify({
  ...initialState,
  lists: { default: [legacyRule] },
});

/** Starts a fresh background worker over the given storage.local. */
const startWorker = async (storage: Record<string, unknown>) => {
  vi.resetModules();
  global.browser.storage.local.get.mockResolvedValue(storage as never);
  global.browser.storage.local.set.mockResolvedValue(undefined as never);
  global.browser.windows.getAll.mockResolvedValue([] as never);
  global.browser.runtime.getManifest.mockReturnValue({
    version: "1.3.0",
  } as never);
  await import("@/background");
};

/** The state and flag the worker wrote in one set call, if it did. */
const migrationWrite = () =>
  global.browser.storage.local.set.mock.calls
    .map(([items]) => items as Record<string, unknown>)
    .find((items) => COOKIE_NAME_PATTERNS_KEY in items);

describe("background: escaping cookie names saved before patterns", () => {
  it("escapes a saved * once, writing the state and the flag together", async () => {
    await startWorker({ state: storedState });
    await vi.waitFor(() => expect(migrationWrite()).toBeDefined());
    const write = migrationWrite() as Record<string, unknown>;
    expect(write[COOKIE_NAME_PATTERNS_KEY]).toBe(true);
    const state = JSON.parse(write.state as string) as State;
    expect(state.lists.default).toHaveLength(1);
    expect(state.lists.default[0].cookieNames).toEqual(["sid", "\\*"]);
    expect(state.lists.default[0].expression).toBe("example.com");
  });

  it("leaves the rules alone once the flag is set", async () => {
    await startWorker({
      state: storedState,
      [COOKIE_NAME_PATTERNS_KEY]: true,
    });
    // Let init run to its end (it registers nothing we can await).
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(migrationWrite()).toBeUndefined();
  });

  it("sets the flag on a fresh install, with nothing to escape", async () => {
    await startWorker({});
    await vi.waitFor(() => expect(migrationWrite()).toBeDefined());
    const state = JSON.parse(
      (migrationWrite() as Record<string, unknown>).state as string
    ) as State;
    expect(state.lists).toEqual({});
  });
});
