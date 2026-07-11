/**
 * @jest-environment jsdom
 */

/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2017-2022 Kenny Do and CAD Team; fork changes (c) 2026 j127.
 * Licensed under MIT (see LICENSE).
 */
import * as React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore } from "redux";
import { when } from "jest-when";
import { SettingID } from "@/typings/enums";
import { ReduxConstants } from "@/typings/redux-constants";

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
const { initialState } = await import("@/redux/state");
const { default: App } = await import("@/ui/popup/App");

const containerTab = {
  active: true,
  cookieStoreId: "firefox-container-7",
  highlighted: false,
  id: 1,
  incognito: false,
  index: 0,
  pinned: false,
  url: "https://work.example/dashboard",
  windowId: 1,
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

describe("popup App in a Firefox container tab", () => {
  let fakePort: {
    name: string;
    onMessage: { addListener: jest.Mock };
    onDisconnect: { addListener: jest.Mock };
    postMessage: jest.Mock;
    disconnect: jest.Mock;
  };

  const renderApp = async (stateOverrides: Partial<State> = {}) => {
    const store = createStore(() => ({ ...initialState, ...stateOverrides }));
    const dispatchSpy = jest.spyOn(store, "dispatch");
    const utils = render(
      <Provider store={store}>
        <App />
      </Provider>
    );
    await waitFor(() =>
      expect(document.getElementById("cadPopup")).toBeTruthy()
    );
    return { ...utils, dispatchSpy, store };
  };

  beforeEach(() => {
    global.browser.i18n.getMessage.mockImplementation((key: string) => key);
    global.browser.runtime.getManifest.mockReturnValue({ version: "1.0.0" });
    global.browser.tabs.query.mockResolvedValue([containerTab]);
    global.browser.cookies.getAll.mockResolvedValue([]);
    when(global.browser.storage.session.get)
      .calledWith({ containerCache: {} })
      .mockResolvedValue({
        containerCache: {
          "firefox-container-7": { color: "orange", name: "Work" },
        },
      } as never);
    fakePort = {
      name: "popupADCP_x",
      onMessage: { addListener: jest.fn() },
      onDisconnect: { addListener: jest.fn() },
      postMessage: jest.fn(),
      disconnect: jest.fn(),
    };
    global.browser.runtime.connect.mockReturnValue(fakePort);
  });

  it("shows the container name next to the hostname", async () => {
    await renderApp();
    await waitFor(() => {
      const badge = document.getElementById("containerBadge");
      expect(badge?.textContent).toBe("Work");
    });
  });

  it("adds a Keep rule into the container's own list while the setting is on", async () => {
    const { dispatchSpy, getByText } = await renderApp({
      settings: settingsWith({
        [SettingID.CONTEXTUAL_IDENTITIES]: true,
      }),
    });
    fireEvent.click(getByText("keepCookiesButtonText"));
    expect(dispatchSpy).toHaveBeenCalledWith({
      payload: expect.objectContaining({
        storeId: "firefox-container-7",
      }),
      type: ReduxConstants.ADD_EXPRESSION,
    });
  });

  it("adds a Keep rule into the default list while the setting is off", async () => {
    // Containers are governed by the default list when per-container
    // lists are off — the rule must land where cleanup actually reads.
    const { dispatchSpy, getByText } = await renderApp();
    fireEvent.click(getByText("keepCookiesButtonText"));
    expect(dispatchSpy).toHaveBeenCalledWith({
      payload: expect.objectContaining({ storeId: "default" }),
      type: ReduxConstants.ADD_EXPRESSION,
    });
  });

  it("scopes the cookie count to the tab's own store", async () => {
    await renderApp();
    // The count refresh runs on cookie-change pings over the port.
    await waitFor(() =>
      expect(fakePort.onMessage.addListener).toHaveBeenCalled()
    );
    const onPortMessage = fakePort.onMessage.addListener.mock.calls[0][0];
    await onPortMessage({ cookieUpdated: true });
    await waitFor(() => {
      expect(global.browser.cookies.getAll).toHaveBeenCalledWith(
        expect.objectContaining({ storeId: "firefox-container-7" })
      );
    });
    for (const call of global.browser.cookies.getAll.mock.calls) {
      expect(call[0].storeId).toBe("firefox-container-7");
    }
  });
});
