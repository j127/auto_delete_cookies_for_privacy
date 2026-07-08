/**
 * @jest-environment jsdom
 */
import * as React from "react";
import { fireEvent, render } from "@testing-library/react";
import { initialState } from "@/redux/state";
import { SettingID } from "@/typings/enums";
import SiteDataControl from "@/ui/settings/components/SiteDataControl";

const SITE_DATA_IDS = [
  SettingID.CLEANUP_CACHE,
  SettingID.CLEANUP_INDEXEDDB,
  SettingID.CLEANUP_LOCALSTORAGE,
  SettingID.CLEANUP_PLUGINDATA,
  SettingID.CLEANUP_SERVICEWORKERS,
];

const settingsWith = (values: {
  [name: string]: boolean;
}): State["settings"] => {
  const next = { ...initialState.settings };
  Object.entries(values).forEach(([name, value]) => {
    next[name] = { name, value };
  });
  return next;
};

const allOffSettings = (): State["settings"] =>
  settingsWith(Object.fromEntries(SITE_DATA_IDS.map((id) => [id, false])));

describe("SiteDataControl", () => {
  const renderControl = (settings: State["settings"]) => {
    const onUpdateSetting = jest.fn();
    const utils = render(
      <SiteDataControl settings={settings} onUpdateSetting={onUpdateSetting} />
    );
    return { ...utils, onUpdateSetting };
  };

  const master = () =>
    document.getElementById("deleteAllSiteData") as HTMLInputElement;

  beforeEach(() => {
    global.browser.i18n.getMessage.mockImplementation((key: string) => key);
  });

  it("renders the master toggle checked with the new-install defaults", () => {
    // All five site-data types default on (src/redux/state.ts).
    renderControl(initialState.settings);
    expect(master().checked).toBe(true);
    expect(master().indeterminate).toBe(false);
  });

  it("renders the master toggle unchecked when every type is off", () => {
    renderControl(allOffSettings());
    expect(master().checked).toBe(false);
    expect(master().indeterminate).toBe(false);
  });

  it("turns every type on from the master toggle", () => {
    const { onUpdateSetting } = renderControl(allOffSettings());
    fireEvent.click(master());
    SITE_DATA_IDS.forEach((name) => {
      expect(onUpdateSetting).toHaveBeenCalledWith({ name, value: true });
    });
    expect(onUpdateSetting).toHaveBeenCalledTimes(SITE_DATA_IDS.length);
  });

  it("turns every type off from a checked master toggle", () => {
    const allOn = settingsWith(
      Object.fromEntries(SITE_DATA_IDS.map((id) => [id, true]))
    );
    const { onUpdateSetting } = renderControl(allOn);
    expect(master().checked).toBe(true);
    fireEvent.click(master());
    SITE_DATA_IDS.forEach((name) => {
      expect(onUpdateSetting).toHaveBeenCalledWith({ name, value: false });
    });
  });

  it("shows an indeterminate master with a Custom badge for a mixed selection", () => {
    // Four types on (the defaults) and one off.
    const mixed = settingsWith({ [SettingID.CLEANUP_CACHE]: false });
    const { getByText } = renderControl(mixed);
    expect(master().checked).toBe(false);
    expect(master().indeterminate).toBe(true);
    expect(getByText("customBadgeText")).toBeTruthy();
  });

  it("lists every per-type toggle inside the advanced accordion", () => {
    const { getByText } = renderControl(initialState.settings);
    expect(getByText("advancedChooseTypesText")).toBeTruthy();
    [
      "cacheCleanupText",
      "indexedDBCleanupText",
      "localStorageCleanupText",
      "pluginDataCleanupText",
      "serviceWorkersCleanupText",
      "siteDataEmptyOnEnable",
    ].forEach((key) => expect(getByText(key)).toBeTruthy());
  });

  it("keeps the empty-on-enable warning wired to its setting", () => {
    const { getByLabelText, getByRole, onUpdateSetting } = renderControl(
      initialState.settings
    );
    expect(getByRole("alert").textContent).toBe("browsingDataWarning");
    fireEvent.click(getByLabelText("siteDataEmptyOnEnable"));
    expect(onUpdateSetting).toHaveBeenCalledWith({
      name: SettingID.SITEDATA_EMPTY_ON_ENABLE,
      value: false,
    });
  });
});
