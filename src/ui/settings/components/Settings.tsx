/**
 * Copyright (c) 2017-2022 Kenny Do and CAD Team (https://github.com/Cookie-AutoDelete/Cookie-AutoDelete/graphs/contributors)
 * Licensed under MIT (https://github.com/Cookie-AutoDelete/Cookie-AutoDelete/blob/3.X.X-Branch/LICENSE)
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import { SettingID } from "@/typings/enums";
import * as React from "react";
import { useDispatch, useSelector } from "react-redux";
import { Dispatch } from "redux";
import { resetSettings, updateSetting } from "@/redux/actions";
import { initialState } from "@/redux/state";
import { adcpLog } from "@/services/libs";
import { ReduxAction } from "@/typings/redux-constants";
import CheckboxSetting from "@/ui/common-components/CheckboxSetting";
import IconButton from "@/ui/common-components/IconButton";
import SelectInput from "@/ui/common-components/SelectInput";
import { downloadObjectAsJSON } from "@/ui/ui-libs";
import SettingsTooltip from "./SettingsTooltip";

interface OwnProps {
  style?: React.CSSProperties;
}

/** One setting row: control on the left, doc link pinned to the right. */
const SettingRow: React.FunctionComponent<{ children: React.ReactNode }> = ({
  children,
}) => <div className="flex items-center justify-between gap-2">{children}</div>;

/** Card wrapper for a group of related settings (was a <fieldset>). */
const SettingGroup: React.FunctionComponent<{
  title: string;
  children: React.ReactNode;
}> = ({ title, children }) => (
  <section className="card mb-4 bg-base-200">
    <div className="card-body p-4 lg:p-6">
      <h2 className="mb-2 card-title text-base">{title}</h2>
      {children}
    </div>
  </section>
);

const Settings: React.FunctionComponent<OwnProps> = ({ style }) => {
  const settings = useSelector((state: State) => state.settings);
  const dispatch = useDispatch<Dispatch<ReduxAction>>();
  const [error, setErrorMessage] = React.useState("");
  const [success, setSuccess] = React.useState("");

  const onUpdateSetting = (newSetting: Setting) => {
    dispatch(updateSetting(newSetting));
  };

  const onResetButtonClick = () => {
    dispatch(resetSettings());
  };

  const setError = (e: Error): void => {
    setErrorMessage(e.toString());
    setSuccess("");
  };

  // Import Settings
  const importCoreSettings = (importFile: File) => {
    const debug = settings[SettingID.DEBUG_MODE].value as boolean;
    adcpLog(
      {
        msg: "Import Core Settings received file for parsing.",
        x: {
          name: importFile.name,
          size: importFile.size,
          type: importFile.type,
        },
      },
      debug
    );
    // Do check for import first!
    if (importFile.type !== "application/json") {
      setError(
        new Error(
          `${browser.i18n.getMessage("importFileTypeInvalid")}:  ${
            importFile.name
          } (${importFile.type})`
        )
      );
      return;
    }
    const initialSettingKeys = Object.keys(initialState.settings);
    const reader = new FileReader();
    reader.onload = (file) => {
      try {
        if (!file.target) {
          setError(
            new Error(
              browser.i18n.getMessage("importFileNotFound", [importFile.name])
            )
          );
          return;
        }
        // https://stackoverflow.com/questions/35789498/new-typescript-1-8-4-build-error-build-property-result-does-not-exist-on-t
        const target: FileReader = file.target;
        const result: string = target.result as string;
        const jsonImport: { [k: string]: Record<string, unknown> } =
          JSON.parse(result);
        if (!jsonImport.settings) {
          adcpLog(
            {
              msg: 'importCoreSettings:  Imported JSON does not have "settings" array',
              x: jsonImport,
            },
            debug
          );
          setError(
            new Error(
              `${browser.i18n.getMessage(
                "importFileValidationFailed"
              )}. ${browser.i18n.getMessage("importMissingKey")} 'settings': ${
                importFile.name
              }`
            )
          );
          return;
        }
        // from { name, value } to name:{ name, value }
        const newSettings: MapToSettingObject = (
          jsonImport.settings as unknown as Setting[]
        ).reduce((a: { [k: string]: Setting }, c: Setting) => {
          a[c.name] = c;
          return a;
        }, {});
        const settingKeys = Object.keys(newSettings);
        const unknownKeys = settingKeys.filter(
          (key) => !initialSettingKeys.includes(key)
        );
        if (unknownKeys.length > 0) {
          setError(
            new Error(
              `${browser.i18n.getMessage(
                "importCoreSettingsFailed"
              )}:  ${unknownKeys.join(", ")}`
            )
          );
          return;
        }
        settingKeys.forEach((setting) => {
          if (settings[setting].value !== newSettings[setting].value) {
            adcpLog(
              {
                msg: `Setting updated:  ${setting} (${settings[setting].value} => ${newSettings[setting].value})`,
              },
              debug
            );
            onUpdateSetting(newSettings[setting]);
          } else {
            adcpLog(
              {
                msg: `Setting remains unchanged:  ${setting} (${settings[setting].value})`,
              },
              debug
            );
          }
        });
        setErrorMessage("");
        setSuccess(browser.i18n.getMessage("importCoreSettingsText"));
      } catch (error: unknown) {
        if (error instanceof Error) {
          setErrorMessage(error.toString());
          setSuccess("");
        }
      }
    };

    reader.readAsText(importFile);
  };

  const exportCoreSettings = () => {
    // Convert from name:{name, value} to {name, value}
    const exportSettings: Setting[] = Object.values(settings);
    const r = downloadObjectAsJSON(
      { settings: exportSettings },
      "CoreSettings"
    );
    adcpLog(
      {
        msg: "exportCoreSettings: Core Settings Exported.",
        type: "info",
        x: r,
      },
      settings[SettingID.DEBUG_MODE].value as boolean
    );
    setErrorMessage("");
    setSuccess(
      `${browser.i18n.getMessage("exportSettingsText")}: ${r.downloadName}`
    );
  };

  return (
    <div style={style}>
      <h1 className="mb-4 text-2xl font-bold">
        {browser.i18n.getMessage("settingsText")}
      </h1>
      <div className="mb-4 flex flex-wrap gap-2">
        <IconButton
          className="btn-primary btn-sm"
          iconName="download"
          role="button"
          onClick={() => exportCoreSettings()}
          title={browser.i18n.getMessage("exportTitleTimestamp")}
          text={browser.i18n.getMessage("exportSettingsText")}
        />
        <IconButton
          tag="input"
          className="btn-info btn-sm"
          iconName="upload"
          type="file"
          accept="application/json, .json"
          onChange={(e) => importCoreSettings(e.target.files[0])}
          title={browser.i18n.getMessage("importCoreSettingsText")}
          text={browser.i18n.getMessage("importCoreSettingsText")}
        />
        <IconButton
          className="btn-error btn-sm"
          role="button"
          onClick={() => {
            onResetButtonClick();
            setErrorMessage("");
            setSuccess(browser.i18n.getMessage("defaultSettingsText"));
          }}
          iconName="undo"
          title={browser.i18n.getMessage("defaultSettingsText")}
          text={browser.i18n.getMessage("defaultSettingsText")}
        />
      </div>
      {error !== "" ? (
        <div
          onClick={() => setErrorMessage("")}
          className="mb-4 alert cursor-pointer whitespace-pre-wrap alert-error"
          role="alert"
        >
          {error}
        </div>
      ) : (
        ""
      )}
      {success !== "" ? (
        <div
          onClick={() => setSuccess("")}
          className="mb-4 alert cursor-pointer whitespace-pre-wrap alert-success"
          role="alert"
        >
          {browser.i18n.getMessage("successText")} {success}
        </div>
      ) : (
        ""
      )}

      <SettingGroup title={browser.i18n.getMessage("settingGroupAutoClean")}>
        <SettingRow>
          <CheckboxSetting
            text={browser.i18n.getMessage("activeModeText")}
            inline={true}
            settingObject={settings[SettingID.ACTIVE_MODE]}
            updateSetting={(payload) => onUpdateSetting(payload)}
          />
          <SettingsTooltip hrefURL={"settings.md#automatic-cleaning-options"} />
        </SettingRow>
        <SettingRow>
          <span className="inline-flex items-center gap-2 py-1">
            <input
              id="delayBeforeClean"
              type="number"
              className="input w-24 input-sm"
              onChange={(e) => {
                const eValue = Number.parseInt(e.target.value, 10);
                if (!Number.isNaN(eValue) && eValue >= 1 && eValue <= 2147483) {
                  onUpdateSetting({
                    name: SettingID.CLEAN_DELAY,
                    value: eValue,
                  });
                }
              }}
              value={settings[SettingID.CLEAN_DELAY].value as number}
              min="1"
              max="2147483"
            />
            <label htmlFor="delayBeforeClean">
              {browser.i18n.getMessage("secondsText")}{" "}
              {browser.i18n.getMessage("activeModeDelayText")}
            </label>
          </span>
          <SettingsTooltip hrefURL={"settings.md#automatic-cleaning-options"} />
        </SettingRow>
        <SettingRow>
          <CheckboxSetting
            text={browser.i18n.getMessage("cleanDiscardedText")}
            settingObject={settings[SettingID.CLEAN_DISCARDED]}
            inline={true}
            updateSetting={(payload) => onUpdateSetting(payload)}
          />
          <SettingsTooltip hrefURL={"settings.md#automatic-cleaning-options"} />
        </SettingRow>
        <SettingRow>
          <CheckboxSetting
            text={browser.i18n.getMessage("cleanupDomainChangeText")}
            settingObject={settings[SettingID.CLEAN_DOMAIN_CHANGE]}
            inline={true}
            updateSetting={(payload) => onUpdateSetting(payload)}
          />
          <SettingsTooltip hrefURL={"settings.md#automatic-cleaning-options"} />
        </SettingRow>
        <SettingRow>
          <CheckboxSetting
            text={browser.i18n.getMessage(SettingID.ENABLE_GREYLIST)}
            settingObject={settings[SettingID.ENABLE_GREYLIST]}
            inline={true}
            updateSetting={(payload) => onUpdateSetting(payload)}
          />
          <SettingsTooltip hrefURL={"settings.md#automatic-cleaning-options"} />
        </SettingRow>
        <SettingRow>
          <CheckboxSetting
            text={browser.i18n.getMessage("cookieCleanUpOnStartText")}
            settingObject={settings[SettingID.CLEAN_OPEN_TABS_STARTUP]}
            inline={true}
            updateSetting={(payload) => onUpdateSetting(payload)}
          />
          <SettingsTooltip hrefURL={"settings.md#automatic-cleaning-options"} />
        </SettingRow>
        <SettingRow>
          <CheckboxSetting
            settingObject={settings[SettingID.CLEAN_EXPIRED]}
            inline={true}
            text={browser.i18n.getMessage("cleanExpiredCookiesText")}
            updateSetting={(payload) => onUpdateSetting(payload)}
          />
          <SettingsTooltip hrefURL={"settings.md#automatic-cleaning-options"} />
        </SettingRow>
      </SettingGroup>
      <SettingGroup title={browser.i18n.getMessage("settingGroupExpression")}>
        <div className="alert alert-info" role="alert">
          <span>
            {browser.i18n.getMessage("groupExpressionDefaultNotice", [
              browser.i18n.getMessage("expressionListText"),
            ])}{" "}
            <SettingsTooltip hrefURL={"settings.md#expression-options"} />
          </span>
        </div>
      </SettingGroup>
      <SettingGroup
        title={browser.i18n.getMessage("settingGroupOtherBrowsing")}
      >
        <SettingRow>
          <CheckboxSetting
            text={browser.i18n.getMessage("siteDataEmptyOnEnable")}
            settingObject={settings[SettingID.SITEDATA_EMPTY_ON_ENABLE]}
            inline={true}
            updateSetting={(payload) => onUpdateSetting(payload)}
          />
          <SettingsTooltip
            hrefURL={"settings.md#other-browsing-data-cleanup-options"}
          />
        </SettingRow>
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
        <SettingRow>
          <CheckboxSetting
            text={browser.i18n.getMessage("cacheCleanupText")}
            settingObject={settings[SettingID.CLEANUP_CACHE]}
            inline={true}
            updateSetting={(payload) => onUpdateSetting(payload)}
          />
          <SettingsTooltip
            hrefURL={"settings.md#other-browsing-data-cleanup-options"}
          />
        </SettingRow>
        <SettingRow>
          <CheckboxSetting
            text={browser.i18n.getMessage("indexedDBCleanupText")}
            settingObject={settings[SettingID.CLEANUP_INDEXEDDB]}
            inline={true}
            updateSetting={(payload) => onUpdateSetting(payload)}
          />
          <SettingsTooltip
            hrefURL={"settings.md#other-browsing-data-cleanup-options"}
          />
        </SettingRow>
        <SettingRow>
          <CheckboxSetting
            text={browser.i18n.getMessage("localStorageCleanupText")}
            settingObject={settings[SettingID.CLEANUP_LOCALSTORAGE]}
            inline={true}
            updateSetting={(payload) => onUpdateSetting(payload)}
          />
          <SettingsTooltip
            hrefURL={"settings.md#other-browsing-data-cleanup-options"}
          />
        </SettingRow>
        <SettingRow>
          <CheckboxSetting
            text={browser.i18n.getMessage("pluginDataCleanupText")}
            settingObject={settings[SettingID.CLEANUP_PLUGINDATA]}
            inline={true}
            updateSetting={(payload) => onUpdateSetting(payload)}
          />
          <SettingsTooltip
            hrefURL={"settings.md#other-browsing-data-cleanup-options"}
          />
        </SettingRow>
        <SettingRow>
          <CheckboxSetting
            text={browser.i18n.getMessage("serviceWorkersCleanupText")}
            settingObject={settings[SettingID.CLEANUP_SERVICEWORKERS]}
            inline={true}
            updateSetting={(payload) => onUpdateSetting(payload)}
          />
          <SettingsTooltip
            hrefURL={"settings.md#other-browsing-data-cleanup-options"}
          />
        </SettingRow>
      </SettingGroup>
      <SettingGroup title={browser.i18n.getMessage("settingGroupExtension")}>
        <SettingRow>
          <CheckboxSetting
            text={browser.i18n.getMessage("enableCleanupLogText")}
            settingObject={settings[SettingID.STAT_LOGGING]}
            inline={true}
            updateSetting={(payload) => onUpdateSetting(payload)}
          />
          <SettingsTooltip hrefURL={"settings.md#extension-options"} />
        </SettingRow>
        {settings[SettingID.STAT_LOGGING].value && (
          <div className="mb-2 alert alert-warning" role="alert">
            {browser.i18n.getMessage("noPrivateLogging")}
          </div>
        )}
        <SettingRow>
          <CheckboxSetting
            text={browser.i18n.getMessage("showNumberOfCookiesInIconText")}
            settingObject={settings[SettingID.NUM_COOKIES_ICON]}
            inline={true}
            updateSetting={(payload) => onUpdateSetting(payload)}
          />
          <SettingsTooltip hrefURL={"settings.md#extension-options"} />
        </SettingRow>
        {settings[SettingID.NUM_COOKIES_ICON].value === true && (
          <SettingRow>
            <CheckboxSetting
              text={browser.i18n.getMessage(SettingID.KEEP_DEFAULT_ICON)}
              settingObject={settings[SettingID.KEEP_DEFAULT_ICON]}
              inline={true}
              updateSetting={(payload) => onUpdateSetting(payload)}
            />
            <SettingsTooltip hrefURL={"settings.md#extension-options"} />
          </SettingRow>
        )}
        <SettingRow>
          <CheckboxSetting
            text={browser.i18n.getMessage("notifyCookieCleanUpText")}
            settingObject={settings[SettingID.NOTIFY_AUTO]}
            inline={true}
            updateSetting={(payload) => onUpdateSetting(payload)}
          />
          <SettingsTooltip hrefURL={"settings.md#extension-options"} />
        </SettingRow>
        <SettingRow>
          <CheckboxSetting
            inline={true}
            settingObject={settings[SettingID.NOTIFY_MANUAL]}
            text={browser.i18n.getMessage("manualNotificationsText")}
            updateSetting={(payload) => onUpdateSetting(payload)}
          />
          <SettingsTooltip hrefURL={"settings.md#extension-options"} />
        </SettingRow>
        <SettingRow>
          <CheckboxSetting
            inline={true}
            settingObject={
              settings[SettingID.POPUP_ADVANCED] ?? {
                name: SettingID.POPUP_ADVANCED,
                value: false,
              }
            }
            text={browser.i18n.getMessage("showAdvancedPopupText")}
            updateSetting={(payload) => onUpdateSetting(payload)}
          />
          <SettingsTooltip hrefURL={"settings.md#extension-options"} />
        </SettingRow>
        <div className="mb-2 ps-12 text-sm text-base-content/70">
          {browser.i18n.getMessage("showAdvancedPopupDescText")}
        </div>
        <SettingRow>
          <SelectInput
            numSize={9}
            numStart={1}
            settingObject={settings[SettingID.NOTIFY_DURATION]}
            text={`${browser.i18n.getMessage(
              "secondsText"
            )} ${browser.i18n.getMessage("notifyCookieCleanupDelayText")}`}
            updateSetting={(payload) => {
              onUpdateSetting(payload);
            }}
          />
          <SettingsTooltip hrefURL={"settings.md#extension-options"} />
        </SettingRow>
        <SettingRow>
          <CheckboxSetting
            text={browser.i18n.getMessage(SettingID.ENABLE_NEW_POPUP)}
            settingObject={settings[SettingID.ENABLE_NEW_POPUP]}
            inline={true}
            updateSetting={(payload) => onUpdateSetting(payload)}
          />
          <SettingsTooltip hrefURL={"settings.md#extension-options"} />
        </SettingRow>
        <SettingRow>
          <SelectInput
            numSize={14}
            numStart={10}
            settingObject={settings[SettingID.SIZE_POPUP]}
            text={browser.i18n.getMessage("sizePopupText")}
            updateSetting={(payload) => onUpdateSetting(payload)}
          />
          <SettingsTooltip hrefURL={"settings.md#extension-options"} />
        </SettingRow>
        <SettingRow>
          <SelectInput
            numSize={14}
            numStart={10}
            settingObject={settings[SettingID.SIZE_SETTING]}
            text={browser.i18n.getMessage("sizeSettingText")}
            updateSetting={(payload) => {
              onUpdateSetting(payload);
            }}
          />
          <SettingsTooltip hrefURL={"settings.md#extension-options"} />
        </SettingRow>
        <SettingRow>
          <CheckboxSetting
            text={browser.i18n.getMessage("enableContextMenus")}
            settingObject={settings[SettingID.CONTEXT_MENUS]}
            inline={true}
            updateSetting={(payload) => onUpdateSetting(payload)}
          />
          <SettingsTooltip hrefURL={"settings.md#extension-options"} />
        </SettingRow>
        <SettingRow>
          <CheckboxSetting
            text={browser.i18n.getMessage(SettingID.DEBUG_MODE)}
            settingObject={settings[SettingID.DEBUG_MODE]}
            inline={true}
            updateSetting={(payload) => onUpdateSetting(payload)}
          />
          <SettingsTooltip hrefURL={"settings.md#extension-options"} />
        </SettingRow>
        {settings[SettingID.DEBUG_MODE].value && (
          <div className="alert block alert-info" role="alert">
            <p>{browser.i18n.getMessage("openDebugMode")}</p>
            <pre className="my-2">
              <b>
                {`chrome://extensions/?id=`}
                {encodeURIComponent(browser.runtime.id)}
              </b>
            </pre>
            <p>{browser.i18n.getMessage("chromeDebugMode")}</p>
            <p>
              {browser.i18n.getMessage("consoleDebugMode")}.{" "}
              {browser.i18n.getMessage("filterDebugMode")}
            </p>
            <p>
              <b>CAD_</b>
            </p>
          </div>
        )}
      </SettingGroup>
    </div>
  );
};

export default Settings;
