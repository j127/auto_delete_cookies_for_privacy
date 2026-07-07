/**
 * @jest-environment jsdom
 */
import * as React from "react";
import { fireEvent, render } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore } from "redux";
import { initialState } from "@/redux/state";
import PopupFooter from "@/ui/popup/components/PopupFooter";

describe("PopupFooter", () => {
  const renderFooter = (activityLog: ActivityLog[] = []) => {
    const store = createStore(() => ({ ...initialState, activityLog }));
    return render(
      <Provider store={store}>
        <PopupFooter tabIndex={3} />
      </Provider>
    );
  };

  beforeEach(() => {
    global.browser.i18n.getMessage.mockImplementation(
      (key: string, subs?: string[]) =>
        subs && subs.length ? `${key}[${subs.join("|")}]` : key
    );
  });

  it("hides the summary when nothing has been cleaned yet", () => {
    renderFooter();
    expect(document.getElementById("lastCleanSummary")).toBeNull();
  });

  it("summarizes the most recent clean with its cookie count", () => {
    renderFooter([
      {
        dateTime: new Date(2026, 6, 6, 9, 5).toString(),
        recentlyCleaned: 3,
        siteDataCleaned: false,
        storeIds: { default: [{}, {}, {}] as CleanReasonObject[] },
      } as ActivityLog,
    ]);
    expect(document.getElementById("lastCleanSummary")?.textContent).toContain(
      "lastCleanSummaryText[3|"
    );
  });

  it("opens the settings page next to the current tab from More controls", () => {
    const closeSpy = jest.spyOn(window, "close").mockImplementation(() => {});
    const { getByText } = renderFooter();
    fireEvent.click(getByText("moreControlsText"));
    expect(global.browser.tabs.create).toHaveBeenCalledWith({
      index: 4,
      url: "/settings/settings.html#tabSettings",
    });
    expect(closeSpy).toHaveBeenCalled();
    closeSpy.mockRestore();
  });
});
