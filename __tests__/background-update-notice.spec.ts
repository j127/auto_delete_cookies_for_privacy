/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * The settings page auto-opens after an update (not after an install); the
 * background flags that in storage.session first so the Overview page can
 * greet the user with an update notice.
 */
import { initialState } from "@/redux/state";
import { SettingID } from "@/typings/enums";

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

type Listener = (...args: any[]) => any;
const onInstalled = { addListener: vi.fn() };
const b = global.browser as any;
b.runtime.onInstalled = onInstalled;
b.runtime.onStartup = { addListener: vi.fn() };
b.runtime.onMessage = { addListener: vi.fn() };
b.windows.onCreated = { addListener: vi.fn() };
b.windows.onRemoved = { addListener: vi.fn() };

const newPopupSetting = (value: boolean) => ({
  state: JSON.stringify({
    ...initialState,
    settings: {
      ...initialState.settings,
      [SettingID.ENABLE_NEW_POPUP]: {
        name: SettingID.ENABLE_NEW_POPUP,
        value,
      },
    },
  }),
});

global.browser.storage.local.get.mockResolvedValue(
  newPopupSetting(true) as never
);
global.browser.windows.getAll.mockResolvedValue([] as never);
global.browser.runtime.getManifest.mockReturnValue({
  version: "1.2.0",
} as never);

await import("@/background");
const installedListener = onInstalled.addListener.mock.calls[0][0] as Listener;

describe("background: the page that opens on install and update", () => {
  it("flags the update before opening the page", async () => {
    const order: string[] = [];
    global.browser.storage.session.set.mockImplementation((async (
      items: Record<string, unknown>
    ) => {
      if (items.justUpdated) order.push("flag");
    }) as never);
    global.browser.runtime.openOptionsPage.mockImplementation((async () => {
      order.push("open");
    }) as never);
    await installedListener({ reason: "update", previousVersion: "1.1.0" });
    expect(order).toEqual(["flag", "open"]);
  });

  it("does not flag a fresh install", async () => {
    global.browser.storage.session.set.mockClear();
    await installedListener({ reason: "install" });
    expect(global.browser.runtime.openOptionsPage).toHaveBeenCalled();
    expect(global.browser.storage.session.set).not.toHaveBeenCalledWith({
      justUpdated: true,
    });
  });
});
