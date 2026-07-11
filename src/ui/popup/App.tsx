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
import { useSelector, useStore } from "react-redux";
import ContextualIdentityEvents from "@/services/contextual-identity-events";
import { browserCapabilities } from "@/services/browser-capabilities";
import {
  ADCPCOOKIENAME,
  effectiveListKey,
  extractMainDomain,
  getAllCookiesForDomain,
  getHostname,
  getMatchedExpressions,
  isAnIP,
  parseCookieStoreId,
} from "@/services/libs";
import { ListType, SettingID } from "@/typings/enums";
import AdvancedControls from "./components/AdvancedControls";
import KeepActions from "./components/KeepActions";
import MoreCleaningOptions from "./components/MoreCleaningOptions";
import PopupFooter from "./components/PopupFooter";
import PopupHero from "./components/PopupHero";
import ShareMenu from "./components/ShareMenu";
import SiteCard from "./components/SiteCard";
import SiteDataPanel from "./components/SiteDataPanel";

/**
 * The 05d-design popup: name bar with Share, state hero, site card, keep
 * actions — and, behind the "Show advanced controls in the popup" setting,
 * the matched-rule line, exact-expression rows, and the scoped clean menu.
 */
const App: React.FunctionComponent = () => {
  // Only the slices rendered here are selected; event handlers read the
  // full state fresh from the store at event time.
  const settings = useSelector((s: State) => s.settings);
  const lists = useSelector((s: State) => s.lists);
  const store = useStore();

  const [cookieCount, setCookieCount] = React.useState(0);
  const [tab, setTab] = React.useState<browser.tabs.Tab | undefined>(undefined);
  const [storeId, setStoreId] = React.useState("default");
  const [containerName, setContainerName] = React.useState<string | undefined>(
    undefined
  );
  // Bumped after an external port disconnect so the port effect re-runs and
  // reconnects.
  const [reconnectAttempt, setReconnectAttempt] = React.useState(0);
  // Bumped on every cookie-count ping; tells the site-data panel to
  // re-collect (every clean sets the marker cookie, so cleans ping too).
  const [dataVersion, setDataVersion] = React.useState(0);

  const port = React.useRef<browser.runtime.Port | null>(null);

  // Keep the latest tab readable from the long-lived port listeners without
  // having to re-create the port on every render.
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
    setDataVersion((version) => version + 1);
  }, [store]);

  // Mount: size the popup from settings, then resolve the active tab.
  React.useEffect(() => {
    document.documentElement.style.fontSize = `${
      (settings[SettingID.SIZE_POPUP].value as number) || 16
    }px`;
    // Chrome requires min width otherwise the layout is messed up.
    // Fixed at the 05d mockup's 430px frame; the font-size setting scales
    // the text only (the old formula grew the popup to 640px by default).
    document.documentElement.style.minWidth = "430px";
    browser.tabs
      .query({
        active: true,
        currentWindow: true,
      })
      .then((tabs) => {
        setStoreId(parseCookieStoreId(tabs[0].cookieStoreId));
        setTab(tabs[0]);
        // Container name for the site card, from the background's
        // session-persisted cache (no live query needed in the popup).
        const rawStoreId = tabs[0].cookieStoreId;
        if (
          browserCapabilities.supportsContextualIdentities &&
          rawStoreId?.startsWith("firefox-container-") &&
          browser.storage.session
        ) {
          const key = ContextualIdentityEvents.SESSION_KEY;
          browser.storage.session
            .get({ [key]: {} })
            .then((data) => {
              const cache = data[key] as Record<string, { name?: string }>;
              setContainerName(cache?.[rawStoreId]?.name);
            })
            .catch(() => undefined);
        }
      });
    // The class component read these settings once in componentDidMount, so
    // this effect intentionally runs on mount only.
  }, []);

  // The long-lived cookie-count port; waits until the active tab is known
  // and disconnects on unmount.
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

  const domain = mainDomain || hostname;
  const keepExpression =
    addableHostnames.find((h) => h === `*.${domain}`) ?? hostname;

  // Keep/Clean and the hero/badge all work against the list that GOVERNS
  // this tab's store: container tabs use their own list only while the
  // contextualIdentities setting is on, otherwise the default list.
  const governingStoreId = effectiveListKey(store.getState() as State, storeId);
  // Prefer a permanent keep rule for the hero/badge when several match.
  const matchedExpressions = getMatchedExpressions(
    lists,
    governingStoreId,
    hostname
  );
  const matched =
    matchedExpressions.find((e) => e.listType === ListType.WHITE) ??
    matchedExpressions[0];

  const activeMode = Boolean(settings[SettingID.ACTIVE_MODE].value);
  const advanced = Boolean(settings[SettingID.POPUP_ADVANCED]?.value);
  const cleanDelay = (settings[SettingID.CLEAN_DELAY].value as number) || 15;

  return (
    <div className="flex flex-col" id="cadPopup">
      <header className="flex items-center gap-2 border-b border-base-300 px-4 py-2">
        <span
          className="min-w-0 flex-1 truncate text-sm font-semibold"
          id="CADTitle"
        >
          {browser.i18n.getMessage("extensionName")}
        </span>
        <ShareMenu />
      </header>
      <PopupHero
        activeMode={activeMode}
        domain={domain}
        matchedListType={matched?.listType as ListType | undefined}
      />
      <SiteCard
        cleanDelay={cleanDelay}
        containerName={containerName}
        cookieCount={cookieCount}
        hostname={hostname}
        matchedListType={matched?.listType as ListType | undefined}
      />
      <SiteDataPanel dataVersion={dataVersion} tab={tab} />
      {advanced && (
        <AdvancedControls
          addableHostnames={addableHostnames}
          matched={matched}
          storeId={governingStoreId}
        />
      )}
      <KeepActions
        domain={domain}
        keepExpression={keepExpression}
        matched={matched}
        storeId={governingStoreId}
      />
      {advanced && <MoreCleaningOptions hostname={hostname} tab={tab} />}
      <PopupFooter tabIndex={tab.index} />
    </div>
  );
};

export default App;
