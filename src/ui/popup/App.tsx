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
import Icon from "@/ui/common-components/Icon";
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
  // The additional-cleaning-options panel. React state replaces the
  // Bootstrap/jQuery collapse plugin (#41): the caret toggles it, and any
  // other click in the popup (including the panel's own buttons, after they
  // fire) bubbles to the root handler below and closes it — matching the old
  // data-toggle behavior.
  const [cleanOptionsOpen, setCleanOptionsOpen] = React.useState(false);

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
      className="overflow-auto"
      onClick={() => {
        if (cleanOptionsOpen) setCleanOptionsOpen(false);
      }}
    >
      <header className="flex items-center justify-center gap-2 bg-base-200 px-3 pt-2 pb-1">
        <span id="CADTitle" className="text-sm font-semibold">
          {browser.i18n.getMessage("extensionName")}
        </span>
        <span
          id="CADVersion"
          className="badge font-mono badge-sm badge-neutral"
        >
          {browser.runtime.getManifest().version}
        </span>
      </header>
      <div className="flex flex-wrap items-center justify-center gap-1.5 border-b border-base-300 bg-base-200 p-2">
        <IconButton
          iconName="power-off"
          className={`${
            settings[SettingID.ACTIVE_MODE].value ? "btn-success" : "btn-error"
          } btn-sm`}
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
          className={`${
            settings[SettingID.NOTIFY_AUTO].value ? "btn-success" : "btn-error"
          } btn-sm`}
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
          className="join"
          role="group"
          aria-label="Clean Actions Group"
        >
          <IconButton
            iconName="eraser"
            className="join-item btn-sm btn-warning"
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
            aria-expanded={cleanOptionsOpen}
            id="cleanOptionsToggle"
            className="btn join-item px-1.5 btn-sm btn-warning"
            type="button"
            onClick={(e) => {
              // Keep the root close-on-any-click handler from immediately
              // undoing the toggle.
              e.stopPropagation();
              setCleanOptionsOpen((open) => !open);
            }}
          >
            <Icon name="chevron-down" size="sm" />
            <span className="sr-only">
              {browser.i18n.getMessage("dropdownAdditionalCleaningOptions")}
            </span>
          </button>
        </div>
        <IconButton
          iconName="cog"
          className="btn-info btn-sm"
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
      {cleanOptionsOpen && (
        <CleanCollapseGroup hostname={hostname || ""} tab={tab} />
      )}

      <main className="flex flex-col gap-2 p-3">
        <div className="flex items-center gap-2">
          {tab.favIconUrl && !tab.favIconUrl.startsWith("chrome:") && (
            <img alt={"favIcon"} src={tab.favIconUrl} className="h-5 w-5" />
          )}
          <span className="min-w-0 flex-1 truncate text-lg">{hostname}</span>
          <span className="text-end whitespace-nowrap">
            <span id="CADCookieText">
              {browser.i18n.getMessage("popupCookieCountText")}
            </span>
            :&nbsp;
            <span id="CADCookieCount" className="font-bold">
              {cookieCount}
            </span>
          </span>
        </div>

        {addableHostnames.map((addableHostname) => (
          <div key={addableHostname} className="flex items-center gap-2">
            <div className="min-w-0 flex-1 truncate">{addableHostname}</div>
            <div className="join">
              <IconButton
                className="join-item btn-secondary btn-sm"
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
                className="join-item btn-primary btn-sm"
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

        <FilteredExpression url={hostname} storeId={storeId} />
        <ActivityTable numberToShow={3} decisionFilter={FilterOptions.CLEAN} />
      </main>
    </div>
  );
};

export default App;
