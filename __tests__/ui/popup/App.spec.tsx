/**
 * @jest-environment jsdom
 */
import * as React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore } from "redux";
import { initialState } from "@/redux/state";
import { ListType, SettingID } from "@/typings/enums";
import App from "@/ui/popup/App";

vi.mock("@/services/cleanup-service", () => ({
  clearCookiesForThisDomain: vi.fn().mockResolvedValue(true),
  clearLocalStorageForThisDomain: vi.fn().mockResolvedValue(true),
  clearSiteDataForThisDomain: vi.fn().mockResolvedValue(true),
}));

// The panel has its own spec; here it only needs to render harmlessly
// (the real collector would hit unmocked cookies/scripting APIs).
vi.mock("@/services/site-data-service", () => ({
  collectSiteData: vi.fn().mockResolvedValue({ available: false }),
}));

interface FakePort {
  name: string;
  onMessage: { addListener: jest.Mock };
  onDisconnect: { addListener: jest.Mock };
  postMessage: jest.Mock;
  disconnect: jest.Mock;
}

// Chrome tabs carry no cookieStoreId, so the popup falls back to the
// "default" store.
const tabFixture = {
  active: true,
  highlighted: false,
  id: 1,
  incognito: false,
  index: 0,
  pinned: false,
  url: "https://example.com/",
  windowId: 1,
};

const whiteExpression: Expression = {
  expression: "*.example.com",
  id: "exp-1",
  listType: ListType.WHITE,
  storeId: "default",
};

const settingsWith = (overrides: {
  [name: string]: boolean | number;
}): State["settings"] => {
  const next = { ...initialState.settings };
  Object.entries(overrides).forEach(([name, value]) => {
    next[name] = { name, value };
  });
  return next;
};

describe("popup App", () => {
  let fakePort: FakePort;

  const renderApp = async (stateOverrides: Partial<State> = {}) => {
    const store = createStore(() => ({ ...initialState, ...stateOverrides }));
    const dispatchSpy = jest.spyOn(store, "dispatch");
    const utils = render(
      <Provider store={store}>
        <App />
      </Provider>
    );
    // The popup body only appears once the mocked active tab resolves.
    await waitFor(() =>
      expect(document.getElementById("cadPopup")).toBeTruthy()
    );
    return { ...utils, dispatchSpy, store };
  };

  beforeEach(() => {
    global.browser.i18n.getMessage.mockImplementation(
      (key: string, subs?: string[]) =>
        subs && subs.length ? `${key}[${subs.join("|")}]` : key
    );
    global.browser.runtime.getManifest.mockReturnValue({ version: "1.0.0" });
    global.browser.tabs.query.mockResolvedValue([tabFixture]);
    global.browser.cookies.getAll.mockResolvedValue([]);
    fakePort = {
      name: "popupADCP_1",
      onMessage: { addListener: jest.fn() },
      onDisconnect: { addListener: jest.fn() },
      postMessage: jest.fn(),
      disconnect: jest.fn(),
    };
    global.browser.runtime.connect.mockReturnValue(fakePort);
  });

  it("renders a Loading placeholder until the active tab resolves", async () => {
    const { container } = render(
      <Provider store={createStore(() => initialState)}>
        <App />
      </Provider>
    );
    expect(container.textContent).toBe("Loading");
    await waitFor(() =>
      expect(document.getElementById("cadPopup")).toBeTruthy()
    );
  });

  it("renders without console errors", async () => {
    await renderApp();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("renders the name bar with the full name and Share menu, no version", async () => {
    const { getByText } = await renderApp();
    const byId = (id: string) => document.getElementById(id) as HTMLElement;
    expect(byId("CADTitle").textContent).toBe("extensionName");
    expect(document.getElementById("CADVersion")).toBeNull();
    expect(getByText("shareText")).toBeTruthy();
  });

  it("shows the off hero while auto-delete is disabled", async () => {
    const { getByText } = await renderApp();
    expect(getByText("popupHeroOffText")).toBeTruthy();
    expect(getByText("popupHeroOffSubText")).toBeTruthy();
  });

  it("shows the resting hero and cleaned badge when auto-delete is on", async () => {
    const { getByText } = await renderApp({
      settings: settingsWith({ [SettingID.ACTIVE_MODE]: true }),
    });
    expect(getByText("popupHeroOnText")).toBeTruthy();
    expect(getByText("popupHeroForgetText")).toBeTruthy();
    expect(getByText("siteWillBeCleanedText")).toBeTruthy();
    expect(getByText("siteCleanDelayText[15]")).toBeTruthy();
  });

  it("shows the kept hero and badge when a permanent keep rule matches", async () => {
    const { getByText } = await renderApp({
      lists: { default: [whiteExpression] },
      settings: settingsWith({ [SettingID.ACTIVE_MODE]: true }),
    });
    expect(getByText("popupHeroKeepingText")).toBeTruthy();
    expect(getByText("popupHeroKeepListText[example.com]")).toBeTruthy();
    expect(getByText("siteKeptText")).toBeTruthy();
    expect(getByText("siteKeptStatusText")).toBeTruthy();
  });

  it("uses the session wording when only a greylist rule matches", async () => {
    const { getByText } = await renderApp({
      lists: {
        default: [{ ...whiteExpression, listType: ListType.GREY }],
      },
      settings: settingsWith({ [SettingID.ACTIVE_MODE]: true }),
    });
    expect(getByText("popupHeroKeepSessionListText[example.com]")).toBeTruthy();
    expect(getByText("siteKeptSessionStatusText")).toBeTruthy();
  });

  it("sizes the text from the default sizePopup setting at the fixed width", async () => {
    await renderApp();
    expect(document.documentElement.style.fontSize).toBe("16px");
    expect(document.documentElement.style.minWidth).toBe("430px");
  });

  it("scales only the text, not the width, with a larger sizePopup setting", async () => {
    await renderApp({
      settings: settingsWith({ [SettingID.SIZE_POPUP]: 20 }),
    });
    expect(document.documentElement.style.fontSize).toBe("20px");
    expect(document.documentElement.style.minWidth).toBe("430px");
  });

  it("opens a long-lived port named after the hostname and store", async () => {
    await renderApp();
    // The port is connected in an effect; on a slow runner it may not have
    // fired yet when this test resumes.
    await waitFor(() =>
      expect(global.browser.runtime.connect).toHaveBeenCalledTimes(1)
    );
    expect(global.browser.runtime.connect).toHaveBeenCalledWith({
      name: "popupADCP_example.com,default",
    });
    expect(fakePort.onMessage.addListener).toHaveBeenCalledTimes(1);
    expect(fakePort.onDisconnect.addListener).toHaveBeenCalledTimes(1);
  });

  it("disconnects the port when the popup unmounts", async () => {
    const { unmount } = await renderApp();
    // Unmount cleanup only disconnects a port that exists — wait for the
    // connect effect before pulling the plug.
    await waitFor(() =>
      expect(global.browser.runtime.connect).toHaveBeenCalledTimes(1)
    );
    expect(fakePort.disconnect).not.toHaveBeenCalled();
    unmount();
    expect(fakePort.disconnect).toHaveBeenCalledTimes(1);
  });

  it("whitelists the wildcarded main domain from the primary keep action", async () => {
    const { dispatchSpy, getByText } = await renderApp();
    expect(getByText("keepCookiesCaptionText[example.com]")).toBeTruthy();
    fireEvent.click(getByText("keepCookiesButtonText"));
    expect(dispatchSpy).toHaveBeenCalledWith({
      payload: {
        expression: "*.example.com",
        listType: ListType.WHITE,
        storeId: "default",
      },
      type: "ADD_EXPRESSION",
    });
  });

  it("greylists the wildcarded main domain from the session action", async () => {
    const { dispatchSpy, getByText } = await renderApp();
    fireEvent.click(getByText("keepUntilCloseButtonText"));
    expect(dispatchSpy).toHaveBeenCalledWith({
      payload: {
        expression: "*.example.com",
        listType: ListType.GREY,
        storeId: "default",
      },
      type: "ADD_EXPRESSION",
    });
  });

  it("replaces the keep actions with a remove action when a rule matches", async () => {
    const { dispatchSpy, getByText, queryByText } = await renderApp({
      lists: { default: [whiteExpression] },
    });
    expect(queryByText("keepCookiesButtonText")).toBeNull();
    expect(queryByText("keepUntilCloseButtonText")).toBeNull();
    fireEvent.click(getByText("stopKeepingButtonText"));
    expect(dispatchSpy).toHaveBeenCalledWith({
      payload: whiteExpression,
      type: "REMOVE_EXPRESSION",
    });
  });

  it("dispatches a cookie cleanup and flashes the actions block", async () => {
    const { dispatchSpy, getByText } = await renderApp();
    fireEvent.click(getByText("cleanNowText"));
    expect(dispatchSpy).toHaveBeenCalledWith({
      payload: { greyCleanup: false, ignoreOpenTabs: false },
      type: "COOKIE_CLEANUP",
    });
    const actions = document.getElementById("popupActions") as HTMLElement;
    expect(actions.classList.contains("successAnimated")).toBe(true);
  });

  it("hides every advanced control by default", async () => {
    await renderApp();
    expect(document.getElementById("advancedControls")).toBeNull();
    expect(document.getElementById("moreCleaningOptions")).toBeNull();
  });

  it("reveals the rule line, expression rows and clean menu when the setting is on", async () => {
    const { getAllByText, getByText, dispatchSpy } = await renderApp({
      settings: settingsWith({ [SettingID.POPUP_ADVANCED]: true }),
    });
    expect(document.getElementById("advancedControls")).toBeTruthy();
    expect(getByText("noRuleMatchText")).toBeTruthy();

    // example.com resolves to two addable expressions, in
    // [Keep this session] [Keep] order.
    const sessionButtons = getAllByText("keepSessionButtonText");
    const keepButtons = getAllByText("keepButtonText");
    expect(sessionButtons).toHaveLength(2);
    expect(keepButtons).toHaveLength(2);
    const row = sessionButtons[0].parentElement as HTMLElement;
    const rowButtons = Array.from(row.querySelectorAll("button")).map(
      (b) => b.textContent
    );
    expect(rowButtons).toEqual(["keepSessionButtonText", "keepButtonText"]);

    fireEvent.click(sessionButtons[0]);
    expect(dispatchSpy).toHaveBeenCalledWith({
      payload: {
        expression: "example.com",
        listType: ListType.GREY,
        storeId: "default",
      },
      type: "ADD_EXPRESSION",
    });

    fireEvent.click(getByText("cleanIncludeOpenTabsText"));
    expect(dispatchSpy).toHaveBeenCalledWith({
      payload: { greyCleanup: false, ignoreOpenTabs: true },
      type: "COOKIE_CLEANUP",
    });
  });

  it("names the matched rule in the advanced rule line", async () => {
    const { getByText } = await renderApp({
      lists: { default: [whiteExpression] },
      settings: settingsWith({ [SettingID.POPUP_ADVANCED]: true }),
    });
    expect(getByText("matchedRuleText[*.example.com]")).toBeTruthy();
  });

  it("offers three addable expressions on subdomains in advanced mode", async () => {
    global.browser.tabs.query.mockResolvedValue([
      { ...tabFixture, url: "https://sub.example.com/" },
    ]);
    const { getAllByText } = await renderApp({
      settings: settingsWith({ [SettingID.POPUP_ADVANCED]: true }),
    });
    expect(getAllByText("keepButtonText")).toHaveLength(3);
  });

  it("summarizes the last clean in the footer and opens settings from More controls", async () => {
    const closeSpy = jest.spyOn(window, "close").mockImplementation(() => {});
    const { getByText } = await renderApp({
      activityLog: [
        {
          dateTime: new Date(2026, 6, 6, 14, 32).toString(),
          recentlyCleaned: 2,
          siteDataCleaned: false,
          storeIds: { default: [{}, {}] as CleanReasonObject[] },
        } as ActivityLog,
      ],
    });
    expect(document.getElementById("lastCleanSummary")?.textContent).toContain(
      "lastCleanSummaryText[2|"
    );
    fireEvent.click(getByText("moreControlsText"));
    expect(global.browser.tabs.create).toHaveBeenCalledWith({
      index: 1,
      url: "/settings/settings.html#tabSettings",
    });
    expect(closeSpy).toHaveBeenCalled();
    closeSpy.mockRestore();
  });

  it("recounts the cookies when the port reports a cookie update", async () => {
    await renderApp();
    // The port is connected in an effect; on a slow runner it may not have
    // registered its listener yet when this test resumes.
    await waitFor(() =>
      expect(fakePort.onMessage.addListener).toHaveBeenCalled()
    );
    const listener = fakePort.onMessage.addListener.mock.calls[0][0] as (
      m: CookieCountMsg
    ) => void;
    global.browser.cookies.getAll.mockResolvedValue([
      { name: "session-cookie" },
      // The ADCP marker cookie is excluded from the visible count.
      { name: "ADCPBrowsingDataCleanup" },
    ]);
    listener({ cookieUpdated: true });
    await waitFor(() => {
      expect(
        (document.getElementById("siteCookieCount") as HTMLElement).textContent
      ).toBe("1");
    });
    expect(global.browser.cookies.getAll).toHaveBeenCalledWith(
      expect.objectContaining({ domain: "example.com" })
    );
  });
});
