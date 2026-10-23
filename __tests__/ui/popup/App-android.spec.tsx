/**
 * @jest-environment jsdom
 */

/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */
import * as React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore } from "redux";
import { ReduxConstants } from "@/typings/redux-constants";
import { installAndroidFlavor } from "../../android-flavor";

vi.mock("@/services/cleanup-service", () => ({
  clearCookiesForThisDomain: vi.fn().mockResolvedValue(true),
  clearLocalStorageForThisDomain: vi.fn().mockResolvedValue(true),
  clearSiteDataForThisDomain: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/services/site-data-service", () => ({
  collectSiteData: vi.fn().mockResolvedValue({ available: false }),
}));

vi.stubGlobal("__BROWSER__", "firefox");
vi.resetModules();
installAndroidFlavor();
const { initialState } = await import("@/redux/state");
const { default: App } = await import("@/ui/popup/App");

// A Firefox for Android tab as MDN describes it, without cookieStoreId
// (Gecko's Android code does set one; this pins the fallback). There is no
// windows API (#534).
const androidTab = (incognito = false) => ({
  active: true,
  highlighted: false,
  id: 1,
  incognito,
  index: 0,
  pinned: false,
  url: "https://example.com/page",
  windowId: 1,
});

describe("popup App on Firefox for Android (#534)", () => {
  const renderApp = async () => {
    const store = createStore(() => initialState);
    const dispatchSpy = jest.spyOn(store, "dispatch");
    const utils = render(
      <Provider store={store}>
        <App />
      </Provider>
    );
    await waitFor(() =>
      expect(document.getElementById("cadPopup")).toBeTruthy()
    );
    return { ...utils, dispatchSpy };
  };

  const screenWidth = (width: number) =>
    vi.spyOn(window.screen, "width", "get").mockReturnValue(width);

  let fakePort: {
    name: string;
    onMessage: { addListener: jest.Mock };
    onDisconnect: { addListener: jest.Mock };
    postMessage: jest.Mock;
    disconnect: jest.Mock;
  };

  beforeEach(() => {
    global.browser.i18n.getMessage.mockImplementation((key: string) => key);
    global.browser.runtime.getManifest.mockReturnValue({ version: "1.0.0" });
    global.browser.tabs.query.mockResolvedValue([androidTab()]);
    global.browser.cookies.getAll.mockResolvedValue([]);
    global.browser.storage.session.get.mockResolvedValue({} as never);
    fakePort = {
      disconnect: jest.fn(),
      name: "popupADCP_x",
      onDisconnect: { addListener: jest.fn() },
      onMessage: { addListener: jest.fn() },
      postMessage: jest.fn(),
    };
    global.browser.runtime.connect.mockReturnValue(fakePort);
  });

  afterEach(() => vi.restoreAllMocks());

  it("fits a phone narrower than the 430px design frame", async () => {
    screenWidth(412);
    await renderApp();
    expect(document.documentElement.style.minWidth).toBe("412px");
  });

  it("keeps the 430px frame on a wide screen", async () => {
    screenWidth(1920);
    await renderApp();
    expect(document.documentElement.style.minWidth).toBe("430px");
  });

  it("reads cookies from Firefox's default store for a tab without cookieStoreId", async () => {
    await renderApp();
    // The count refresh runs on cookie-change pings over the port.
    await waitFor(() =>
      expect(fakePort.onMessage.addListener).toHaveBeenCalled()
    );
    const onPortMessage = fakePort.onMessage.addListener.mock.calls[0][0];
    await onPortMessage({ cookieUpdated: true });
    await waitFor(() =>
      expect(global.browser.cookies.getAll).toHaveBeenCalledWith(
        expect.objectContaining({ storeId: "firefox-default" })
      )
    );
    expect(global.browser.cookies.getAll).not.toHaveBeenCalledWith(
      expect.objectContaining({ storeId: "0" })
    );
  });

  // Since #537 the Private list is erased when the last private tab closes,
  // so the popup no longer says a rule kept here stays saved.
  it("keeps a site into the Private list from a private tab with no stays-saved note", async () => {
    global.browser.tabs.query.mockResolvedValue([androidTab(true)]);
    const { dispatchSpy, getByText } = await renderApp();
    await waitFor(() => getByText("keepCookiesButtonText"));
    expect(document.getElementById("keepStaysSavedNote")).toBeNull();
    // No normal window is ever seen on Android, so the desktop reading
    // ("Firefox never remembers history") must not be asked for.
    expect(global.browser.storage.session.get).not.toHaveBeenCalledWith(
      expect.objectContaining({ normalWindowSeen: false })
    );
    fireEvent.click(getByText("keepCookiesButtonText"));
    expect(dispatchSpy).toHaveBeenCalledWith({
      payload: expect.objectContaining({ storeId: "private" }),
      type: ReduxConstants.ADD_EXPRESSION,
    });
  });
});
