/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */
import { SettingID } from "@/typings/enums";
import * as React from "react";
import CheckboxSetting from "@/ui/common-components/CheckboxSetting";
import SettingsTooltip from "./SettingsTooltip";

interface OwnProps {
  settings: State["settings"];
  onUpdateSetting: (payload: Setting) => void;
}

/**
 * The per-type site-data settings behind one plain-language master toggle
 * (05d design, the user's simple-by-default pattern). The master drives all
 * five type toggles; a mixed selection renders the master as indeterminate
 * with a Custom badge. The per-type toggles live in an Advanced accordion.
 */
const SITE_DATA_SETTINGS: { id: SettingID; textKey: string }[] = [
  { id: SettingID.CLEANUP_CACHE, textKey: "cacheCleanupText" },
  { id: SettingID.CLEANUP_INDEXEDDB, textKey: "indexedDBCleanupText" },
  { id: SettingID.CLEANUP_LOCALSTORAGE, textKey: "localStorageCleanupText" },
  { id: SettingID.CLEANUP_PLUGINDATA, textKey: "pluginDataCleanupText" },
  {
    id: SettingID.CLEANUP_SERVICEWORKERS,
    textKey: "serviceWorkersCleanupText",
  },
];

const SiteDataControl: React.FunctionComponent<OwnProps> = ({
  settings,
  onUpdateSetting,
}) => {
  const values = SITE_DATA_SETTINGS.map(({ id }) =>
    Boolean(settings[id].value)
  );
  const allOn = values.every(Boolean);
  const mixed = !allOn && values.some(Boolean);

  const masterRef = React.useRef<HTMLInputElement | null>(null);
  React.useEffect(() => {
    if (masterRef.current) {
      masterRef.current.indeterminate = mixed;
    }
  }, [mixed]);

  const onMasterToggle = () => {
    const target = !allOn;
    SITE_DATA_SETTINGS.forEach(({ id }) => {
      onUpdateSetting({ name: id, value: target });
    });
  };

  return (
    <div id="siteDataControl">
      <label
        className="flex cursor-pointer items-center gap-3 py-1"
        htmlFor="deleteAllSiteData"
      >
        <span className="min-w-0 flex-1">
          <span className="font-semibold">
            {browser.i18n.getMessage("deleteAllSiteDataText")}
          </span>
          {mixed && (
            <span className="ms-2 badge badge-sm badge-info">
              {browser.i18n.getMessage("customBadgeText")}
            </span>
          )}
          <span className="block text-sm text-base-content/70">
            {browser.i18n.getMessage("deleteAllSiteDataDescText")}
          </span>
        </span>
        <input
          checked={allOn}
          className="toggle flex-none toggle-primary"
          id="deleteAllSiteData"
          onChange={onMasterToggle}
          ref={masterRef}
          type="checkbox"
        />
        <SettingsTooltip
          hrefURL={"settings.md#other-browsing-data-cleanup-options"}
        />
      </label>
      <details className="collapse-arrow collapse mt-2 border border-base-300">
        <summary
          className="collapse-title min-h-0 py-2 text-sm font-semibold text-primary"
          id="siteDataAdvanced"
        >
          {browser.i18n.getMessage("advancedChooseTypesText")}
        </summary>
        <div className="collapse-content">
          <CheckboxSetting
            text={browser.i18n.getMessage("siteDataEmptyOnEnable")}
            settingObject={settings[SettingID.SITEDATA_EMPTY_ON_ENABLE]}
            updateSetting={(payload) => onUpdateSetting(payload)}
          />
          <div
            className={`mb-2 alert ${
              settings[SettingID.SITEDATA_EMPTY_ON_ENABLE].value === true
                ? "alert-warning"
                : "alert-error"
            }`}
            role="alert"
          >
            {browser.i18n.getMessage(
              `browsingData${
                settings[SettingID.SITEDATA_EMPTY_ON_ENABLE].value === true
                  ? ""
                  : "NoEmpty"
              }Warning`
            )}
          </div>
          {SITE_DATA_SETTINGS.map(({ id, textKey }) => (
            <CheckboxSetting
              key={id}
              text={browser.i18n.getMessage(textKey)}
              settingObject={settings[id]}
              updateSetting={(payload) => onUpdateSetting(payload)}
            />
          ))}
        </div>
      </details>
    </div>
  );
};

export default SiteDataControl;
