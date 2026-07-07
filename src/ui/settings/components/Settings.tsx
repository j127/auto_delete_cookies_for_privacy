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
import { updateSetting } from "@/redux/actions";
import { ReduxAction } from "@/typings/redux-constants";
import CheckboxSetting from "@/ui/common-components/CheckboxSetting";
import SelectInput from "@/ui/common-components/SelectInput";
import SiteDataControl from "./SiteDataControl";

interface OwnProps {
  style?: React.CSSProperties;
}

/**
 * One setting row (05d layout): text at the start, the control at the end.
 * `highlight` tints the row with the accent — used for the Advanced mode
 * gate so it stands out as the row that changes the page itself.
 */
const SettingRow: React.FunctionComponent<{
  children: React.ReactNode;
  highlight?: boolean;
}> = ({ children, highlight }) => (
  <div
    className={`flex items-center gap-2 px-4 py-2.5 ${
      highlight ? "bg-primary/5" : ""
    }`}
  >
    {children}
  </div>
);

/**
 * Card wrapper for a group of related settings (was a <fieldset>): bordered
 * surface with the title on top and hairline dividers between rows, per the
 * 05d mockup.
 */
const SettingGroup: React.FunctionComponent<{
  title: string;
  children: React.ReactNode;
}> = ({ title, children }) => (
  <section className="mb-4 overflow-hidden rounded-box border border-base-300 bg-base-100">
    <h2 className="border-b border-base-300 px-4 py-3 text-base font-semibold">
      {title}
    </h2>
    <div className="divide-y divide-base-300">{children}</div>
  </section>
);

const Settings: React.FunctionComponent<OwnProps> = ({ style }) => {
  const settings = useSelector((state: State) => state.settings);
  const dispatch = useDispatch<Dispatch<ReduxAction>>();

  const onUpdateSetting = (newSetting: Setting) => {
    dispatch(updateSetting(newSetting));
  };

  // The single global gate: the same stored setting reveals the popup's
  // extra controls and the advanced rows on this page.
  const advancedMode = !!settings[SettingID.POPUP_ADVANCED]?.value;

  return (
    <div style={style}>
      <h1 className="mb-4 text-2xl font-bold">
        {browser.i18n.getMessage("protectionText")}
      </h1>

      <SettingGroup title={browser.i18n.getMessage("settingGroupAutoClean")}>
        <SettingRow>
          <CheckboxSetting
            text={browser.i18n.getMessage("activeModeText")}
            description={browser.i18n.getMessage("activeModeDescText")}
            settingObject={settings[SettingID.ACTIVE_MODE]}
            updateSetting={(payload) => onUpdateSetting(payload)}
          />
        </SettingRow>
        <SettingRow>
          <label className="min-w-0 flex-1" htmlFor="delayBeforeClean">
            <span className="font-semibold">
              {browser.i18n.getMessage("activeModeDelayText")}
            </span>
            <span className="block text-sm text-base-content/70">
              {browser.i18n.getMessage("gracePeriodDescText")}
            </span>
          </label>
          <input
            id="delayBeforeClean"
            type="number"
            className="input w-20 flex-none input-sm"
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
          <span className="flex-none text-sm text-base-content/70">
            {browser.i18n.getMessage("secondsText")}
          </span>
        </SettingRow>
        <SettingRow>
          <CheckboxSetting
            text={browser.i18n.getMessage("cleanupDomainChangeText")}
            description={browser.i18n.getMessage("domainChangeDescText")}
            settingObject={settings[SettingID.CLEAN_DOMAIN_CHANGE]}
            updateSetting={(payload) => onUpdateSetting(payload)}
          />
        </SettingRow>
        {advancedMode && (
          <>
            <SettingRow>
              <CheckboxSetting
                text={browser.i18n.getMessage(SettingID.ENABLE_GREYLIST)}
                description={browser.i18n.getMessage("greylistDescText")}
                settingObject={settings[SettingID.ENABLE_GREYLIST]}
                updateSetting={(payload) => onUpdateSetting(payload)}
              />
            </SettingRow>
            <SettingRow>
              <CheckboxSetting
                text={browser.i18n.getMessage("cleanDiscardedText")}
                description={browser.i18n.getMessage("cleanDiscardedDescText")}
                settingObject={settings[SettingID.CLEAN_DISCARDED]}
                updateSetting={(payload) => onUpdateSetting(payload)}
              />
            </SettingRow>
            <SettingRow>
              <CheckboxSetting
                text={browser.i18n.getMessage("cookieCleanUpOnStartText")}
                description={browser.i18n.getMessage("startupCleanDescText")}
                settingObject={settings[SettingID.CLEAN_OPEN_TABS_STARTUP]}
                updateSetting={(payload) => onUpdateSetting(payload)}
              />
            </SettingRow>
            <SettingRow>
              <CheckboxSetting
                text={browser.i18n.getMessage("cleanExpiredCookiesText")}
                description={browser.i18n.getMessage("cleanExpiredDescText")}
                settingObject={settings[SettingID.CLEAN_EXPIRED]}
                updateSetting={(payload) => onUpdateSetting(payload)}
              />
            </SettingRow>
          </>
        )}
      </SettingGroup>

      <SettingGroup title={browser.i18n.getMessage("settingGroupSiteData")}>
        <SiteDataControl
          settings={settings}
          onUpdateSetting={(payload) => onUpdateSetting(payload)}
        />
      </SettingGroup>

      <SettingGroup title={browser.i18n.getMessage("settingGroupExtension")}>
        <SettingRow>
          <CheckboxSetting
            text={browser.i18n.getMessage("notifyCookieCleanUpText")}
            description={browser.i18n.getMessage("notifyAutoDescText")}
            settingObject={settings[SettingID.NOTIFY_AUTO]}
            updateSetting={(payload) => onUpdateSetting(payload)}
          />
        </SettingRow>
        <SettingRow>
          <CheckboxSetting
            text={browser.i18n.getMessage("showNumberOfCookiesInIconText")}
            description={browser.i18n.getMessage("cookieCountIconDescText")}
            settingObject={settings[SettingID.NUM_COOKIES_ICON]}
            updateSetting={(payload) => onUpdateSetting(payload)}
          />
        </SettingRow>
        <SettingRow>
          <CheckboxSetting
            text={browser.i18n.getMessage("enableCleanupLogText")}
            description={browser.i18n.getMessage("cleanupLogDescText")}
            settingObject={settings[SettingID.STAT_LOGGING]}
            updateSetting={(payload) => onUpdateSetting(payload)}
          />
        </SettingRow>
        {settings[SettingID.STAT_LOGGING].value && (
          <div className="alert rounded-none alert-warning" role="alert">
            {browser.i18n.getMessage("noPrivateLogging")}
          </div>
        )}
        <SettingRow highlight={true}>
          <CheckboxSetting
            description={browser.i18n.getMessage("showAdvancedPopupDescText")}
            settingObject={
              settings[SettingID.POPUP_ADVANCED] ?? {
                name: SettingID.POPUP_ADVANCED,
                value: false,
              }
            }
            text={browser.i18n.getMessage("showAdvancedPopupText")}
            updateSetting={(payload) => onUpdateSetting(payload)}
          />
        </SettingRow>
        {advancedMode && (
          <>
            {settings[SettingID.NUM_COOKIES_ICON].value === true && (
              <SettingRow>
                <CheckboxSetting
                  text={browser.i18n.getMessage(SettingID.KEEP_DEFAULT_ICON)}
                  description={browser.i18n.getMessage(
                    "keepDefaultIconDescText"
                  )}
                  settingObject={settings[SettingID.KEEP_DEFAULT_ICON]}
                  updateSetting={(payload) => onUpdateSetting(payload)}
                />
              </SettingRow>
            )}
            <SettingRow>
              <CheckboxSetting
                settingObject={settings[SettingID.NOTIFY_MANUAL]}
                text={browser.i18n.getMessage("manualNotificationsText")}
                updateSetting={(payload) => onUpdateSetting(payload)}
              />
            </SettingRow>
            <SettingRow>
              <SelectInput
                numSize={9}
                numStart={1}
                settingObject={settings[SettingID.NOTIFY_DURATION]}
                text={browser.i18n.getMessage("notifyCookieCleanupDelayText")}
                description={browser.i18n.getMessage("notifyDurationDescText")}
                updateSetting={(payload) => {
                  onUpdateSetting(payload);
                }}
              />
            </SettingRow>
            <SettingRow>
              <CheckboxSetting
                text={browser.i18n.getMessage(SettingID.ENABLE_NEW_POPUP)}
                settingObject={settings[SettingID.ENABLE_NEW_POPUP]}
                updateSetting={(payload) => onUpdateSetting(payload)}
              />
            </SettingRow>
            <SettingRow>
              <SelectInput
                numSize={14}
                numStart={10}
                settingObject={settings[SettingID.SIZE_POPUP]}
                text={browser.i18n.getMessage("sizePopupText")}
                updateSetting={(payload) => onUpdateSetting(payload)}
              />
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
            </SettingRow>
            <SettingRow>
              <CheckboxSetting
                text={browser.i18n.getMessage("enableContextMenus")}
                settingObject={settings[SettingID.CONTEXT_MENUS]}
                updateSetting={(payload) => onUpdateSetting(payload)}
              />
            </SettingRow>
            <SettingRow>
              <CheckboxSetting
                text={browser.i18n.getMessage(SettingID.DEBUG_MODE)}
                description={browser.i18n.getMessage("debugModeDescText")}
                settingObject={settings[SettingID.DEBUG_MODE]}
                updateSetting={(payload) => onUpdateSetting(payload)}
              />
            </SettingRow>
            {settings[SettingID.DEBUG_MODE].value && (
              <div className="alert block rounded-none alert-info" role="alert">
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
          </>
        )}
      </SettingGroup>
    </div>
  );
};

export default Settings;
