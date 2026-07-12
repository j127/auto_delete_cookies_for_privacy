/**
 * @jest-environment jsdom
 */
import * as React from "react";
import { fireEvent, render } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore } from "redux";
import { initialState } from "@/redux/state";
import { SettingID } from "@/typings/enums";
import { ReduxConstants } from "@/typings/redux-constants";
import Settings from "@/ui/settings/components/Settings";

const withSettings = (overrides: { [setting: string]: Setting }): State => ({
  ...initialState,
  settings: { ...initialState.settings, ...overrides },
});

const advancedOn = withSettings({
  [SettingID.POPUP_ADVANCED]: {
    name: SettingID.POPUP_ADVANCED,
    value: true,
  },
});

describe("Settings", () => {
  const renderSettings = (state: State = initialState) => {
    const store = createStore(() => state);
    const dispatchSpy = jest.spyOn(store, "dispatch");
    return {
      dispatchSpy,
      ...render(
        <Provider store={store}>
          <Settings />
        </Provider>
      ),
    };
  };

  beforeEach(() => {
    global.browser.i18n.getMessage.mockImplementation((key: string) => key);
  });

  it("renders the heading and the three groups as bordered cards", () => {
    const { container, getByText, queryByText } = renderSettings();
    expect((container.querySelector("h1") as HTMLElement).textContent).toBe(
      "protectionText"
    );
    [
      "settingGroupAutoClean",
      "settingGroupSiteData",
      "settingGroupExtension",
    ].forEach((legend) => {
      const title = getByText(legend);
      expect(title.tagName).toBe("H2");
      const card = title.closest("section") as HTMLElement;
      expect(card.className).toContain("border-base-300");
      expect(card.querySelector(".divide-y")).not.toBeNull();
    });
    // The old expression-options info box is gone.
    expect(queryByText("settingGroupExpression")).toBeNull();
    expect(queryByText("groupExpressionDefaultNotice")).toBeNull();
  });

  it("shows descriptions under the labels and no external help links", () => {
    const { container, getByText } = renderSettings();
    getByText("activeModeDescText");
    getByText("gracePeriodDescText");
    getByText("domainChangeDescText");
    getByText("notifyAutoDescText");
    // The question-mark tooltip links are gone from the page entirely.
    expect(container.querySelector("a[href*='documentation']")).toBeNull();
    expect(container.querySelector(".tooltip")).toBeNull();
  });

  it("hides the advanced rows until Advanced mode is on", () => {
    const { queryByText } = renderSettings();
    // Advanced timing rows
    expect(queryByText(SettingID.ENABLE_GREYLIST)).toBeNull();
    expect(queryByText("cleanDiscardedText")).toBeNull();
    expect(queryByText("cookieCleanUpOnStartText")).toBeNull();
    expect(queryByText("cleanExpiredCookiesText")).toBeNull();
    // Advanced interface rows
    expect(queryByText("manualNotificationsText")).toBeNull();
    expect(queryByText("notifyCookieCleanupDelayText")).toBeNull();
    expect(queryByText("sizePopupText")).toBeNull();
    expect(queryByText(SettingID.DEBUG_MODE)).toBeNull();
  });

  it("reveals the advanced rows inside their groups when Advanced mode is on", () => {
    const { getByText } = renderSettings(advancedOn);
    // Timing group gains its advanced rows…
    const timingCard = getByText("settingGroupAutoClean").closest(
      "section"
    ) as HTMLElement;
    ["cleanDiscardedText", "cleanExpiredCookiesText"].forEach((key) => {
      expect(timingCard.textContent).toContain(key);
    });
    // …and Interface gains its own.
    const interfaceCard = getByText("settingGroupExtension").closest(
      "section"
    ) as HTMLElement;
    [
      "manualNotificationsText",
      "notifyCookieCleanupDelayText",
      "sizePopupText",
      "sizeSettingText",
      "enableContextMenus",
      SettingID.DEBUG_MODE,
    ].forEach((key) => {
      expect(interfaceCard.textContent).toContain(key);
    });
  });

  it("tints the Advanced mode gate row", () => {
    const { container } = renderSettings();
    const gate = container.querySelector(
      `#${SettingID.POPUP_ADVANCED}`
    ) as HTMLInputElement;
    const row = gate.closest(".bg-primary\\/5");
    expect(row).not.toBeNull();
  });

  it("renders a sample of setting rows from the store values", () => {
    const { container, getByText } = renderSettings(advancedOn);
    expect(getByText("activeModeText")).not.toBeNull();
    expect(getByText("cleanExpiredCookiesText")).not.toBeNull();
    expect(getByText("enableCleanupLogText")).not.toBeNull();
    // The grace-period input renders the numeric store value.
    const delay = container.querySelector(
      "#delayBeforeClean"
    ) as HTMLInputElement;
    expect(delay.value).toBe("15");
    // Selects render the numeric store value as the selected option.
    const duration = container.querySelector(
      `#${SettingID.NOTIFY_DURATION}`
    ) as HTMLSelectElement;
    expect(duration.value).toBe("3");
  });

  it("dispatches UPDATE_SETTING with the flipped value when a checkbox is toggled", () => {
    const { dispatchSpy, getByText } = renderSettings();
    fireEvent.click(getByText("activeModeText"));
    expect(dispatchSpy).toHaveBeenCalledWith({
      payload: { name: SettingID.ACTIVE_MODE, value: true },
      type: ReduxConstants.UPDATE_SETTING,
    });
  });

  it("dispatches UPDATE_SETTING for an in-range autoclean delay only", () => {
    const { container, dispatchSpy } = renderSettings();
    const delay = container.querySelector(
      "#delayBeforeClean"
    ) as HTMLInputElement;

    fireEvent.change(delay, { target: { value: "30" } });
    expect(dispatchSpy).toHaveBeenCalledWith({
      payload: { name: SettingID.CLEAN_DELAY, value: 30 },
      type: ReduxConstants.UPDATE_SETTING,
    });

    dispatchSpy.mockClear();
    fireEvent.change(delay, { target: { value: "0" } });
    expect(dispatchSpy).not.toHaveBeenCalled();
  });

  it("dispatches UPDATE_SETTING with the selected option when a select changes", () => {
    const { container, dispatchSpy } = renderSettings(advancedOn);
    const duration = container.querySelector(
      `#${SettingID.NOTIFY_DURATION}`
    ) as HTMLSelectElement;
    fireEvent.change(duration, { target: { value: "5" } });
    expect(dispatchSpy).toHaveBeenCalledWith({
      payload: { name: SettingID.NOTIFY_DURATION, value: "5" },
      type: ReduxConstants.UPDATE_SETTING,
    });
  });

  it("switches the site data warning between warning and danger styles", () => {
    // Two renders in one test duplicate element IDs across containers, and
    // jsdom's #id selector fast path resolves against the document — so the
    // assertions use the render-scoped RTL queries instead of querySelector.
    // The empty-on-enable wipe defaults OFF since the Firefox port, so the
    // default render shows the no-empty explainer.
    const first = renderSettings();
    const danger = first
      .getByText("browsingDataNoEmptyWarning")
      .closest(".alert") as HTMLElement;
    expect(danger.className).toContain("alert-error");

    const second = renderSettings(
      withSettings({
        [SettingID.SITEDATA_EMPTY_ON_ENABLE]: {
          name: SettingID.SITEDATA_EMPTY_ON_ENABLE,
          value: true,
        },
      })
    );
    const warning = second
      .getByText("browsingDataWarning")
      .closest(".alert") as HTMLElement;
    expect(warning.className).toContain("alert-warning");
  });

  it("only shows the keep default icon option while the icon count is enabled", () => {
    const keepIconLabel = `label[for="${SettingID.KEEP_DEFAULT_ICON}"]`;
    const { container } = renderSettings(advancedOn);
    expect(container.querySelector(keepIconLabel)).not.toBeNull();

    const { container: without } = renderSettings(
      withSettings({
        [SettingID.POPUP_ADVANCED]: {
          name: SettingID.POPUP_ADVANCED,
          value: true,
        },
        [SettingID.NUM_COOKIES_ICON]: {
          name: SettingID.NUM_COOKIES_ICON,
          value: false,
        },
      })
    );
    expect(without.querySelector(keepIconLabel)).toBeNull();
  });

  it("has no backup toolbar — export/import/reset live on the Import / Export page", () => {
    const { queryByText } = renderSettings();
    expect(queryByText("exportSettingsText")).toBeNull();
    expect(queryByText("importCoreSettingsText")).toBeNull();
    expect(queryByText("defaultSettingsText")).toBeNull();
  });

  it("renders without console errors", () => {
    renderSettings(advancedOn);
    expect(console.error).not.toHaveBeenCalled();
  });
});
