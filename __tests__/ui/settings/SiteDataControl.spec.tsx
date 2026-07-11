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
    // The wipe is opt-in since the Firefox port: the default-off state
    // shows the no-empty explainer, and switching it on flips the alert.
    const first = renderControl(initialState.settings);
    expect(first.getByRole("alert").textContent).toBe(
      "browsingDataNoEmptyWarning"
    );
    fireEvent.click(first.getByLabelText("siteDataEmptyOnEnable"));
    expect(first.onUpdateSetting).toHaveBeenCalledWith({
      name: SettingID.SITEDATA_EMPTY_ON_ENABLE,
      value: true,
    });
    // Unmount before the second render: duplicate role=alert nodes across
    // containers otherwise trip the scoped query via the shared document.
    first.unmount();
    const second = renderControl(
      settingsWith({ [SettingID.SITEDATA_EMPTY_ON_ENABLE]: true })
    );
    expect(second.getByRole("alert").textContent).toBe("browsingDataWarning");
  });

  describe("enable-time wipe confirmation", () => {
    const flagOnAllOff = (): State["settings"] =>
      settingsWith({
        ...Object.fromEntries(SITE_DATA_IDS.map((id) => [id, false])),
        [SettingID.SITEDATA_EMPTY_ON_ENABLE]: true,
      });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("asks for confirmation naming the affected types before a master enable", () => {
      const confirmSpy = vi
        .spyOn(window, "confirm")
        .mockImplementation(() => true);
      const { onUpdateSetting } = renderControl(flagOnAllOff());
      fireEvent.click(master());
      expect(confirmSpy).toHaveBeenCalledTimes(1);
      // The prompt carries the warning plus every type being enabled.
      const prompt = confirmSpy.mock.calls[0][0] as string;
      expect(prompt).toContain("browsingDataWarning");
      expect(prompt).toContain("indexedDBCleanupText");
      expect(prompt).toContain("serviceWorkersCleanupText");
      expect(onUpdateSetting).toHaveBeenCalledTimes(SITE_DATA_IDS.length);
    });

    it("dispatches nothing when the confirmation is declined", () => {
      vi.spyOn(window, "confirm").mockImplementation(() => false);
      const { onUpdateSetting } = renderControl(flagOnAllOff());
      fireEvent.click(master());
      expect(onUpdateSetting).not.toHaveBeenCalled();
    });

    it("confirms a single per-type enable with that type's name", () => {
      const confirmSpy = vi
        .spyOn(window, "confirm")
        .mockImplementation(() => true);
      const { getByLabelText, onUpdateSetting } = renderControl(flagOnAllOff());
      fireEvent.click(getByLabelText("indexedDBCleanupText"));
      expect(confirmSpy).toHaveBeenCalledTimes(1);
      expect(confirmSpy.mock.calls[0][0]).toContain("indexedDBCleanupText");
      expect(onUpdateSetting).toHaveBeenCalledWith({
        name: SettingID.CLEANUP_INDEXEDDB,
        value: true,
      });
    });

    it("never prompts while the wipe setting is off", () => {
      const confirmSpy = vi.spyOn(window, "confirm");
      const { onUpdateSetting } = renderControl(allOffSettings());
      fireEvent.click(master());
      expect(confirmSpy).not.toHaveBeenCalled();
      expect(onUpdateSetting).toHaveBeenCalledTimes(SITE_DATA_IDS.length);
    });

    it("never prompts when disabling", () => {
      const confirmSpy = vi.spyOn(window, "confirm");
      const allOnFlagOn = settingsWith({
        ...Object.fromEntries(SITE_DATA_IDS.map((id) => [id, true])),
        [SettingID.SITEDATA_EMPTY_ON_ENABLE]: true,
      });
      const { onUpdateSetting } = renderControl(allOnFlagOn);
      fireEvent.click(master());
      expect(confirmSpy).not.toHaveBeenCalled();
      expect(onUpdateSetting).toHaveBeenCalledTimes(SITE_DATA_IDS.length);
    });
  });
});
