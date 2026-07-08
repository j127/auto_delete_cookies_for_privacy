/**
 * Copyright (c) 2022 CAD Team (https://github.com/Cookie-AutoDelete/Cookie-AutoDelete/graphs/contributors)
 * Licensed under MIT (https://github.com/Cookie-AutoDelete/Cookie-AutoDelete/blob/3.X.X-Branch/LICENSE)
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { SettingID } from "@/typings/enums";
import { when } from "jest-when";
import { initialState } from "@/redux/state";
// tslint:disable-next-line: import-name
import createStore from "@/redux/store";
import * as BrowserActionService from "@/services/browser-action-service";
import SettingService from "@/services/setting-service";
import StoreUser from "@/services/store-user";
import { resetSettings, updateSetting } from "@/redux/actions";
import ContextMenuEvents from "@/services/context-menu-events";

const spyBrowserActions: JestSpyObject =
  global.generateSpies(BrowserActionService);

class TestContextMenus extends ContextMenuEvents {
  public static isInit(): boolean {
    return ContextMenuEvents.isInitialized;
  }
}

const store = createStore(initialState);
StoreUser.init(store);

class TestStore extends StoreUser {
  public static changeSetting(
    name: SettingID,
    value: string | boolean | number
  ) {
    StoreUser.store.dispatch(updateSetting({ name, value }));
  }

  public static resetSetting() {
    StoreUser.store.dispatch(resetSettings());
  }
}

class TestSettingService extends SettingService {
  public static getIsInitialized() {
    return SettingService.isInitialized;
  }

  public static getTestCurrent() {
    return SettingService.current;
  }

  public static setIsInitialized(value: boolean) {
    SettingService.isInitialized = value;
  }
}

const defaultTab: browser.tabs.Tab = {
  active: true,
  cookieStoreId: "0",
  hidden: false,
  highlighted: false,
  incognito: false,
  id: 1,
  index: 0,
  isArticle: false,
  isInReaderMode: false,
  lastAccessed: 12345678,
  pinned: false,
  url: "https://domain.com",
  windowId: 1,
};

describe("SettingService", () => {
  beforeEach(() => {
    when(global.browser.runtime.getManifest)
      .calledWith()
      .mockReturnValue({ version: "0.12.34" });
    when(global.browser.tabs.query)
      .calledWith({ windowType: "normal" })
      .mockResolvedValue([] as never);
    when(global.browser.contextMenus.update)
      .calledWith(expect.anything(), expect.anything())
      .mockResolvedValue(null as never);
  });

  afterEach(() => {
    TestStore.resetSetting();
    // Re-snapshot so the reset doesn't read as a settings transition in the
    // next test. Without this, a test that left a cleanup type off makes the
    // reset-to-defaults (all types on now) look like a fresh enable, and the
    // localStorage old/new mirror dispatches fire a phantom wipe.
    SettingService.init();
  });

  describe("init()", () => {
    it("should fetch settings from store state", () => {
      SettingService.init();
      expect(TestSettingService.getIsInitialized()).toEqual(true);
      expect(TestSettingService.getTestCurrent()).toEqual(
        initialState.settings
      );
    });
  });
  describe("onSettingsChange()", () => {
    when(global.browser.tabs.query)
      .calledWith({ active: true, windowType: "normal" })
      .mockResolvedValue([
        defaultTab,
        { ...defaultTab, url: "https://example.com" },
      ] as never);
    it("should init if not yet initialized", async () => {
      TestSettingService.setIsInitialized(false);
      expect(TestSettingService.getIsInitialized()).toEqual(false);
      await SettingService.onSettingsChange();
      expect(TestSettingService.getIsInitialized()).toEqual(true);
    });
    // Site-data types now default ON, so each transition test must first
    // switch its type off (and let onSettingsChange observe that) before the
    // enable it wants to exercise.
    it("should not clean localstorage if migrating from old setting", async () => {
      TestStore.changeSetting(SettingID.CLEANUP_LOCALSTORAGE, false);
      await SettingService.onSettingsChange();
      TestStore.changeSetting(SettingID.CLEANUP_LOCALSTORAGE_OLD, true);
      await SettingService.onSettingsChange();
      TestStore.changeSetting(SettingID.CLEANUP_LOCALSTORAGE, true);
      await SettingService.onSettingsChange();
      expect(global.browser.browsingData.remove).not.toHaveBeenCalled();
    });
    it("should clean that site data if it was recently enabled", async () => {
      TestStore.changeSetting(SettingID.CLEANUP_CACHE, false);
      await SettingService.onSettingsChange();
      TestStore.changeSetting(SettingID.CLEANUP_CACHE, true);
      await SettingService.onSettingsChange();
      expect(global.browser.browsingData.remove).toHaveBeenCalledTimes(1);
    });
    it("should NOT clean that site data if it was recently enabled and clean site data on enable is false", async () => {
      TestStore.changeSetting(SettingID.CLEANUP_CACHE, false);
      await SettingService.onSettingsChange();
      TestStore.changeSetting(SettingID.SITEDATA_EMPTY_ON_ENABLE, false);
      await SettingService.onSettingsChange();
      TestStore.changeSetting(SettingID.CLEANUP_CACHE, true);
      await SettingService.onSettingsChange();
      expect(global.browser.browsingData.remove).not.toHaveBeenCalled();
    });
    it("should enable global icon if active mode was recently enabled", async () => {
      TestStore.changeSetting(SettingID.ACTIVE_MODE, true);
      await SettingService.onSettingsChange();
      expect(spyBrowserActions.setGlobalIcon).toHaveBeenCalledWith(true);
    });
    it("should make global icon greyscale and clear alarms if active mode was recently disabled", async () => {
      TestStore.changeSetting(SettingID.ACTIVE_MODE, true);
      await SettingService.onSettingsChange();
      TestStore.changeSetting(SettingID.ACTIVE_MODE, false);
      await SettingService.onSettingsChange();
      expect(global.browser.alarms.clear).toHaveBeenCalledTimes(1);
      expect(spyBrowserActions.setGlobalIcon).toHaveBeenCalledWith(false);
    });
    it("should clear contextMenus if recently disabled", async () => {
      TestStore.changeSetting(SettingID.CONTEXT_MENUS, false);
      await SettingService.onSettingsChange();
      expect(TestContextMenus.isInit()).toEqual(false);
    });
    it("should init contextMenu items if recently enabled", async () => {
      TestStore.changeSetting(SettingID.CONTEXT_MENUS, false);
      await SettingService.onSettingsChange();
      TestStore.changeSetting(SettingID.CONTEXT_MENUS, true);
      await SettingService.onSettingsChange();
      expect(TestContextMenus.isInit()).toEqual(true);
    });
  });
});
