/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */
import { SettingID } from "@/typings/enums";
import * as React from "react";
import { browserCapabilities } from "@/services/browser-capabilities";
import CheckboxSetting from "@/ui/common-components/CheckboxSetting";

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
  // Firefox cannot scope cache removal to hosts, so per-domain cache
  // cleanup does not exist there: the toggle is hidden on that build and
  // the cleanup pipeline skips the type (browser-capabilities
  // cacheHostScopable).
  ...(browserCapabilities.cacheHostScopable
    ? [{ id: SettingID.CLEANUP_CACHE, textKey: "cacheCleanupText" }]
    : []),
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

  /**
   * While the empty-on-enable setting is on, switching a site-data type
   * on triggers SettingService's since-zero wipe — a global, whitelist-
   * ignoring erase of that whole data type. So every enable that would
   * wipe must be confirmed, naming the affected types (audit bug 14:
   * upstream ran this silently). Disables never wipe and never prompt.
   */
  const confirmEnableWipe = (ids: SettingID[]): boolean => {
    if (settings[SettingID.SITEDATA_EMPTY_ON_ENABLE].value !== true) {
      return true;
    }
    const enabling = SITE_DATA_SETTINGS.filter(
      ({ id }) => ids.includes(id) && !settings[id].value
    );
    if (enabling.length === 0) return true;
    const typeNames = enabling
      .map(({ textKey }) => browser.i18n.getMessage(textKey))
      .join(", ");
    return window.confirm(
      `${browser.i18n.getMessage("browsingDataWarning")}\n\n${typeNames}`
    );
  };

  const onMasterToggle = () => {
    const target = !allOn;
    if (target && !confirmEnableWipe(SITE_DATA_SETTINGS.map(({ id }) => id))) {
      return;
    }
    SITE_DATA_SETTINGS.forEach(({ id }) => {
      onUpdateSetting({ name: id, value: target });
    });
  };

  const onTypeToggle = (payload: Setting) => {
    if (
      payload.value === true &&
      !confirmEnableWipe([payload.name as SettingID])
    ) {
      return;
    }
    onUpdateSetting(payload);
  };

  return (
    <div id="siteDataControl" className="px-4 py-2.5">
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
            {/* Behavior genuinely differs on Firefox: cache cannot be
                cleared per site there, so the type is excluded and the
                help text says so. */}
            {!browserCapabilities.cacheHostScopable && (
              <> {browser.i18n.getMessage("siteDataCacheFirefoxNoteText")}</>
            )}
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
              updateSetting={(payload) => onTypeToggle(payload)}
            />
          ))}
        </div>
      </details>
    </div>
  );
};

export default SiteDataControl;
