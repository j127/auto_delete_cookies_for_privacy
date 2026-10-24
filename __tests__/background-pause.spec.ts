/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * The background's half of pausing automatic cleaning (#555): the keyboard
 * shortcut, the resume alarm, and a browser start ending an until-restart
 * pause before that start's cleanup runs.
 */
import { initialState } from "@/redux/state";
import { SettingID } from "@/typings/enums";
import StoreUser from "@/services/store-user";
import { RESUME_NEVER, RESUME_ON_RESTART } from "@/services/pause-service";

vi.mock("@/init-globals", () => ({}));
vi.mock("@/services/tab-events", () => ({
  default: { hydrateFromSession: vi.fn(async () => undefined) },
}));
vi.mock("@/services/alarm-events", () => ({
  default: {
    ACTIVE_MODE_ALARM: "activeModeAlarm",
    recoverPendingCleanup: vi.fn(async () => undefined),
    runPendingCleanup: vi.fn(async () => undefined),
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
// The startup cleanup is only observed, never run.
const cookieCleanup = vi.hoisted(() =>
  vi.fn(() => ({ type: "TEST_COOKIE_CLEANUP" }))
);
vi.mock("@/redux/actions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/redux/actions")>()),
  cookieCleanup,
}));

type Listener = (...args: any[]) => any;
const listen = () => ({ addListener: vi.fn() });
const b = global.browser as any;
b.runtime.onInstalled = listen();
b.runtime.onStartup = listen();
b.runtime.onMessage = listen();
b.windows.onCreated = listen();
b.windows.onRemoved = listen();
b.alarms.onAlarm = listen();
b.commands.onCommand = listen();

// Saved paused until the next browser start.
global.browser.storage.local.get.mockResolvedValue({
  state: JSON.stringify({
    ...initialState,
    settings: {
      ...initialState.settings,
      [SettingID.ACTIVE_MODE]: { name: SettingID.ACTIVE_MODE, value: false },
      [SettingID.RESUME_ACTIVE_MODE]: {
        name: SettingID.RESUME_ACTIVE_MODE,
        value: RESUME_ON_RESTART,
      },
    },
  }),
} as never);
global.browser.windows.getAll.mockResolvedValue([] as never);
global.browser.runtime.getManifest.mockReturnValue({
  version: "1.3.2",
} as never);

await import("@/background");
// Captured now: clearMocks empties mock.calls before each test.
const first = (event: { addListener: { mock: { calls: any[][] } } }) =>
  event.addListener.mock.calls[0][0] as Listener;
const onStartup = first(b.runtime.onStartup);
const onCommand = first(b.commands.onCommand);
const onAlarm = first(b.alarms.onAlarm);

// The background's own store, which init() hands to StoreUser.
class BackgroundStore extends StoreUser {
  public static get() {
    return StoreUser.store;
  }
}
const setting = (name: SettingID) =>
  BackgroundStore.get().getState().settings[name].value;

describe("background: pausing automatic cleaning (#555)", () => {
  it("keeps an until-restart pause through a worker start", () => {
    expect(setting(SettingID.ACTIVE_MODE)).toBe(false);
    expect(setting(SettingID.RESUME_ACTIVE_MODE)).toBe(RESUME_ON_RESTART);
  });

  it("a browser start ends the pause before its startup cleanup", async () => {
    await onStartup();
    expect(setting(SettingID.ACTIVE_MODE)).toBe(true);
    expect(setting(SettingID.RESUME_ACTIVE_MODE)).toBe(RESUME_NEVER);
    // The grey startup cleanup only runs while cleaning is on.
    expect(cookieCleanup).toHaveBeenCalledWith(
      expect.objectContaining({ greyCleanup: true })
    );
  });

  it("the keyboard shortcut turns cleaning off and on", async () => {
    await onCommand("toggle-active-mode");
    expect(setting(SettingID.ACTIVE_MODE)).toBe(false);
    expect(setting(SettingID.RESUME_ACTIVE_MODE)).toBe(RESUME_NEVER);
    await onCommand("toggle-active-mode");
    expect(setting(SettingID.ACTIVE_MODE)).toBe(true);
  });

  it("ignores other commands", async () => {
    await onCommand("something-else");
    expect(setting(SettingID.ACTIVE_MODE)).toBe(true);
  });

  it("the resume alarm ends a timed pause", async () => {
    BackgroundStore.get().dispatch({
      payload: {
        name: SettingID.RESUME_ACTIVE_MODE,
        value: Date.now() + 60_000,
      },
      type: "UPDATE_SETTING",
    } as never);
    BackgroundStore.get().dispatch({
      payload: { name: SettingID.ACTIVE_MODE, value: false },
      type: "UPDATE_SETTING",
    } as never);
    await onAlarm({ name: "resumeActiveModeAlarm" });
    expect(setting(SettingID.ACTIVE_MODE)).toBe(true);
    expect(setting(SettingID.RESUME_ACTIVE_MODE)).toBe(RESUME_NEVER);
  });
});
