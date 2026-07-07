import { when } from "jest-when";
import * as Actions from "@/redux/actions";
import { initialState } from "@/redux/state";
import * as BrowserActionService from "@/services/browser-action-service";
import * as CleanupService from "@/services/cleanup-service";
import * as Lib from "@/services/libs";
import { ListType, SettingID, SiteDataType } from "@/typings/enums";
import { ReduxConstants } from "@/typings/redux-constants";

const spyBrowserActions: JestSpyObject =
  global.generateSpies(BrowserActionService);
const spyCleanupService: JestSpyObject = global.generateSpies(CleanupService);
const spyLib: JestSpyObject = global.generateSpies(Lib);

const sampleExpression: Expression = {
  expression: "domain.com",
  listType: ListType.WHITE,
  storeId: "default",
};

const sampleActivityLog: ActivityLog = {
  dateTime: "sometime",
  recentlyCleaned: 1,
  siteDataCleaned: false,
  storeIds: {},
};

const makeThunkArgs = (state: State) => ({
  dispatch: jest.fn(),
  getState: jest.fn(() => state),
});

const stateWithSettings = (overrides: Setting[]): State => ({
  ...initialState,
  settings: {
    ...initialState.settings,
    ...Object.fromEntries(overrides.map((s) => [s.name, s])),
  },
});

describe("Actions", () => {
  beforeEach(() => {
    spyBrowserActions.checkIfProtected.mockImplementation(() =>
      Promise.resolve()
    );
    spyCleanupService.cleanCookiesOperation.mockResolvedValue(undefined);
    spyLib.showNotification.mockImplementation(() => undefined);
    spyLib.sleep.mockImplementation(() => Promise.resolve());
  });

  describe("plain action creators", () => {
    it("should wrap expression payloads for the UI expression actions", () => {
      expect(Actions.addExpressionUI(sampleExpression)).toEqual({
        payload: sampleExpression,
        type: ReduxConstants.ADD_EXPRESSION,
      });
      expect(Actions.removeExpressionUI(sampleExpression)).toEqual({
        payload: sampleExpression,
        type: ReduxConstants.REMOVE_EXPRESSION,
      });
      expect(Actions.updateExpressionUI(sampleExpression)).toEqual({
        payload: sampleExpression,
        type: ReduxConstants.UPDATE_EXPRESSION,
      });
    });

    it("should wrap list payloads for the UI list actions", () => {
      const lists = { default: [sampleExpression] };
      expect(Actions.clearExpressionsUI(lists)).toEqual({
        payload: lists,
        type: ReduxConstants.CLEAR_EXPRESSIONS,
      });
      expect(Actions.removeListUI("default")).toEqual({
        payload: "default",
        type: ReduxConstants.REMOVE_LIST,
      });
    });

    it("should create the activity log actions", () => {
      expect(Actions.addActivity(sampleActivityLog)).toEqual({
        payload: sampleActivityLog,
        type: ReduxConstants.ADD_ACTIVITY_LOG,
      });
      expect(Actions.removeActivity(sampleActivityLog)).toEqual({
        payload: sampleActivityLog,
        type: ReduxConstants.REMOVE_ACTIVITY_LOG,
      });
      expect(Actions.clearActivities()).toEqual({
        type: ReduxConstants.CLEAR_ACTIVITY_LOG,
      });
    });

    it("should create the cookie counter actions", () => {
      expect(Actions.incrementCookieDeletedCounter(7)).toEqual({
        payload: 7,
        type: ReduxConstants.INCREMENT_COOKIE_DELETED_COUNTER,
      });
      expect(Actions.resetCookieDeletedCounter()).toEqual({
        type: ReduxConstants.RESET_COOKIE_DELETED_COUNTER,
      });
    });

    it("should create the setting and reset actions", () => {
      expect(
        Actions.updateSetting({ name: SettingID.ACTIVE_MODE, value: true })
      ).toEqual({
        payload: { name: SettingID.ACTIVE_MODE, value: true },
        type: ReduxConstants.UPDATE_SETTING,
      });
      expect(Actions.resetSettings()).toEqual({
        type: ReduxConstants.RESET_SETTINGS,
      });
      expect(Actions.resetAll()).toEqual({ type: ReduxConstants.RESET_ALL });
    });

    it("should create the cookie cleanup UI action", () => {
      expect(
        Actions.cookieCleanupUI({ greyCleanup: true, ignoreOpenTabs: true })
      ).toEqual({
        payload: { greyCleanup: true, ignoreOpenTabs: true },
        type: ReduxConstants.COOKIE_CLEANUP,
      });
    });
  });

  describe("addExpression()", () => {
    it("should sanitize the storeId and fill defaults when no container default exists", () => {
      const { dispatch, getState } = makeThunkArgs(initialState);
      Actions.addExpression({
        expression: "domain.com",
        listType: ListType.WHITE,
        storeId: "0",
      })(dispatch, getState);
      expect(dispatch).toHaveBeenCalledWith({
        payload: {
          cleanAllCookies: undefined,
          cleanSiteData: [],
          expression: "domain.com",
          listType: ListType.WHITE,
          storeId: "default",
        },
        type: ReduxConstants.ADD_EXPRESSION,
      });
      expect(spyBrowserActions.checkIfProtected).toHaveBeenCalledWith(
        initialState
      );
    });

    it("should apply the container defaults from the matching _Default expression", () => {
      const containerDefault: Expression = {
        cleanAllCookies: false,
        cleanSiteData: [SiteDataType.LOCALSTORAGE],
        expression: "_Default:GREY",
        listType: ListType.GREY,
        storeId: "default",
      };
      const state: State = {
        ...initialState,
        lists: { default: [containerDefault] },
      };
      const { dispatch, getState } = makeThunkArgs(state);
      Actions.addExpression({
        expression: "domain.com",
        listType: ListType.GREY,
        storeId: "0",
      })(dispatch, getState);
      expect(dispatch).toHaveBeenCalledWith({
        payload: expect.objectContaining({
          cleanAllCookies: false,
          cleanSiteData: [SiteDataType.LOCALSTORAGE],
          storeId: "default",
        }),
        type: ReduxConstants.ADD_EXPRESSION,
      });
    });

    it("should keep explicit cleanup choices from the payload", () => {
      const containerDefault: Expression = {
        cleanAllCookies: true,
        cleanSiteData: [SiteDataType.LOCALSTORAGE],
        expression: "_Default:WHITE",
        listType: ListType.WHITE,
        storeId: "default",
      };
      const state: State = {
        ...initialState,
        lists: { default: [containerDefault] },
      };
      const { dispatch, getState } = makeThunkArgs(state);
      Actions.addExpression({
        cleanAllCookies: false,
        cleanSiteData: [SiteDataType.CACHE],
        expression: "domain.com",
        listType: ListType.WHITE,
        storeId: "0",
      })(dispatch, getState);
      expect(dispatch).toHaveBeenCalledWith({
        payload: expect.objectContaining({
          cleanAllCookies: false,
          cleanSiteData: [SiteDataType.CACHE],
        }),
        type: ReduxConstants.ADD_EXPRESSION,
      });
    });
  });

  describe("clearExpressions()", () => {
    it("should dispatch CLEAR_EXPRESSIONS and re-check protection", () => {
      const { dispatch, getState } = makeThunkArgs(initialState);
      const lists = { default: [sampleExpression] };
      Actions.clearExpressions(lists)(dispatch, getState);
      expect(dispatch).toHaveBeenCalledWith({
        payload: lists,
        type: ReduxConstants.CLEAR_EXPRESSIONS,
      });
      expect(spyBrowserActions.checkIfProtected).toHaveBeenCalledTimes(1);
    });
  });

  describe("removeExpression()", () => {
    it("should sanitize the private storeId and re-check protection", () => {
      const { dispatch, getState } = makeThunkArgs(initialState);
      Actions.removeExpression({
        expression: "domain.com",
        listType: ListType.WHITE,
        storeId: "1",
      })(dispatch, getState);
      expect(dispatch).toHaveBeenCalledWith({
        payload: {
          expression: "domain.com",
          listType: ListType.WHITE,
          storeId: "private",
        },
        type: ReduxConstants.REMOVE_EXPRESSION,
      });
      expect(spyBrowserActions.checkIfProtected).toHaveBeenCalledTimes(1);
    });
  });

  describe("removeList()", () => {
    it("should dispatch REMOVE_LIST and re-check protection", () => {
      const { dispatch, getState } = makeThunkArgs(initialState);
      Actions.removeList("default")(dispatch, getState);
      expect(dispatch).toHaveBeenCalledWith({
        payload: "default",
        type: ReduxConstants.REMOVE_LIST,
      });
      expect(spyBrowserActions.checkIfProtected).toHaveBeenCalledTimes(1);
    });
  });

  describe("updateExpression()", () => {
    it("should dispatch UPDATE_EXPRESSION with a sanitized storeId for a plain expression", () => {
      const { dispatch, getState } = makeThunkArgs(initialState);
      Actions.updateExpression({
        expression: "domain.com",
        listType: ListType.WHITE,
        storeId: "0",
      })(dispatch, getState);
      expect(dispatch).toHaveBeenCalledTimes(1);
      expect(dispatch).toHaveBeenCalledWith({
        payload: {
          expression: "domain.com",
          listType: ListType.WHITE,
          storeId: "default",
        },
        type: ReduxConstants.UPDATE_EXPRESSION,
      });
      expect(spyBrowserActions.checkIfProtected).toHaveBeenCalledTimes(1);
    });

    it("should enable the deprecated localstorage setting when a default expression keeps localstorage", () => {
      const { dispatch, getState } = makeThunkArgs(initialState);
      Actions.updateExpression({
        cleanSiteData: [SiteDataType.LOCALSTORAGE],
        expression: "_Default:WHITE",
        listType: ListType.WHITE,
        storeId: "0",
      })(dispatch, getState);
      expect(dispatch).toHaveBeenNthCalledWith(1, {
        payload: {
          cleanSiteData: [SiteDataType.LOCALSTORAGE],
          expression: "_Default:WHITE",
          listType: ListType.WHITE,
          storeId: "default",
        },
        type: ReduxConstants.UPDATE_EXPRESSION,
      });
      expect(dispatch).toHaveBeenNthCalledWith(2, {
        payload: {
          name: SettingID.OLD_WHITE_CLEAN_LOCALSTORAGE,
          value: true,
        },
        type: ReduxConstants.UPDATE_SETTING,
      });
    });

    it("should disable the deprecated localstorage setting when a default expression drops localstorage", () => {
      const state = stateWithSettings([
        { name: SettingID.OLD_GREY_CLEAN_LOCALSTORAGE, value: true },
      ]);
      const { dispatch, getState } = makeThunkArgs(state);
      Actions.updateExpression({
        cleanSiteData: [],
        expression: "_Default:GREY",
        listType: ListType.GREY,
        storeId: "default",
      })(dispatch, getState);
      expect(dispatch).toHaveBeenNthCalledWith(2, {
        payload: {
          name: SettingID.OLD_GREY_CLEAN_LOCALSTORAGE,
          value: false,
        },
        type: ReduxConstants.UPDATE_SETTING,
      });
    });

    it("should not touch the deprecated setting when it already matches", () => {
      const state = stateWithSettings([
        { name: SettingID.OLD_WHITE_CLEAN_LOCALSTORAGE, value: true },
      ]);
      const { dispatch, getState } = makeThunkArgs(state);
      Actions.updateExpression({
        cleanSiteData: [SiteDataType.LOCALSTORAGE],
        expression: "_Default:WHITE",
        listType: ListType.WHITE,
        storeId: "default",
      })(dispatch, getState);
      expect(dispatch).toHaveBeenCalledTimes(1);
    });

    it("should skip the migration for default expressions of non-default containers", () => {
      const { dispatch, getState } = makeThunkArgs(initialState);
      Actions.updateExpression({
        cleanSiteData: [SiteDataType.LOCALSTORAGE],
        expression: "_Default:WHITE",
        listType: ListType.WHITE,
        storeId: "container-2",
      })(dispatch, getState);
      expect(dispatch).toHaveBeenCalledTimes(1);
    });
  });

  describe("validateSettings()", () => {
    const runValidate = (state: State) => {
      const { dispatch, getState } = makeThunkArgs(state);
      Actions.validateSettings()(dispatch, getState, null);
      return dispatch;
    };

    it("should not dispatch anything for a pristine settings object", () => {
      const dispatch = runValidate(initialState);
      expect(dispatch).not.toHaveBeenCalled();
    });

    it("should repopulate a malformed setting while keeping its value", () => {
      const state: State = {
        ...initialState,
        settings: {
          ...initialState.settings,
          [SettingID.ACTIVE_MODE]: {
            junk: "extra",
            name: SettingID.ACTIVE_MODE,
            value: true,
          } as unknown as Setting,
        },
      };
      const dispatch = runValidate(state);
      expect(dispatch).toHaveBeenCalledTimes(1);
      expect(dispatch).toHaveBeenCalledWith({
        payload: { name: SettingID.ACTIVE_MODE, value: true },
        type: ReduxConstants.UPDATE_SETTING,
      });
    });

    it("should add settings missing from the state", () => {
      const settings: { [setting: string]: Setting } = {
        ...initialState.settings,
      };
      delete settings[SettingID.STAT_LOGGING];
      const state: State = { ...initialState, settings };
      const dispatch = runValidate(state);
      expect(dispatch).toHaveBeenCalledTimes(1);
      expect(dispatch).toHaveBeenCalledWith({
        payload: initialState.settings[SettingID.STAT_LOGGING],
        type: ReduxConstants.UPDATE_SETTING,
      });
    });

    it("should leave unknown extra settings alone", () => {
      const state = stateWithSettings([
        { name: "bogusSetting", value: true } as Setting,
      ]);
      const dispatch = runValidate(state);
      expect(dispatch).not.toHaveBeenCalled();
    });

    it("should raise the cleanup delay to the one second minimum", () => {
      const state = stateWithSettings([
        { name: SettingID.CLEAN_DELAY, value: 0 },
      ]);
      const dispatch = runValidate(state);
      expect(dispatch).toHaveBeenCalledWith({
        payload: { name: SettingID.CLEAN_DELAY, value: 1 },
        type: ReduxConstants.UPDATE_SETTING,
      });
    });

    it("should clamp the cleanup delay to the 32-bit maximum", () => {
      const state = stateWithSettings([
        { name: SettingID.CLEAN_DELAY, value: 999999999 },
      ]);
      const dispatch = runValidate(state);
      expect(dispatch).toHaveBeenCalledWith({
        payload: { name: SettingID.CLEAN_DELAY, value: 2147483 },
        type: ReduxConstants.UPDATE_SETTING,
      });
    });

    it("should disable keepDefaultIcon when the badge cookie count is off", () => {
      const state = stateWithSettings([
        { name: SettingID.NUM_COOKIES_ICON, value: false },
        { name: SettingID.KEEP_DEFAULT_ICON, value: true },
      ]);
      const dispatch = runValidate(state);
      expect(dispatch).toHaveBeenCalledWith({
        payload: { name: SettingID.KEEP_DEFAULT_ICON, value: false },
        type: ReduxConstants.UPDATE_SETTING,
      });
    });

    it("should leave keepDefaultIcon alone when it is already off", () => {
      const state = stateWithSettings([
        { name: SettingID.NUM_COOKIES_ICON, value: false },
        { name: SettingID.KEEP_DEFAULT_ICON, value: false },
      ]);
      const dispatch = runValidate(state);
      expect(dispatch).not.toHaveBeenCalled();
    });
  });

  describe("cookieCleanup()", () => {
    it("should run the cleanup with default options and stop on an empty result", async () => {
      const { dispatch, getState } = makeThunkArgs(initialState);
      await Actions.cookieCleanup()(dispatch, getState, null);
      expect(spyCleanupService.cleanCookiesOperation).toHaveBeenCalledWith(
        initialState,
        { greyCleanup: false, ignoreOpenTabs: false }
      );
      expect(dispatch).not.toHaveBeenCalled();
      expect(spyLib.showNotification).not.toHaveBeenCalled();
    });

    it("should record stats when cookies were cleaned and stat logging is on", async () => {
      const state = stateWithSettings([
        { name: SettingID.NOTIFY_AUTO, value: false },
      ]);
      const cachedResults = {
        ...sampleActivityLog,
        recentlyCleaned: 5,
      };
      spyCleanupService.cleanCookiesOperation.mockResolvedValue({
        cachedResults,
        setOfDeletedDomainCookies: [],
      });
      const { dispatch, getState } = makeThunkArgs(state);
      await Actions.cookieCleanup({
        greyCleanup: true,
        ignoreOpenTabs: true,
      })(dispatch, getState, null);
      expect(spyCleanupService.cleanCookiesOperation).toHaveBeenCalledWith(
        state,
        { greyCleanup: true, ignoreOpenTabs: true }
      );
      expect(dispatch).toHaveBeenNthCalledWith(1, {
        payload: 5,
        type: ReduxConstants.INCREMENT_COOKIE_DELETED_COUNTER,
      });
      expect(dispatch).toHaveBeenNthCalledWith(2, {
        payload: cachedResults,
        type: ReduxConstants.ADD_ACTIVITY_LOG,
      });
      expect(spyLib.showNotification).not.toHaveBeenCalled();
    });

    it("should log activity without incrementing when only site data was cleaned", async () => {
      const state = stateWithSettings([
        { name: SettingID.NOTIFY_AUTO, value: false },
      ]);
      const cachedResults = {
        ...sampleActivityLog,
        recentlyCleaned: 0,
        siteDataCleaned: true,
      };
      spyCleanupService.cleanCookiesOperation.mockResolvedValue({
        cachedResults,
        setOfDeletedDomainCookies: [],
      });
      const { dispatch, getState } = makeThunkArgs(state);
      await Actions.cookieCleanup({
        greyCleanup: false,
        ignoreOpenTabs: false,
      })(dispatch, getState, null);
      expect(dispatch).toHaveBeenCalledTimes(1);
      expect(dispatch).toHaveBeenCalledWith({
        payload: cachedResults,
        type: ReduxConstants.ADD_ACTIVITY_LOG,
      });
    });

    it("should not record stats when stat logging is off", async () => {
      const state = stateWithSettings([
        { name: SettingID.NOTIFY_AUTO, value: false },
        { name: SettingID.STAT_LOGGING, value: false },
      ]);
      spyCleanupService.cleanCookiesOperation.mockResolvedValue({
        cachedResults: {
          ...sampleActivityLog,
          recentlyCleaned: 5,
          siteDataCleaned: true,
        },
        setOfDeletedDomainCookies: [],
      });
      const { dispatch, getState } = makeThunkArgs(state);
      await Actions.cookieCleanup({
        greyCleanup: false,
        ignoreOpenTabs: false,
      })(dispatch, getState, null);
      expect(dispatch).not.toHaveBeenCalled();
    });

    it("should show a cookie notification listing the cleaned domains", async () => {
      const cachedResults = {
        ...sampleActivityLog,
        recentlyCleaned: 5,
        storeIds: {
          default: [
            { cookie: { hostname: "domain.com" } },
            { cookie: { hostname: "other.com" } },
          ],
        } as unknown as ActivityLog["storeIds"],
      };
      spyCleanupService.cleanCookiesOperation.mockResolvedValue({
        cachedResults,
        setOfDeletedDomainCookies: ["domain.com", "other.com"],
      });
      when(global.browser.i18n.getMessage)
        .calledWith("notificationContent", ["5", "2", "domain.com, other.com"])
        .mockReturnValue("cleaned!");
      when(global.browser.i18n.getMessage)
        .calledWith("notificationTitle")
        .mockReturnValue("Cleanup Title");
      const { dispatch, getState } = makeThunkArgs(initialState);
      await Actions.cookieCleanup({
        greyCleanup: false,
        ignoreOpenTabs: false,
      })(dispatch, getState, null);
      expect(spyLib.showNotification).toHaveBeenCalledTimes(1);
      expect(spyLib.showNotification).toHaveBeenCalledWith({
        duration: 3,
        msg: "cleaned! ...",
        title: "Cleanup Title",
      });
      expect(spyLib.sleep).toHaveBeenCalledWith(750);
    });

    it("should show a site data notification listing the browsing data domains", async () => {
      const cachedResults = {
        ...sampleActivityLog,
        browsingDataCleanup: {
          [SiteDataType.CACHE]: [],
          [SiteDataType.INDEXEDDB]: undefined,
          [SiteDataType.LOCALSTORAGE]: ["a.com", "b.com"],
        },
        recentlyCleaned: 0,
        siteDataCleaned: true,
      };
      spyCleanupService.cleanCookiesOperation.mockResolvedValue({
        cachedResults,
        setOfDeletedDomainCookies: [],
      });
      when(global.browser.i18n.getMessage)
        .calledWith("siteDataText")
        .mockReturnValue("Site Data");
      when(global.browser.i18n.getMessage)
        .calledWith("activityLogSiteDataDomainsText", [
          "Site Data",
          "a.com, b.com",
        ])
        .mockReturnValue("site data cleaned");
      when(global.browser.i18n.getMessage)
        .calledWith("notificationTitleSiteData")
        .mockReturnValue("Site Data Title");
      const { dispatch, getState } = makeThunkArgs(initialState);
      await Actions.cookieCleanup({
        greyCleanup: false,
        ignoreOpenTabs: false,
      })(dispatch, getState, null);
      expect(spyLib.showNotification).toHaveBeenCalledTimes(1);
      expect(spyLib.showNotification).toHaveBeenCalledWith({
        duration: 3,
        msg: "site data cleaned",
        title: "Site Data Title",
      });
      expect(spyLib.sleep).not.toHaveBeenCalled();
    });

    it("should skip notifications when nothing visible was cleaned", async () => {
      spyCleanupService.cleanCookiesOperation.mockResolvedValue({
        cachedResults: { ...sampleActivityLog, siteDataCleaned: true },
        setOfDeletedDomainCookies: [],
      });
      const { dispatch, getState } = makeThunkArgs(initialState);
      await Actions.cookieCleanup({
        greyCleanup: false,
        ignoreOpenTabs: false,
      })(dispatch, getState, null);
      expect(spyLib.showNotification).not.toHaveBeenCalled();
    });
  });
});
