/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2017-2022 Kenny Do and CAD Team; fork changes (c) 2026 j127.
 * Licensed under MIT (see LICENSE).
 */

/**
 * Firefox-flavored enable-time wipe specs: no implicit since-zero wipe on
 * a fresh install, and never a cache wipe (cache is not host-scopable on
 * Firefox, so its cleanup type does not exist there).
 */
import { SettingID } from "@/typings/enums";
import { ReduxConstants } from "@/typings/redux-constants";

vi.stubGlobal("__BROWSER__", "firefox");
vi.resetModules();
const { initialState } = await import("@/redux/state");
const { updateSetting } = await import("@/redux/actions");
const { default: createStore } = await import("@/redux/store");
const { default: StoreUser } = await import("@/services/store-user");
const { default: SettingService } = await import("@/services/setting-service");

const store = createStore(initialState);
StoreUser.init(store);

describe("SettingService enable-time wipe on Firefox", () => {
  beforeEach(() => {
    // onSettingsChange ends in the real checkIfProtected (no static spies
    // bind to this dynamically imported graph); give it an empty tab set.
    global.browser.tabs.query.mockResolvedValue([] as never);
    store.dispatch({ type: ReduxConstants.RESET_SETTINGS });
    SettingService.init();
  });

  it("never wipes implicitly on first run (defaults observed, no transitions)", async () => {
    await SettingService.onSettingsChange();
    expect(global.browser.browsingData.remove).not.toHaveBeenCalled();
  });

  it("never wipes on enabling a type with default settings (wipe is opt-in)", async () => {
    store.dispatch(
      updateSetting({ name: SettingID.CLEANUP_LOCALSTORAGE, value: false })
    );
    await SettingService.onSettingsChange();
    store.dispatch(
      updateSetting({ name: SettingID.CLEANUP_LOCALSTORAGE, value: true })
    );
    await SettingService.onSettingsChange();
    expect(global.browser.browsingData.remove).not.toHaveBeenCalled();
  });

  it("wipes an opted-in non-cache type but never cache", async () => {
    store.dispatch(
      updateSetting({ name: SettingID.SITEDATA_EMPTY_ON_ENABLE, value: true })
    );
    store.dispatch(
      updateSetting({ name: SettingID.CLEANUP_LOCALSTORAGE, value: false })
    );
    store.dispatch(
      updateSetting({ name: SettingID.CLEANUP_CACHE, value: false })
    );
    await SettingService.onSettingsChange();
    store.dispatch(
      updateSetting({ name: SettingID.CLEANUP_LOCALSTORAGE, value: true })
    );
    store.dispatch(
      updateSetting({ name: SettingID.CLEANUP_CACHE, value: true })
    );
    await SettingService.onSettingsChange();
    // localStorage wiped (user opted in), cache never (not host-scopable
    // on Firefox — the toggle is hidden; this covers the import path).
    expect(global.browser.browsingData.remove).toHaveBeenCalledTimes(1);
    expect(global.browser.browsingData.remove).toHaveBeenCalledWith(
      { since: 0 },
      { localStorage: true }
    );
  });
});
