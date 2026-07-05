import { initialState } from "../../src/redux/state";
import {
  checkIfProtected,
  setGlobalIcon,
  showNumberOfCookiesInIcon,
  showNumberOfCookiesInTitle,
} from "../../src/services/browser-action-service";
import { ListType, SettingID } from "../../src/typings/enums";

jest.requireActual("../../src/services/browser-action-service");

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
      version: "4.0.0",
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
      global.browser.action.setBadgeText = undefined;
      global.browser.action.setBadgeTextColor = undefined;
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
      global.browser.action.getTitle.mockResolvedValue("ADCP 4.0.0 [GREY] (7)");
      await showNumberOfCookiesInTitle(defaultTab, {});
      expect(global.browser.action.getTitle).toHaveBeenCalledWith({
        tabId: 1,
      });
      expect(global.browser.action.setTitle).toHaveBeenCalledWith({
        tabId: 1,
        title: "ADCP 4.0.0 [GREY] (7)",
      });
    });

    it("should override the existing list and count when new info is given", async () => {
      global.browser.action.getTitle.mockResolvedValue("ADCP 4.0.0 [GREY] (7)");
      await showNumberOfCookiesInTitle(defaultTab, {
        cookieLength: 3,
        listType: ListType.WHITE,
      });
      expect(global.browser.action.setTitle).toHaveBeenCalledWith({
        tabId: 1,
        title: "ADCP 4.0.0 [WHITE] (3)",
      });
    });

    it("should fall back to NO LIST and 0 when no data is available", async () => {
      global.browser.action.getTitle.mockResolvedValue("");
      await showNumberOfCookiesInTitle(defaultTab, {});
      expect(global.browser.action.setTitle).toHaveBeenCalledWith({
        tabId: 1,
        title: "ADCP 4.0.0 [NO LIST] (0)",
      });
    });

    it("should keep the previous count when a zero count is passed (falsy fallback)", async () => {
      // Documents current behavior: cookieLength 0 is falsy, so it cannot
      // reset an existing non-zero count parsed from the title.
      global.browser.action.getTitle.mockResolvedValue("ADCP 4.0.0 [GREY] (7)");
      await showNumberOfCookiesInTitle(defaultTab, { cookieLength: 0 });
      expect(global.browser.action.setTitle).toHaveBeenCalledWith({
        tabId: 1,
        title: "ADCP 4.0.0 [GREY] (7)",
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
      global.browser.action.setIcon = undefined;
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

    it("should match a tab without url against the first default-list expression (current behavior)", async () => {
      // Documents current behavior: an empty hostname makes
      // getMatchedExpressions return ALL expressions of the list, so a tab
      // without a URL "matches" the first expression instead of none.
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
        path: { 48: "/icons/icon_48.png" },
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
        title: "ADCP 4.0.0 [WHITE] (2)",
      });
    });

    it("should set a NO LIST title for an unmatched site", async () => {
      const state = buildState();
      await checkIfProtected(state, defaultTab, 0);
      await flushPromises();
      expect(global.browser.action.setTitle).toHaveBeenCalledWith({
        tabId: 1,
        title: "ADCP 4.0.0 [NO LIST] (0)",
      });
    });
  });
});
