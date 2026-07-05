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
import { SettingID } from "../../../typings/enums";
import * as React from "react";
import { useSelector } from "react-redux";
import { adcpLog } from "../../../services/libs";
import IconButton from "../../common-components/IconButton";

const styles = {
  buttonStyle: {
    height: "max-content",
    padding: "0.75em",
    width: "max-content",
  },
};
interface OwnProps {
  style?: React.CSSProperties;
}

const settingOrder = [
  SettingID.ACTIVE_MODE,
  SettingID.CLEAN_DELAY,
  SettingID.CLEAN_DISCARDED,
  SettingID.CLEAN_DOMAIN_CHANGE,
  SettingID.ENABLE_GREYLIST,
  SettingID.CLEAN_OPEN_TABS_STARTUP,
  SettingID.CLEAN_EXPIRED,
  SettingID.SITEDATA_EMPTY_ON_ENABLE,
  SettingID.CLEANUP_CACHE,
  SettingID.CLEANUP_INDEXEDDB,
  SettingID.CLEANUP_LOCALSTORAGE,
  SettingID.CLEANUP_PLUGINDATA,
  SettingID.CLEANUP_SERVICEWORKERS,
  SettingID.STAT_LOGGING,
  SettingID.NUM_COOKIES_ICON,
  SettingID.KEEP_DEFAULT_ICON,
  SettingID.NOTIFY_AUTO,
  SettingID.NOTIFY_MANUAL,
  SettingID.NOTIFY_DURATION,
  SettingID.ENABLE_NEW_POPUP,
  SettingID.SIZE_POPUP,
  SettingID.SIZE_SETTING,
  SettingID.CONTEXT_MENUS,
  SettingID.DEBUG_MODE,
];

const About: React.FunctionComponent<OwnProps> = ({ style }) => {
  const settings = useSelector((state: State) => state.settings);
  const settingSlim = settingOrder.map((s) => {
    const so = settings[s];
    return `- ${so.name}: ${so.value}`;
  });
  return (
    <div style={style}>
      <h1>{browser.i18n.getMessage("aboutText")}</h1>
      <h5>
        {browser.i18n.getMessage("versionNumberText", ["ADCP"])}:
        <br />
        <b>{browser.runtime.getManifest().version}</b>
      </h5>
      <a href="https://github.com/j127/auto_delete_cookies_for_privacy/issues">
        {browser.i18n.getMessage("reportIssuesText")}
      </a>{" "}
      <br />
      <br />
      <a href="https://github.com/j127/auto_delete_cookies_for_privacy/blob/main/documentation/src/introduction.md">
        <span>{`${browser.i18n.getMessage("documentationText")}`}</span>
      </a>
      <br />
      <a href="https://github.com/j127/auto_delete_cookies_for_privacy/blob/main/documentation/src/faq.md">
        <span>{`${browser.i18n.getMessage("faqText")}`}</span>
      </a>
      <br />
      <br />
      <span>{`${browser.i18n.getMessage("contributorsText")}`}:</span>
      <ul>
        <li>Kenny Do (Creator)</li>
        <li>
          seansfkelley (UI Redesign of Expression Table Settings and Popup)
        </li>
        <li>kennethtran93 (UI bug fixes and then some)</li>
        <li>
          <a href="https://github.com/j127/auto_delete_cookies_for_privacy/graphs/contributors">
            GitHub Contributors
          </a>
        </li>
        <li>Crowdin translation community (original locale files)</li>
      </ul>
      <br />
      <h3>{browser.i18n.getMessage("debugTitle")}</h3>
      <p>{browser.i18n.getMessage("copyDebugSystemText")}</p>
      <textarea
        id="debugInfo"
        rows={3}
        cols={40}
        readOnly={true}
        style={{ resize: "none" }}
        value={`- Browser Info: (Please add version number on paste)\n- ADCP Version: ${
          browser.runtime.getManifest().version
        }`}
      />
      <br />
      <IconButton
        className="btn-primary"
        role="button"
        onClick={() => {
          const textDebug = document.getElementById(
            "debugInfo"
          ) as HTMLTextAreaElement | null;
          const spanCopy = document.getElementById("copy-debugInfo");
          if (!textDebug || !spanCopy) {
            adcpLog(
              {
                type: "error",
                msg: "Could not find either textarea or span for debugInfo",
              },
              true
            );
            return;
          }
          if (!textDebug.value) {
            adcpLog(
              {
                type: "error",
                msg: "Could not get value from textarea for debugInfo",
              },
              true
            );
            return;
          }
          navigator.clipboard.writeText(textDebug.value).then(
            () => {
              spanCopy.classList.add("text-success");
              spanCopy.innerText = browser.i18n.getMessage("copySuccessText");
            },
            () => {
              spanCopy.classList.add("text-danger");
              spanCopy.innerText = browser.i18n.getMessage("copyFailedText");
            }
          );
          setTimeout(() => {
            spanCopy.innerText = "";
            spanCopy.classList.remove("text-danger", "text-success");
          }, 5000);
        }}
        iconName="copy"
        title={browser.i18n.getMessage("copyToClipboardText")}
        text={browser.i18n.getMessage("copyToClipboardText")}
        styleReact={styles.buttonStyle}
      />{" "}
      <span id="copy-debugInfo">&nbsp;</span>
      <br />
      <br />
      <p>{browser.i18n.getMessage("copyDebugSettingText")}</p>
      <textarea
        id="debugSettings"
        rows={5}
        cols={40}
        readOnly={true}
        style={{ resize: "none" }}
        value={settingSlim.join("\n")}
      />
      <br />
      <IconButton
        className="btn-primary"
        role="button"
        onClick={() => {
          const textDebug = document.getElementById(
            "debugSettings"
          ) as HTMLTextAreaElement | null;
          const spanCopy = document.getElementById("copy-debugSettings");
          if (!textDebug || !spanCopy) {
            adcpLog(
              {
                type: "error",
                msg: "Could not find either textarea or span for debugSettings",
              },
              true
            );
            return;
          }
          if (!textDebug.value) {
            adcpLog(
              {
                type: "error",
                msg: "Could not get value from textarea for debugSettings",
              },
              true
            );
            return;
          }
          navigator.clipboard.writeText(textDebug.value).then(
            () => {
              spanCopy.classList.add("text-success");
              spanCopy.innerText = browser.i18n.getMessage("copySuccessText");
            },
            () => {
              spanCopy.classList.add("text-danger");
              spanCopy.innerText = browser.i18n.getMessage("copyFailedText");
            }
          );
          setTimeout(() => {
            spanCopy.innerText = "";
            spanCopy.classList.remove("text-danger", "text-success");
          }, 5000);
        }}
        iconName="copy"
        title={browser.i18n.getMessage("copyToClipboardText")}
        text={browser.i18n.getMessage("copyToClipboardText")}
        styleReact={styles.buttonStyle}
      />{" "}
      <span id="copy-debugSettings">&nbsp;</span>
      <br />
      <br />
    </div>
  );
};

export default About;
