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
import fontAwesomeImports from "@/ui/font-awesome-imports";
import Settings from "@/ui/settings/components/Settings";

// Register the FontAwesome icons the settings entrypoint normally provides.
fontAwesomeImports();

const withSettings = (overrides: { [setting: string]: Setting }): State => ({
  ...initialState,
  settings: { ...initialState.settings, ...overrides },
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

  it("renders the heading and every settings group", () => {
    const { container, getByText } = renderSettings();
    expect((container.querySelector("h1") as HTMLElement).textContent).toBe(
      "settingsText"
    );
    // Groups render as card titles since the #40 DaisyUI rebuild.
    [
      "settingGroupAutoClean",
      "settingGroupExpression",
      "settingGroupOtherBrowsing",
      "settingGroupExtension",
    ].forEach((legend) => {
      expect(getByText(legend).tagName).toBe("H2");
    });
  });

  it("renders a sample of setting rows from the store values", () => {
    const { container, getByText } = renderSettings();
    // Checkbox rows are labelled with their i18n keys.
    expect(getByText("activeModeText")).not.toBeNull();
    expect(getByText("cleanExpiredCookiesText")).not.toBeNull();
    expect(getByText("enableCleanupLogText")).not.toBeNull();
    // The autoclean delay renders the numeric store value.
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
    const { container, dispatchSpy } = renderSettings();
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
    const { container } = renderSettings();
    const warning = container.querySelector(".alert-warning") as HTMLElement;
    expect(warning.textContent).toBe("browsingDataWarning");

    const { container: unchecked } = renderSettings(
      withSettings({
        [SettingID.SITEDATA_EMPTY_ON_ENABLE]: {
          name: SettingID.SITEDATA_EMPTY_ON_ENABLE,
          value: false,
        },
      })
    );
    const danger = unchecked.querySelector(".alert-error.alert") as HTMLElement;
    expect(danger.textContent).toBe("browsingDataNoEmptyWarning");
  });

  it("only shows the keep default icon option while the icon count is enabled", () => {
    const keepIconLabel = `label[for="${SettingID.KEEP_DEFAULT_ICON}"]`;
    const { container } = renderSettings();
    expect(container.querySelector(keepIconLabel)).not.toBeNull();

    const { container: without } = renderSettings(
      withSettings({
        [SettingID.NUM_COOKIES_ICON]: {
          name: SettingID.NUM_COOKIES_ICON,
          value: false,
        },
      })
    );
    expect(without.querySelector(keepIconLabel)).toBeNull();
  });

  it("dispatches RESET_SETTINGS and shows a success alert on reset to defaults", () => {
    const { container, dispatchSpy, getByText } = renderSettings();
    fireEvent.click(getByText("defaultSettingsText"));
    expect(dispatchSpy).toHaveBeenCalledWith({
      type: ReduxConstants.RESET_SETTINGS,
    });
    const success = container.querySelector(".alert-success") as HTMLElement;
    expect(success.textContent).toBe("successText defaultSettingsText");
  });

  it("renders without console errors", () => {
    renderSettings();
    expect(console.error).not.toHaveBeenCalled();
  });
});
