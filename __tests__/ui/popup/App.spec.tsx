/**
 * @jest-environment jsdom
 */
import * as React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore } from "redux";
import { initialState } from "@/redux/state";
import { ListType, SettingID } from "@/typings/enums";
import fontAwesomeImports from "@/ui/font-awesome-imports";
import App from "@/ui/popup/App";

// Register the FontAwesome icons the popup entrypoint normally provides.
fontAwesomeImports();

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
    global.browser.i18n.getMessage.mockImplementation((key: string) => key);
    global.browser.runtime.getManifest.mockReturnValue({ version: "4.0.0" });
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

  it("renders the header, hostname and cookie count for the active tab", async () => {
    const { container, getAllByText } = await renderApp();
    const byId = (id: string) => document.getElementById(id) as HTMLElement;
    expect(byId("CADTitle").textContent).toBe("extensionName");
    expect(byId("CADVersion").textContent).toBe("4.0.0");
    expect(byId("CADCookieText").textContent).toBe("popupCookieCountText");
    expect(byId("CADCookieCount").textContent).toBe("0");
    expect(getAllByText("example.com").length).toBeGreaterThanOrEqual(1);
    // No favicon for this tab, and the empty activity log fallback shows.
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("noCleanupLogText");
  });

  it("sizes the popup from the default sizePopup setting", async () => {
    await renderApp();
    expect(document.documentElement.style.fontSize).toBe("16px");
    expect(document.documentElement.style.minWidth).toBe("640px");
  });

  it("scales the popup size with a larger sizePopup setting", async () => {
    await renderApp({
      settings: {
        ...initialState.settings,
        [SettingID.SIZE_POPUP]: { name: SettingID.SIZE_POPUP, value: 20 },
      },
    });
    expect(document.documentElement.style.fontSize).toBe("20px");
    expect(document.documentElement.style.minWidth).toBe("780px");
  });

  it("opens a long-lived port named after the hostname and store", async () => {
    await renderApp();
    expect(global.browser.runtime.connect).toHaveBeenCalledTimes(1);
    expect(global.browser.runtime.connect).toHaveBeenCalledWith({
      name: "popupADCP_example.com,default",
    });
    expect(fakePort.onMessage.addListener).toHaveBeenCalledTimes(1);
    expect(fakePort.onDisconnect.addListener).toHaveBeenCalledTimes(1);
  });

  it("disconnects the port when the popup unmounts", async () => {
    const { unmount } = await renderApp();
    expect(fakePort.disconnect).not.toHaveBeenCalled();
    unmount();
    expect(fakePort.disconnect).toHaveBeenCalledTimes(1);
  });

  it("dispatches a cookie cleanup and flashes the clean button group", async () => {
    const { dispatchSpy, getByText } = await renderApp();
    fireEvent.click(getByText("cleanText"));
    expect(dispatchSpy).toHaveBeenCalledWith({
      payload: { greyCleanup: false, ignoreOpenTabs: false },
      type: "COOKIE_CLEANUP",
    });
    const group = document.getElementById(
      "cleanButtonContainer"
    ) as HTMLElement;
    expect(group.classList.contains("successAnimated")).toBe(true);
  });

  it("toggles the activeMode setting from the power button", async () => {
    const { dispatchSpy, getByText } = await renderApp();
    const powerButton = getByText("autoDeleteDisabledText");
    expect(powerButton.className).toContain("btn-error");
    expect(powerButton.getAttribute("title")).toBe("enableAutoDeleteText");
    fireEvent.click(powerButton);
    expect(dispatchSpy).toHaveBeenCalledWith({
      payload: { name: "activeMode", value: true },
      type: "UPDATE_SETTING",
    });
  });

  it("shows the enabled labels when activeMode is on", async () => {
    const { getByText } = await renderApp({
      settings: {
        ...initialState.settings,
        [SettingID.ACTIVE_MODE]: { name: SettingID.ACTIVE_MODE, value: true },
      },
    });
    const powerButton = getByText("autoDeleteEnabledText");
    expect(powerButton.className).toContain("btn-success");
    expect(powerButton.getAttribute("title")).toBe("disableAutoDeleteText");
  });

  it("greylists and whitelists the addable hostnames", async () => {
    const { dispatchSpy, getAllByText } = await renderApp();
    const greyButtons = getAllByText("greyListWordText");
    const whiteButtons = getAllByText("whiteListWordText");
    expect(greyButtons).toHaveLength(2);
    expect(whiteButtons).toHaveLength(2);
    fireEvent.click(greyButtons[0]);
    expect(dispatchSpy).toHaveBeenCalledWith({
      payload: {
        expression: "example.com",
        listType: ListType.GREY,
        storeId: "default",
      },
      type: "ADD_EXPRESSION",
    });
    fireEvent.click(whiteButtons[1]);
    expect(dispatchSpy).toHaveBeenCalledWith({
      payload: {
        expression: "*.example.com",
        listType: ListType.WHITE,
        storeId: "default",
      },
      type: "ADD_EXPRESSION",
    });
  });

  it("also offers the wildcarded main domain on subdomains", async () => {
    global.browser.tabs.query.mockResolvedValue([
      { ...tabFixture, url: "https://sub.example.com/" },
    ]);
    const { getByText, getAllByText } = await renderApp();
    expect(getByText("*.example.com")).toBeTruthy();
    expect(getAllByText("sub.example.com")).toHaveLength(2);
    expect(getByText("*.sub.example.com")).toBeTruthy();
  });

  it("recounts the cookies when the port reports a cookie update", async () => {
    await renderApp();
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
        (document.getElementById("CADCookieCount") as HTMLElement).textContent
      ).toBe("1");
    });
    expect(global.browser.cookies.getAll).toHaveBeenCalledWith(
      expect.objectContaining({ domain: "example.com" })
    );
  });

  it("toggles the clean-options panel from the caret and closes it on outside clicks", async () => {
    await renderApp();
    // Hidden until the caret expands it (React state since #41; the
    // Bootstrap collapse plugin and its show class are gone).
    expect(document.getElementById("cleanCollapse")).toBeNull();

    const caret = document.getElementById("cleanOptionsToggle") as HTMLElement;
    fireEvent.click(caret);
    expect(document.getElementById("cleanCollapse")).not.toBeNull();
    expect(caret.getAttribute("aria-expanded")).toBe("true");

    // A second caret click collapses it again...
    fireEvent.click(caret);
    expect(document.getElementById("cleanCollapse")).toBeNull();

    // ...and any click outside the caret closes an open panel.
    fireEvent.click(caret);
    expect(document.getElementById("cleanCollapse")).not.toBeNull();
    fireEvent.click(document.getElementById("CADTitle") as HTMLElement);
    expect(document.getElementById("cleanCollapse")).toBeNull();
  });

  it("shows the tab favicon unless it comes from a chrome: url", async () => {
    global.browser.tabs.query.mockResolvedValue([
      { ...tabFixture, favIconUrl: "https://example.com/favicon.ico" },
    ]);
    const withFavicon = await renderApp();
    expect(withFavicon.getByAltText("favIcon")).toBeTruthy();
    withFavicon.unmount();

    global.browser.tabs.query.mockResolvedValue([
      { ...tabFixture, favIconUrl: "chrome://favicon/https://example.com" },
    ]);
    const chromeFavicon = await renderApp();
    expect(chromeFavicon.queryByAltText("favIcon")).toBeNull();
  });
});
