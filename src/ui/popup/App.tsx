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
import * as React from "react";
import { useDispatch, useSelector, useStore } from "react-redux";
import {
  addExpressionUI,
  cookieCleanupUI,
  updateSetting,
} from "@/redux/actions";
import {
  ADCPCOOKIENAME,
  extractMainDomain,
  getAllCookiesForDomain,
  getHostname,
  isAnIP,
  localFileToRegex,
  parseCookieStoreId,
} from "@/services/libs";
import { FilterOptions, ListType, SettingID } from "@/typings/enums";
import ActivityTable from "@/ui/common-components/ActivityTable";
import IconButton from "@/ui/common-components/IconButton";
import CleanCollapseGroup from "./components/CleanCollapseGroup";
import FilteredExpression from "./components/FilteredExpression";
import { animateFlash } from "./popup-lib";

const App: React.FunctionComponent = () => {
  // Only the settings slice is rendered here; selecting it (instead of the
  // root state) avoids re-renders on unrelated store changes and react-redux's
  // dev warning about root-state selectors.
  const settings = useSelector((s: State) => s.settings);
  // Event handlers and the port listener need the full state; they read it
  // fresh from the store at event time.
  const store = useStore();
  const dispatch = useDispatch<any>();

  const [cookieCount, setCookieCount] = React.useState(0);
  const [tab, setTab] = React.useState<browser.tabs.Tab | undefined>(undefined);
  const [storeId, setStoreId] = React.useState("default");
  // Bumped after an external port disconnect so the port effect re-runs and
  // reconnects.
  const [reconnectAttempt, setReconnectAttempt] = React.useState(0);

  const port = React.useRef<browser.runtime.Port | null>(null);

  // Keep the latest tab readable from the long-lived port listeners without
  // having to re-create the port on every render. The redux state needs no
  // ref: the listeners read it fresh from the store at event time.
  const tabRef = React.useRef(tab);
  React.useEffect(() => {
    tabRef.current = tab;
  });

  const setPopupCookieCount = React.useCallback(async () => {
    const currentTab = tabRef.current;
    if (!currentTab || !currentTab.url) return;
    const cookies = await getAllCookiesForDomain(
      store.getState() as State,
      currentTab
    );

    setCookieCount(
      cookies
        ? cookies.length -
            cookies.filter((cookie) => cookie.name === ADCPCOOKIENAME).length
        : 0
    );
  }, [store]);

  // Mount: size the popup from settings, then resolve the active tab.
  React.useEffect(() => {
    document.documentElement.style.fontSize = `${
      (settings[SettingID.SIZE_POPUP].value as number) || 16
    }px`;
    // Chrome requires min width otherwise the layout is messed up
    document.documentElement.style.minWidth = `${
      430 + (((settings[SettingID.SIZE_POPUP].value as number) || 16) - 10) * 35
    }px`;
    browser.tabs
      .query({
        active: true,
        currentWindow: true,
      })
      .then((tabs) => {
        setStoreId(parseCookieStoreId(tabs[0].cookieStoreId));
        setTab(tabs[0]);
      });
    // The class component read these settings once in componentDidMount, so
    // this effect intentionally runs on mount only.
  }, []);

  // The long-lived port used to be opened as a side effect of render(); as a
  // function component it lives in this effect, which waits until the active
  // tab is known and disconnects on unmount.
  React.useEffect(() => {
    if (!tab) return;
    const hostname = getHostname(tab.url);
    if (!hostname) return;
    if (port.current) return;
    // Mirrors the class component's isUnmounting flag: flipped once this
    // effect instance is cleaned up (unmount or re-run).
    let cancelled = false;
    const newPort = browser.runtime.connect({
      name: `popupADCP_${hostname},${storeId.replace(",", "-")}`,
    });
    port.current = newPort;
    newPort.onMessage.addListener((m) => {
      const msg = m as CookieCountMsg;
      if (msg.cookieUpdated !== undefined && msg.cookieUpdated) {
        setPopupCookieCount();
      }
    });
    newPort.onDisconnect.addListener((p) => {
      if (p.error) {
        // eslint-disable-next-line no-console
        console.error(
          `Disconnected due to an error: ${browser.runtime.lastError}`
        );
      }
      port.current = null;
      // MV3: the background service worker may have idled out, which
      // closes the port. Bump reconnectAttempt to reconnect (the effect
      // re-runs and recreates the port), which also wakes the worker.
      if (!cancelled) {
        setTimeout(() => {
          if (!cancelled) setReconnectAttempt((attempt) => attempt + 1);
        }, 250);
      }
    });
    return () => {
      cancelled = true;
      if (port.current) {
        port.current.disconnect();
        port.current = null;
      }
    };
  }, [tab, storeId, reconnectAttempt, setPopupCookieCount]);

  if (!tab) {
    return "Loading";
  }

  const hostname = getHostname(tab.url);
  const mainDomain = extractMainDomain(hostname);
  const addableHostnames = [
    hostname === mainDomain ? undefined : `*.${mainDomain}`,
    hostname,
  ].filter(Boolean) as string[];
  if (hostname !== "" && !isAnIP(tab.url) && !hostname.startsWith("file:")) {
    addableHostnames.push(`*.${hostname}`);
  }

  return (
    <div
      id="cadPopup"
      className="container-fluid"
      style={{
        overflow: "auto",
      }}
      onClick={(e) => {
        const _t = e.target as HTMLElement;
        const _ccg = document.getElementById("cleanCollapse");
        if (!_ccg || !_ccg.classList.contains("show")) return;
        const _dt = _t.attributes.getNamedItem("data-target");
        if (!_dt || _dt.value !== "#cleanCollapse") {
          _ccg.classList.remove("show");
        }
      }}
    >
      <div
        className="row pt-2"
        style={{
          alignItems: "center",
          backgroundColor: "rgba(0, 0, 0, 0.05)",
          justifyContent: "center",
        }}
      >
        <span id="CADTitle">{browser.i18n.getMessage("extensionName")}</span>
        &nbsp;
        <span id="CADVersion" style={{ fontWeight: "bold" }}>
          {browser.runtime.getManifest().version}
        </span>
      </div>
      <div
        className="row justify-content-center p-1"
        style={{
          alignItems: "center",
          backgroundColor: "rgba(0, 0, 0, 0.05)",
          borderBottom: "1px solid rgba(0, 0, 0, 0.1)",
        }}
      >
        <IconButton
          iconName="power-off"
          className={`btn-${
            settings[SettingID.ACTIVE_MODE].value ? "success" : "danger"
          } m-1`}
          onClick={() =>
            dispatch(
              updateSetting({
                ...settings[SettingID.ACTIVE_MODE],
                value: !settings[SettingID.ACTIVE_MODE].value,
              })
            )
          }
          title={
            settings[SettingID.ACTIVE_MODE].value
              ? browser.i18n.getMessage("disableAutoDeleteText")
              : browser.i18n.getMessage("enableAutoDeleteText")
          }
          text={
            settings[SettingID.ACTIVE_MODE].value
              ? browser.i18n.getMessage("autoDeleteEnabledText")
              : browser.i18n.getMessage("autoDeleteDisabledText")
          }
        />
        <IconButton
          iconName={
            settings[SettingID.NOTIFY_AUTO].value ? "bell" : "bell-slash"
          }
          className={`btn-${
            settings[SettingID.NOTIFY_AUTO].value ? "success" : "danger"
          } m-1`}
          onClick={() =>
            dispatch(
              updateSetting({
                ...settings[SettingID.NOTIFY_AUTO],
                value: !settings[SettingID.NOTIFY_AUTO].value,
              })
            )
          }
          title={browser.i18n.getMessage("toggleNotificationText")}
          text={
            settings[SettingID.NOTIFY_AUTO].value
              ? browser.i18n.getMessage("notificationEnabledText")
              : browser.i18n.getMessage("notificationDisabledText")
          }
        />
        <div
          id="cleanButtonContainer"
          className="btn-group m-1"
          role="group"
          aria-label="Clean Actions Group"
        >
          <IconButton
            iconName="eraser"
            className="btn-warning"
            type="button"
            onClick={() => {
              dispatch(
                cookieCleanupUI({
                  greyCleanup: false,
                  ignoreOpenTabs: false,
                })
              );
              animateFlash(
                document.getElementById("cleanButtonContainer"),
                true
              );
            }}
            title={browser.i18n.getMessage("cookieCleanupText")}
            text={browser.i18n.getMessage("cleanText")}
          />

          <button
            aria-controls="cleanCollapse"
            aria-expanded="false"
            className="btn btn-warning dropdown-toggle dropdown-toggle-split"
            data-disabled="true"
            data-target="#cleanCollapse"
            data-toggle="collapse"
            role="button"
            style={{
              borderLeftColor: "rgb(176, 132, 0)",
              transform: "translate3d(-3px, 0px, 0px)",
            }}
          >
            <span className="sr-only">
              {browser.i18n.getMessage("dropdownAdditionalCleaningOptions")}
            </span>
          </button>
        </div>
        <IconButton
          iconName="cog"
          className="btn-info m-1"
          onClick={() => {
            browser.tabs.create({
              index: tab.index + 1,
              url: "/settings/settings.html#tabSettings",
            });
            window.close();
          }}
          title={browser.i18n.getMessage("preferencesText")}
          text={browser.i18n.getMessage("preferencesText")}
        />
      </div>
      <CleanCollapseGroup hostname={hostname || ""} tab={tab} />

      <div
        className="row no-gutters"
        style={{
          alignItems: "center",
          margin: "8px 0",
        }}
      >
        {tab.favIconUrl && !tab.favIconUrl.startsWith("chrome:") && (
          <img
            alt={"favIcon"}
            src={tab.favIconUrl}
            style={{
              height: "20px",
              marginRight: "7px",
              verticalAlign: "middle",
              width: "20px",
            }}
          />
        )}
        <div className="col">
          <span
            style={{
              fontSize: "1.25em",
              marginRight: "8px",
              verticalAlign: "middle",
            }}
          >
            {hostname}
          </span>
        </div>
        <div
          className="col-3"
          style={{
            fontSize: "1.1em",
            textAlign: "center",
          }}
        >
          <span id="CADCookieText">
            {browser.i18n.getMessage("popupCookieCountText")}
          </span>
          :&nbsp;
          <span
            id="CADCookieCount"
            style={{
              fontWeight: "bold",
            }}
          >
            {cookieCount}
          </span>
        </div>
      </div>

      {addableHostnames.map((addableHostname) => (
        <div
          key={addableHostname}
          style={{
            alignItems: "center",
            display: "flex",
            margin: "8px 0",
          }}
          className="row"
        >
          <div
            style={{
              flex: 1,
            }}
          >
            {addableHostname}
          </div>
          <div
            className="btn-group"
            style={{
              marginLeft: "8px",
            }}
          >
            <IconButton
              className="btn-secondary"
              onClick={() => {
                dispatch(
                  addExpressionUI({
                    expression: localFileToRegex(addableHostname),
                    listType: ListType.GREY,
                    storeId,
                  })
                );
              }}
              iconName="plus"
              title={browser.i18n.getMessage("toGreyListText")}
              text={browser.i18n.getMessage("greyListWordText")}
            />

            <IconButton
              className="btn-primary"
              onClick={() => {
                dispatch(
                  addExpressionUI({
                    expression: localFileToRegex(addableHostname),
                    listType: ListType.WHITE,
                    storeId,
                  })
                );
              }}
              iconName="plus"
              title={browser.i18n.getMessage("toWhiteListText")}
              text={browser.i18n.getMessage("whiteListWordText")}
            />
          </div>
        </div>
      ))}

      <div
        className="row"
        style={{
          margin: "8px 0",
        }}
      >
        <FilteredExpression url={hostname} storeId={storeId} />
      </div>
      <ActivityTable numberToShow={3} decisionFilter={FilterOptions.CLEAN} />
    </div>
  );
};

export default App;
