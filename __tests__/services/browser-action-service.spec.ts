import { initialState } from "@/redux/state";
import {
  checkIfProtected,
  setGlobalIcon,
  showNumberOfCookiesInIcon,
  showNumberOfCookiesInTitle,
} from "@/services/browser-action-service";
import { ListType, SettingID } from "@/typings/enums";

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

// checkIfProtected fires showNumberOfCookiesInTitle without awaiting it;
// flushing lets those floating promises settle inside the test.
const flushPromises = (): Promise<void> =>
  new Promise((resolve) => setImmediate(resolve));

const expressionFor = (listType: ListType): Expression => ({
  expression: "domain.com",
  listType,
  storeId: "default",
});

const buildState = (
  over: {
    active?: boolean;
    keepDefaultIcon?: boolean;
    lists?: StoreIdToExpressionList;
  } = {}
): State => ({
  ...initialState,
  lists: over.lists || {},
  settings: {
    ...initialState.settings,
    [SettingID.ACTIVE_MODE]: {
      name: SettingID.ACTIVE_MODE,
      value: over.active ?? true,
    },
    [SettingID.KEEP_DEFAULT_ICON]: {
      name: SettingID.KEEP_DEFAULT_ICON,
      value: over.keepDefaultIcon ?? false,
    },
  },
});

describe("BrowserActionService", () => {
  beforeAll(() => {
    global.browser.tabs.TAB_ID_NONE = -1;
  });

  beforeEach(() => {
    global.browser.runtime.getManifest.mockReturnValue({
      name: "ADCP",
      version: "1.0.0",
    });
    global.browser.action.getTitle.mockResolvedValue("");
    global.browser.action.setIcon.mockResolvedValue(undefined);
    global.browser.tabs.query.mockResolvedValue([]);
  });

  describe("showNumberOfCookiesInIcon()", () => {
    it("should show the cookie count and white text color on the tab badge", () => {
      showNumberOfCookiesInIcon(defaultTab, 5);
      expect(global.browser.action.setBadgeText).toHaveBeenCalledWith({
        tabId: 1,
        text: "5",
      });
      expect(global.browser.action.setBadgeTextColor).toHaveBeenCalledWith({
        color: "white",
        tabId: 1,
      });
    });

    it("should clear the badge text when the count is zero", () => {
      showNumberOfCookiesInIcon(defaultTab, 0);
      expect(global.browser.action.setBadgeText).toHaveBeenCalledWith({
        tabId: 1,
        text: "",
      });
    });

    it("should do nothing when the badge APIs are unavailable", () => {
      const originalSetBadgeText = global.browser.action.setBadgeText;
      const originalSetBadgeTextColor = global.browser.action.setBadgeTextColor;
      global.browser.action.setBadgeText = undefined as any;
      global.browser.action.setBadgeTextColor = undefined as any;
      try {
        expect(() => showNumberOfCookiesInIcon(defaultTab, 3)).not.toThrow();
      } finally {
        global.browser.action.setBadgeText = originalSetBadgeText;
        global.browser.action.setBadgeTextColor = originalSetBadgeTextColor;
      }
    });
  });

  describe("showNumberOfCookiesInTitle()", () => {
    it("should keep the list and count parsed from the existing title", async () => {
      global.browser.action.getTitle.mockResolvedValue("ADCP 1.0.0 [GREY] (7)");
      await showNumberOfCookiesInTitle(defaultTab, {});
      expect(global.browser.action.getTitle).toHaveBeenCalledWith({
        tabId: 1,
      });
      expect(global.browser.action.setTitle).toHaveBeenCalledWith({
        tabId: 1,
        title: "ADCP 1.0.0 [GREY] (7)",
      });
    });

    it("should override the existing list and count when new info is given", async () => {
      global.browser.action.getTitle.mockResolvedValue("ADCP 1.0.0 [GREY] (7)");
      await showNumberOfCookiesInTitle(defaultTab, {
        cookieLength: 3,
        listType: ListType.WHITE,
      });
      expect(global.browser.action.setTitle).toHaveBeenCalledWith({
        tabId: 1,
        title: "ADCP 1.0.0 [WHITE] (3)",
      });
    });

    it("should fall back to NO LIST and 0 when no data is available", async () => {
      global.browser.action.getTitle.mockResolvedValue("");
      await showNumberOfCookiesInTitle(defaultTab, {});
      expect(global.browser.action.setTitle).toHaveBeenCalledWith({
        tabId: 1,
        title: "ADCP 1.0.0 [NO LIST] (0)",
      });
    });

    it("should reset a stale non-zero count when a zero count is passed (#101)", async () => {
      global.browser.action.getTitle.mockResolvedValue("ADCP 1.0.0 [GREY] (7)");
      await showNumberOfCookiesInTitle(defaultTab, { cookieLength: 0 });
      expect(global.browser.action.setTitle).toHaveBeenCalledWith({
        tabId: 1,
        title: "ADCP 1.0.0 [GREY] (0)",
      });
    });
  });

  describe("setGlobalIcon()", () => {
    it("should set the default icon globally and on every normal tab when enabled", async () => {
      global.browser.tabs.query.mockResolvedValue([
        defaultTab,
        { ...defaultTab, id: 2 },
      ]);
      await setGlobalIcon(true);
      expect(global.browser.tabs.query).toHaveBeenCalledWith({
        windowType: "normal",
      });
      expect(global.browser.action.setIcon).toHaveBeenCalledTimes(3);
      expect(global.browser.action.setIcon).toHaveBeenNthCalledWith(1, {
        path: { 48: "/icons/icon_48.png" },
      });
      expect(global.browser.action.setIcon).toHaveBeenNthCalledWith(2, {
        path: { 48: "/icons/icon_48.png" },
        tabId: 1,
      });
      expect(global.browser.action.setIcon).toHaveBeenNthCalledWith(3, {
        path: { 48: "/icons/icon_48.png" },
        tabId: 2,
      });
    });

    it("should use the greyscale icon when disabled", async () => {
      global.browser.tabs.query.mockResolvedValue([defaultTab]);
      await setGlobalIcon(false);
      expect(global.browser.action.setIcon).toHaveBeenNthCalledWith(1, {
        path: { 48: "/icons/icon_48_greyscale.png" },
      });
      expect(global.browser.action.setIcon).toHaveBeenNthCalledWith(2, {
        path: { 48: "/icons/icon_48_greyscale.png" },
        tabId: 1,
      });
    });

    it("should skip tabs whose id is TAB_ID_NONE", async () => {
      global.browser.tabs.query.mockResolvedValue([{ ...defaultTab, id: -1 }]);
      await setGlobalIcon(true);
      expect(global.browser.action.setIcon).toHaveBeenCalledTimes(1);
    });

    it("should do nothing when action.setIcon is unavailable", async () => {
      const originalSetIcon = global.browser.action.setIcon;
      global.browser.action.setIcon = undefined as any;
      try {
        await setGlobalIcon(true);
        expect(global.browser.tabs.query).not.toHaveBeenCalled();
      } finally {
        global.browser.action.setIcon = originalSetIcon;
      }
    });
  });

  describe("checkIfProtected()", () => {
    it("should show the default icon and blue badge for a whitelisted site in active mode", async () => {
      const state = buildState({
        active: true,
        lists: { default: [expressionFor(ListType.WHITE)] },
      });
      await checkIfProtected(state, defaultTab, 5);
      await flushPromises();
      expect(global.browser.action.setIcon).toHaveBeenCalledWith({
        path: { 48: "/icons/icon_48.png" },
        tabId: 1,
      });
      expect(
        global.browser.action.setBadgeBackgroundColor
      ).toHaveBeenCalledWith({ color: "blue", tabId: 1 });
    });

    it("should only set the blue badge for a whitelisted site when inactive", async () => {
      const state = buildState({
        active: false,
        lists: { default: [expressionFor(ListType.WHITE)] },
      });
      await checkIfProtected(state, defaultTab, 5);
      await flushPromises();
      expect(global.browser.action.setIcon).not.toHaveBeenCalled();
      expect(
        global.browser.action.setBadgeBackgroundColor
      ).toHaveBeenCalledWith({ color: "blue", tabId: 1 });
    });

    it("should show the yellow icon and badge for a greylisted site in active mode", async () => {
      const state = buildState({
        active: true,
        lists: { default: [expressionFor(ListType.GREY)] },
      });
      await checkIfProtected(state, defaultTab, 5);
      await flushPromises();
      expect(global.browser.action.setIcon).toHaveBeenCalledWith({
        path: { 48: "/icons/icon_48_yellow.png" },
        tabId: 1,
      });
      expect(
        global.browser.action.setBadgeBackgroundColor
      ).toHaveBeenCalledWith({ color: "#e6a32e", tabId: 1 });
    });

    it("should keep the default icon for a greylisted site when keepDefaultIcon is set", async () => {
      const state = buildState({
        active: true,
        keepDefaultIcon: true,
        lists: { default: [expressionFor(ListType.GREY)] },
      });
      await checkIfProtected(state, defaultTab, 5);
      await flushPromises();
      expect(global.browser.action.setIcon).toHaveBeenCalledWith({
        path: { 48: "/icons/icon_48.png" },
        tabId: 1,
      });
      expect(
        global.browser.action.setBadgeBackgroundColor
      ).toHaveBeenCalledWith({ color: "#e6a32e", tabId: 1 });
    });

    it("should only set the yellow badge for a greylisted site when inactive", async () => {
      const state = buildState({
        active: false,
        lists: { default: [expressionFor(ListType.GREY)] },
      });
      await checkIfProtected(state, defaultTab, 5);
      await flushPromises();
      expect(global.browser.action.setIcon).not.toHaveBeenCalled();
      expect(
        global.browser.action.setBadgeBackgroundColor
      ).toHaveBeenCalledWith({ color: "#e6a32e", tabId: 1 });
    });

    it("should fall back to red for a matched expression with an unknown list type", async () => {
      const state = buildState({
        active: true,
        lists: {
          default: [
            {
              expression: "domain.com",
              listType: "UNKNOWN" as ListType,
              storeId: "default",
            },
          ],
        },
      });
      await checkIfProtected(state, defaultTab, 5);
      await flushPromises();
      expect(global.browser.action.setIcon).toHaveBeenCalledWith({
        path: { 48: "/icons/icon_48_red.png" },
        tabId: 1,
      });
      expect(
        global.browser.action.setBadgeBackgroundColor
      ).toHaveBeenCalledWith({ color: "red", tabId: 1 });
    });

    it("should only set the red badge for an unknown list type when inactive", async () => {
      const state = buildState({
        active: false,
        lists: {
          default: [
            {
              expression: "domain.com",
              listType: "UNKNOWN" as ListType,
              storeId: "default",
            },
          ],
        },
      });
      await checkIfProtected(state, defaultTab, 5);
      await flushPromises();
      expect(global.browser.action.setIcon).not.toHaveBeenCalled();
      expect(
        global.browser.action.setBadgeBackgroundColor
      ).toHaveBeenCalledWith({ color: "red", tabId: 1 });
    });

    it("should show the default icon for an unmatched site with zero cookies in active mode", async () => {
      const state = buildState({ active: true });
      await checkIfProtected(state, defaultTab, 0);
      await flushPromises();
      expect(global.browser.action.setIcon).toHaveBeenCalledWith({
        path: { 48: "/icons/icon_48.png" },
        tabId: 1,
      });
      expect(
        global.browser.action.setBadgeBackgroundColor
      ).toHaveBeenCalledWith({ color: "blue", tabId: 1 });
    });

    it("should only set the blue badge for an unmatched site with zero cookies when inactive", async () => {
      const state = buildState({ active: false });
      await checkIfProtected(state, defaultTab, 0);
      await flushPromises();
      expect(global.browser.action.setIcon).not.toHaveBeenCalled();
      expect(
        global.browser.action.setBadgeBackgroundColor
      ).toHaveBeenCalledWith({ color: "blue", tabId: 1 });
    });

    it("should show the red icon for an unmatched site with cookies in active mode", async () => {
      const state = buildState({ active: true });
      await checkIfProtected(state, defaultTab, 5);
      await flushPromises();
      expect(global.browser.action.setIcon).toHaveBeenCalledWith({
        path: { 48: "/icons/icon_48_red.png" },
        tabId: 1,
      });
      expect(
        global.browser.action.setBadgeBackgroundColor
      ).toHaveBeenCalledWith({ color: "red", tabId: 1 });
    });

    it("should treat a tab without url as unmatched even when expressions exist (#101)", async () => {
      // An empty hostname must not inherit the first expression of the
      // list: URL-less tabs (new tab page, chrome:// pages) match nothing.
      const state = buildState({
        active: true,
        lists: { default: [expressionFor(ListType.WHITE)] },
      });
      await checkIfProtected(
        state,
        { ...defaultTab, cookieStoreId: undefined, url: undefined },
        5
      );
      await flushPromises();
      expect(global.browser.action.setIcon).toHaveBeenCalledWith({
        path: { 48: "/icons/icon_48_red.png" },
        tabId: 1,
      });
    });

    it("should treat a tab without url as unmatched when the list is empty", async () => {
      const state = buildState({ active: true });
      await checkIfProtected(
        state,
        { ...defaultTab, cookieStoreId: undefined, url: undefined },
        5
      );
      await flushPromises();
      expect(global.browser.action.setIcon).toHaveBeenCalledWith({
        path: { 48: "/icons/icon_48_red.png" },
        tabId: 1,
      });
    });

    it("should query all active tabs when no tab is given", async () => {
      global.browser.tabs.query.mockResolvedValue([defaultTab]);
      const state = buildState({ active: false });
      await checkIfProtected(state);
      await flushPromises();
      expect(global.browser.tabs.query).toHaveBeenCalledWith({
        active: true,
        windowType: "normal",
      });
      // Unmatched with an undefined cookie count falls into the red branch.
      expect(
        global.browser.action.setBadgeBackgroundColor
      ).toHaveBeenCalledWith({ color: "red", tabId: 1 });
    });

    it("should set the title with the matched list type and cookie count", async () => {
      const state = buildState({
        lists: { default: [expressionFor(ListType.WHITE)] },
      });
      await checkIfProtected(state, defaultTab, 2);
      await flushPromises();
      expect(global.browser.action.setTitle).toHaveBeenCalledWith({
        tabId: 1,
        title: "ADCP 1.0.0 [WHITE] (2)",
      });
    });

    it("should set a NO LIST title for an unmatched site", async () => {
      const state = buildState();
      await checkIfProtected(state, defaultTab, 0);
      await flushPromises();
      expect(global.browser.action.setTitle).toHaveBeenCalledWith({
        tabId: 1,
        title: "ADCP 1.0.0 [NO LIST] (0)",
      });
    });
  });

  describe("closed tabs (missing-tab rejections)", () => {
    // TabEvents.onTabUpdate delays paints by ~750 ms, so a tab can close
    // before browser.action.* runs; Chromium rejects those calls with
    // "No tab with id: N". The service swallows exactly that rejection —
    // vitest fails the run on any unhandled rejection, which is the real
    // assertion behind these tests.
    const missingTab = () => new Error("No tab with id: 99.");

    it("skips the whole title paint when getTitle says the tab is gone", async () => {
      global.browser.action.getTitle.mockRejectedValue(missingTab());
      await expect(
        showNumberOfCookiesInTitle(defaultTab, { cookieLength: 3 })
      ).resolves.toBeUndefined();
      expect(global.browser.action.setTitle).not.toHaveBeenCalled();
    });

    it("re-throws non-missing-tab errors from getTitle", async () => {
      global.browser.action.getTitle.mockRejectedValue(new Error("boom"));
      await expect(
        showNumberOfCookiesInTitle(defaultTab, { cookieLength: 3 })
      ).rejects.toThrow("boom");
    });

    it("resolves when only setTitle rejects with a missing tab", async () => {
      global.browser.action.setTitle.mockRejectedValue(missingTab());
      await expect(
        showNumberOfCookiesInTitle(defaultTab, { cookieLength: 3 })
      ).resolves.toBeUndefined();
      await flushPromises();
    });

    it("keeps badge painting silent when the tab closed", async () => {
      global.browser.action.setBadgeText.mockRejectedValue(missingTab());
      global.browser.action.setBadgeTextColor.mockRejectedValue(missingTab());
      expect(() => showNumberOfCookiesInIcon(defaultTab, 5)).not.toThrow();
      await flushPromises();
    });

    it("completes checkIfProtected when every paint hits a closed tab", async () => {
      global.browser.action.getTitle.mockRejectedValue(missingTab());
      global.browser.action.setIcon.mockRejectedValue(missingTab());
      global.browser.action.setBadgeBackgroundColor.mockRejectedValue(
        missingTab()
      );
      const state = buildState({ active: true });
      await expect(
        checkIfProtected(state, defaultTab, 2)
      ).resolves.toBeUndefined();
      await flushPromises();
    });

    it("keeps repainting the remaining tabs when one closed mid-loop", async () => {
      const secondTab = { ...defaultTab, id: 2 };
      global.browser.tabs.query.mockResolvedValue([defaultTab, secondTab]);
      global.browser.action.setIcon
        .mockResolvedValueOnce(undefined) // global (no tabId) call
        .mockRejectedValueOnce(missingTab()) // tab 1 just closed
        .mockResolvedValue(undefined);
      await expect(setGlobalIcon(true)).resolves.toBeUndefined();
      await flushPromises();
      expect(global.browser.action.setIcon).toHaveBeenCalledWith(
        expect.objectContaining({ tabId: 2 })
      );
    });
  });
});
