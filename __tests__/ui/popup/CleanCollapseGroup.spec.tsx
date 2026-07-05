/**
 * @jest-environment jsdom
 */
import * as React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore } from "redux";
import { initialState } from "../../../src/redux/state";
import CleanCollapseGroup from "../../../src/ui/popup/components/CleanCollapseGroup";

// Labels of every button in the group, in render order. The disabled
// cleanupActionsBypass button acts as a section separator.
const BUTTON_LABELS = [
  "cleanIgnoringOpenTabsText",
  "cleanupActionsBypass",
  "manualCleanSiteDataAll",
  "manualCleanSiteDataCache",
  "manualCleanSiteDataCookies",
  "manualCleanSiteDataIndexedDB",
  "manualCleanSiteDataLocalStorage",
  "manualCleanSiteDataPluginData",
  "manualCleanSiteDataServiceWorkers",
];

describe("CleanCollapseGroup", () => {
  const tab = {
    active: true,
    cookieStoreId: "0",
    highlighted: false,
    id: 1,
    incognito: false,
    index: 0,
    pinned: false,
    url: "https://example.com/",
    windowId: 1,
  } as browser.tabs.Tab;

  const renderGroup = () => {
    const store = createStore(() => initialState);
    const dispatchSpy = jest.spyOn(store, "dispatch");
    const utils = render(
      <Provider store={store}>
        <CleanCollapseGroup hostname="example.com" tab={tab} />
      </Provider>
    );
    return { ...utils, dispatchSpy };
  };

  beforeEach(() => {
    global.browser.i18n.getMessage.mockImplementation((key: string) => key);
    global.browser.runtime.getManifest.mockReturnValue({ version: "4.0.0" });
    // jsdom has no crypto.randomUUID implementation; the cleanup
    // notifications generate their ids through it.
    Object.defineProperty(globalThis.crypto, "randomUUID", {
      configurable: true,
      value: () => "test-uuid",
    });
  });

  it("renders as a collapsed bootstrap collapse group", () => {
    renderGroup();
    const group = document.getElementById("cleanCollapse") as HTMLElement;
    expect(group.classList.contains("collapse")).toBe(true);
    expect(group.classList.contains("show")).toBe(false);
    expect(group.getAttribute("role")).toBe("group");
  });

  it("renders without console errors", () => {
    renderGroup();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("renders every clean button with its i18n label in order", () => {
    const { getAllByRole } = renderGroup();
    const labels = getAllByRole("button").map((b) => b.textContent);
    expect(labels).toEqual(BUTTON_LABELS);
  });

  it("keeps the bypass separator button disabled", () => {
    const { getByText } = renderGroup();
    const bypass = getByText("cleanupActionsBypass") as HTMLButtonElement;
    expect(bypass.disabled).toBe(true);
    expect(bypass.getAttribute("aria-disabled")).toBe("true");
  });

  it("titles the domain buttons with the hostname substituted in", () => {
    const { getByText } = renderGroup();
    expect(getByText("cleanIgnoringOpenTabsText").getAttribute("title")).toBe(
      "cookieCleanupIgnoreOpenTabsText"
    );
    expect(getByText("manualCleanSiteDataCookies").getAttribute("title")).toBe(
      "manualCleanSiteDataCookiesDomain"
    );
    expect(global.browser.i18n.getMessage).toHaveBeenCalledWith(
      "manualCleanSiteDataCookiesDomain",
      ["example.com"]
    );
  });

  it("dispatches a cleanup that ignores open tabs from the first button", () => {
    const { dispatchSpy, getByText } = renderGroup();
    fireEvent.click(getByText("cleanIgnoringOpenTabsText"));
    expect(dispatchSpy).toHaveBeenCalledWith({
      payload: { greyCleanup: false, ignoreOpenTabs: true },
      type: "COOKIE_CLEANUP",
    });
  });

  it("clears cookies for the tab domain from the cookies button", async () => {
    global.browser.cookies.getAll.mockResolvedValue([]);
    const { getByText } = renderGroup();
    fireEvent.click(getByText("manualCleanSiteDataCookies"));
    await waitFor(() => {
      expect(global.browser.cookies.getAll).toHaveBeenCalledWith({
        domain: "example.com",
        storeId: "0",
      });
    });
  });
});
