/**
 * @jest-environment jsdom
 */
import * as React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore } from "redux";
import { initialState } from "@/redux/state";
import {
  clearCookiesForThisDomain,
  clearLocalStorageForThisDomain,
  clearSiteDataForThisDomain,
} from "@/services/cleanup-service";
import MoreCleaningOptions from "@/ui/popup/components/MoreCleaningOptions";

vi.mock("@/services/cleanup-service", () => ({
  clearCookiesForThisDomain: vi.fn().mockResolvedValue(true),
  clearLocalStorageForThisDomain: vi.fn().mockResolvedValue(true),
  clearSiteDataForThisDomain: vi.fn().mockResolvedValue(true),
}));

const tabFixture = {
  active: true,
  highlighted: false,
  id: 1,
  incognito: false,
  index: 0,
  pinned: false,
  url: "https://example.com/",
  windowId: 1,
} as browser.tabs.Tab;

describe("MoreCleaningOptions", () => {
  const renderOptions = (tab: browser.tabs.Tab = tabFixture) => {
    const store = createStore(() => initialState);
    const dispatchSpy = jest.spyOn(store, "dispatch");
    const utils = render(
      <Provider store={store}>
        <MoreCleaningOptions hostname="example.com" tab={tab} />
      </Provider>
    );
    return { ...utils, dispatchSpy };
  };

  beforeEach(() => {
    global.browser.i18n.getMessage.mockImplementation(
      (key: string, subs?: string[]) =>
        subs && subs.length ? `${key}[${subs.join("|")}]` : key
    );
  });

  it("offers the three scoped actions behind the disclosure", () => {
    const { getByText } = renderOptions();
    expect(getByText("moreCleaningOptionsText")).toBeTruthy();
    expect(getByText("cleanIncludeOpenTabsText")).toBeTruthy();
    expect(getByText("deleteSiteCookiesText")).toBeTruthy();
    expect(getByText("deleteSiteDataText")).toBeTruthy();
  });

  it("cleans including open tabs through the store", () => {
    const { dispatchSpy, getByText } = renderOptions();
    fireEvent.click(getByText("cleanIncludeOpenTabsText"));
    expect(dispatchSpy).toHaveBeenCalledWith({
      payload: { greyCleanup: false, ignoreOpenTabs: true },
      type: "COOKIE_CLEANUP",
    });
  });

  it("deletes the site's cookies through the cleanup service", async () => {
    const { getByText } = renderOptions();
    fireEvent.click(getByText("deleteSiteCookiesText"));
    await waitFor(() =>
      expect(clearCookiesForThisDomain).toHaveBeenCalledWith(
        expect.anything(),
        tabFixture
      )
    );
  });

  it("deletes everything the site stored across all services", async () => {
    const { getByText } = renderOptions();
    fireEvent.click(getByText("deleteSiteDataText"));
    await waitFor(() =>
      expect(clearSiteDataForThisDomain).toHaveBeenCalledWith(
        expect.anything(),
        "All",
        "example.com",
        // The tab fixture's URL carries no explicit port.
        ""
      )
    );
    expect(clearCookiesForThisDomain).toHaveBeenCalled();
    expect(clearLocalStorageForThisDomain).toHaveBeenCalled();
  });

  it("passes the tab URL's explicit port to the site-data cleanup", async () => {
    const { getByText } = renderOptions({
      ...tabFixture,
      url: "https://example.com:8443/",
    });
    fireEvent.click(getByText("deleteSiteDataText"));
    // browsingData removals are origin-scoped; without the port the
    // https://example.com:8443 storage would survive the wipe.
    await waitFor(() =>
      expect(clearSiteDataForThisDomain).toHaveBeenCalledWith(
        expect.anything(),
        "All",
        "example.com",
        "8443"
      )
    );
  });

  it("names the current site in the scoped tooltips", () => {
    const { getByText } = renderOptions();
    expect(getByText("deleteSiteCookiesText").getAttribute("title")).toBe(
      "deleteSiteCookiesTooltipText[example.com]"
    );
    expect(getByText("deleteSiteDataText").getAttribute("title")).toBe(
      "deleteSiteDataTooltipText[example.com]"
    );
  });
});
