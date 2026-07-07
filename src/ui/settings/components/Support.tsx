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
import { useSelector } from "react-redux";
import { adcpLog } from "@/services/libs";
import IconButton from "@/ui/common-components/IconButton";

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

const Support: React.FunctionComponent<OwnProps> = ({ style }) => {
  const settings = useSelector((state: State) => state.settings);
  const settingSlim = settingOrder.map((s) => {
    const so = settings[s];
    return `- ${so.name}: ${so.value}`;
  });
  return (
    <div style={style}>
      <h1 className="mb-4 text-2xl font-bold">
        {browser.i18n.getMessage("supportText")}
      </h1>
      <p className="mb-4">
        {browser.i18n.getMessage("versionNumberText", [
          browser.i18n.getMessage("extensionName"),
        ])}
        :{" "}
        <span className="badge font-mono badge-neutral">
          {browser.runtime.getManifest().version}
        </span>
      </p>
      <div className="mb-4 flex flex-col gap-1">
        <a
          className="link link-primary"
          href="https://github.com/j127/auto_delete_cookies_for_privacy/issues"
        >
          {browser.i18n.getMessage("reportIssuesText")}
        </a>
      </div>
      <div className="divider" />
      <h3 className="mb-2 text-xl font-semibold">
        {browser.i18n.getMessage("debugTitle")}
      </h3>
      <p className="mb-2">{browser.i18n.getMessage("copyDebugSystemText")}</p>
      <textarea
        id="debugInfo"
        rows={3}
        cols={40}
        readOnly={true}
        className="textarea block w-full max-w-xl resize-none font-mono text-xs"
        value={`- Browser Info: (Please add version number on paste)\n- ${browser.i18n.getMessage(
          "extensionName"
        )} version: ${browser.runtime.getManifest().version}`}
      />
      <div className="mt-2 mb-4 flex items-center gap-2">
        <IconButton
          className="btn-primary btn-sm"
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
                spanCopy.classList.add("text-error");
                spanCopy.innerText = browser.i18n.getMessage("copyFailedText");
              }
            );
            setTimeout(() => {
              spanCopy.innerText = "";
              spanCopy.classList.remove("text-error", "text-success");
            }, 5000);
          }}
          iconName="copy"
          title={browser.i18n.getMessage("copyToClipboardText")}
          text={browser.i18n.getMessage("copyToClipboardText")}
        />
        <span id="copy-debugInfo">&nbsp;</span>
      </div>
      <p className="mb-2">{browser.i18n.getMessage("copyDebugSettingText")}</p>
      <textarea
        id="debugSettings"
        rows={5}
        cols={40}
        readOnly={true}
        className="textarea block w-full max-w-xl resize-none font-mono text-xs"
        value={settingSlim.join("\n")}
      />
      <div className="mt-2 mb-4 flex items-center gap-2">
        <IconButton
          className="btn-primary btn-sm"
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
                spanCopy.classList.add("text-error");
                spanCopy.innerText = browser.i18n.getMessage("copyFailedText");
              }
            );
            setTimeout(() => {
              spanCopy.innerText = "";
              spanCopy.classList.remove("text-error", "text-success");
            }, 5000);
          }}
          iconName="copy"
          title={browser.i18n.getMessage("copyToClipboardText")}
          text={browser.i18n.getMessage("copyToClipboardText")}
        />
        <span id="copy-debugSettings">&nbsp;</span>
      </div>
    </div>
  );
};

export default Support;
