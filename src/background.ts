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

// Must be the first import: provides the `browser` and `browserDetect`
// globals that MV2 supplied via script tags (see src/init-globals.ts).
import { browserName, ListType, SettingID, SiteDataType } from "./typings/enums";
import "./init-globals";

import { Store } from "redux";
import { cookieCleanup, validateSettings } from "./redux/actions";
import createStore, { backgroundActions } from "./redux/store";
import {
  CONNECTION_NAME,
  DISPATCH,
  UPDATE_STATE,
  dispatchBridgeAction,
  handleBridgeConnection,
} from "./redux/store-bridge";
import AlarmEvents from "./services/alarm-events";
import {
  checkIfProtected,
  setGlobalIcon,
} from "./services/browser-action-service";
import ContextMenuEvents from "./services/context-menu-events";
import CookieEvents from "./services/cookie-events";
import {
  cadLog,
  convertVersionToNumber,
  extractMainDomain,
  getSetting,
} from "./services/libs";
import StoreUser from "./services/store-user";
import TabEvents from "./services/tab-events";
import { ReduxAction, ReduxConstants } from "./typings/redux-constants";
import ContextualIdentitiesEvents from "./services/contextual-identities-events";
import SettingService from "./services/setting-service";

let store: Store<State, ReduxAction>;

// Delay saving to disk to queue up actions
let delaySave = false;
const saveToStorage = () => {
  if (!delaySave) {
    delaySave = true;
    // Safe in MV3: this always runs within 1s of an event that just reset
    // the service worker's ~30s idle timer (see the timers doctrine in the
    // MV3 migration plan).
    setTimeout(() => {
      delaySave = false;
      return browser.storage.local.set({
        state: JSON.stringify(store.getState()),
      });
    }, 1000);
  }
};

/**
 * Runs on EVERY service worker start (browser start, install, update, or
 * wake-up after idle suspension), so everything here must be idempotent.
 * One-time-per-browser-session work (like the session counter reset and the
 * grey startup cleanup) lives in runtime.onStartup/onInstalled instead.
 */
const init = async (): Promise<Store<State, ReduxAction>> => {
  const storage = await browser.storage.local.get();
  let stateFromStorage;
  try {
    if (storage.state) {
      stateFromStorage = JSON.parse(storage.state as string);
    } else {
      stateFromStorage = {};
    }
  } catch (err) {
    stateFromStorage = {};
  }
  store = createStore(stateFromStorage);

  // Store the FF version in cache
  if (browserDetect() === browserName.Firefox) {
    const browserInfo = await browser.runtime.getBrowserInfo();
    const browserVersion = Number.parseInt(browserInfo.version);
    store.dispatch({
      payload: {
        key: "browserVersion",
        value: browserVersion,
      },
      type: ReduxConstants.ADD_CACHE,
    });
    store.dispatch({
      payload: {
        key: "browserInfo",
        value: browserInfo,
      },
      type: ReduxConstants.ADD_CACHE,
    });
  }
  // Store which browser environment in cache
  store.dispatch({
    payload: {
      key: "browserDetect",
      value: browserDetect(),
    },
    type: ReduxConstants.ADD_CACHE,
  });

  // Store platform in cache
  const platformInfo = await browser.runtime.getPlatformInfo();
  store.dispatch({
    payload: {
      key: "platformInfo",
      value: platformInfo,
    },
    type: ReduxConstants.ADD_CACHE,
  });
  store.dispatch({
    payload: {
      key: "platformOs",
      value: platformInfo.os,
    },
    type: ReduxConstants.ADD_CACHE,
  });

  // This is important to initialize the Store for all classes that extend from this
  StoreUser.init(store);

  SettingService.init();
  store.subscribe(SettingService.onSettingsChange);
  store.subscribe(saveToStorage);

  store.dispatch<any>(validateSettings());

  // Rehydrate the per-session tab->domain cache and re-arm any pending
  // delayed cleanup that was scheduled before the worker was suspended.
  await TabEvents.hydrateFromSession();
  await AlarmEvents.recoverPendingCleanup();

  await setGlobalIcon(
    getSetting(store.getState(), SettingID.ACTIVE_MODE) as boolean
  );

  await checkIfProtected(store.getState());

  if (browser.contextMenus) {
    await ContextMenuEvents.menuInit();
  }

  if (browser.contextualIdentities) {
    await ContextualIdentitiesEvents.init();
  }

  cadLog(
    {
      msg: `background.init has been executed`,
      type: "info",
    },
    getSetting(store.getState(), SettingID.DEBUG_MODE) as boolean
  );

  return store;
};

// Kicked off synchronously on every worker start. Every event handler below
// awaits this before touching the store, so events delivered right after a
// wake-up simply queue behind initialization - none are lost, because all
// listeners are registered synchronously at the top level as MV3 requires.
const ready: Promise<Store<State, ReduxAction>> = init();

// Keeps a memory of all runtime ports for popups.  Should only be one but just in case.
// In-memory is correct in MV3: ports cannot outlive the service worker, and
// the popup reconnects on its own when the worker restarts.
const cookiePopupPorts: browser.runtime.Port[] = [];

async function onCookiePopupUpdates(changeInfo: {
  removed: boolean;
  cookie: browser.cookies.Cookie;
  cause: browser.cookies.OnChangedCause;
}) {
  const cDomain = extractMainDomain(changeInfo.cookie.domain);
  cookiePopupPorts.forEach((p) => {
    if (!p.name) return;
    if (!p.name.startsWith("popupCAD_")) return;
    const pn = p.name.slice(9).split(",");
    if (pn[0].endsWith(changeInfo.cookie.domain) || pn[0].endsWith(cDomain)) {
      p.postMessage({ cookieUpdated: true });
    }
  });
}

function handleConnect(p: browser.runtime.Port) {
  if (!p.name || !p.name.startsWith("popupCAD_")) return;
  p.onMessage.addListener((m) => {
    cadLog(
      {
        msg: "Received unexpected message from CAD Popup",
        type: "warn",
        x: JSON.stringify(m),
      },
      true
    );
  });
  p.onDisconnect.addListener((dp: browser.runtime.Port) => {
    if (!dp.name) return;
    const i: number = cookiePopupPorts.findIndex((pp: browser.runtime.Port) => {
      if (!pp.name) return false;
      return pp.name === dp.name;
    });
    if (i !== -1) {
      cookiePopupPorts.splice(i, 1);
    }
  });
  p.postMessage({ cookieUpdated: true });
  cookiePopupPorts.push(p);
}

const greyCleanup = () => {
  if (getSetting(store.getState(), SettingID.ACTIVE_MODE)) {
    cadLog(
      {
        msg: `background.greyCleanup:  dispatching browser restart greyCleanup.`,
      },
      getSetting(store.getState(), SettingID.DEBUG_MODE) as boolean
    );
    store.dispatch<any>(
      cookieCleanup({
        greyCleanup: true,
        ignoreOpenTabs: getSetting(
          store.getState(),
          SettingID.CLEAN_OPEN_TABS_STARTUP
        ),
      })
    );
  }
};

// ---------------------------------------------------------------------------
// Event listeners. MV3 requires these registrations to run synchronously at
// the top level of the worker script; the handlers await `ready` so they can
// safely touch the store even when the event is what woke the worker up.
// ---------------------------------------------------------------------------

browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  await ready;
  // Same order the MV2 build registered the individual listeners in.
  TabEvents.onDomainChange(tabId, changeInfo, tab);
  TabEvents.onTabDiscarded(tabId, changeInfo, tab);
  TabEvents.onTabUpdate(tabId, changeInfo, tab);
});

browser.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  await ready;
  TabEvents.onDomainChangeRemove(tabId, removeInfo);
  await TabEvents.cleanFromTabEvents();
});

// This should update the cookie badge count when cookies are changed, and
// fan out to any connected popups (MV2 added/removed that listener
// dynamically, which would not survive worker restarts).
browser.cookies.onChanged.addListener(async (changeInfo) => {
  await ready;
  await CookieEvents.onCookieChanged(changeInfo);
  if (cookiePopupPorts.length > 0) {
    await onCookiePopupUpdates(changeInfo);
  }
});

browser.runtime.onConnect.addListener(async (port) => {
  await ready;
  if (port.name === CONNECTION_NAME) {
    handleBridgeConnection(store, port);
  } else {
    handleConnect(port);
  }
});

// Exactly ONE onMessage listener: with webextension-polyfill, replying means
// returning a Promise, and multiple listeners racing for the reply is a
// known source of dropped responses.
browser.runtime.onMessage.addListener((msg: any) => {
  if (msg && msg.type === UPDATE_STATE) {
    return ready.then((s) => s.getState());
  }
  if (msg && msg.type === DISPATCH) {
    ready
      .then((s) => dispatchBridgeAction(s, backgroundActions, msg.action))
      .catch((e) => {
        cadLog(
          {
            msg: `background.onMessage DISPATCH failed: ${e}`,
            type: "error",
          },
          true
        );
      });
    return undefined;
  }
  return undefined;
});

if (browser.contextMenus) {
  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    await ready;
    await ContextMenuEvents.onContextMenuClicked(info, tab as browser.tabs.Tab);
  });
}

browser.alarms.onAlarm.addListener(async (alarm) => {
  await ready;
  if (alarm.name === AlarmEvents.ACTIVE_MODE_ALARM) {
    await AlarmEvents.runPendingCleanup();
  }
});

browser.runtime.onStartup.addListener(async () => {
  await ready;
  // Reset the per-browser-session counters exactly once per session (in MV2
  // this dispatch lived in onStartUp, which ran once per persistent page; in
  // MV3 init() runs on every wake, which would zero the counter constantly).
  store.dispatch({
    type: ReduxConstants.ON_STARTUP,
  });
  if (getSetting(store.getState(), SettingID.ACTIVE_MODE) === true) {
    if (getSetting(store.getState(), SettingID.ENABLE_GREYLIST) === true) {
      let isFFSessionRestore = false;
      const startupTabs = await browser.tabs.query({ windowType: "normal" });
      startupTabs.forEach((tab) => {
        if (tab.url === "about:sessionrestore") isFFSessionRestore = true;
      });
      if (!isFFSessionRestore) {
        greyCleanup();
      } else {
        cadLog(
          {
            msg: "Found a tab with [ about:sessionrestore ] in Firefox. Skipping Grey startup cleanup this time.",
            type: "info",
          },
          getSetting(store.getState(), SettingID.DEBUG_MODE) === true
        );
      }
    } else {
      cadLog(
        {
          msg: "GreyList Cleanup setting is disabled.  Not cleaning cookies on startup.",
          type: "info",
        },
        getSetting(store.getState(), SettingID.DEBUG_MODE) === true
      );
    }
  }
  await checkIfProtected(store.getState());
});

browser.runtime.onInstalled.addListener(async (details) => {
  await ready;
  // A fresh install or an update also (re)starts the background context, so
  // treat it like a session start for the counters.
  store.dispatch({
    type: ReduxConstants.ON_STARTUP,
  });
  await checkIfProtected(store.getState());
  switch (details.reason) {
    case "install":
      await browser.runtime.openOptionsPage();
      break;
    case "update":
      // Validate Settings to get new settings (if any).
      store.dispatch<any>(validateSettings());
      if (convertVersionToNumber(details.previousVersion) < 350) {
        // Migrate State Setting Name localstorageCleanup to localStorageCleanup
        if (store.getState().settings[SettingID.CLEANUP_LOCALSTORAGE_OLD]) {
          store.dispatch({
            payload: {
              name: SettingID.CLEANUP_LOCALSTORAGE,
              value: store.getState().settings[
                SettingID.CLEANUP_LOCALSTORAGE_OLD
              ].value as boolean,
            },
            type: ReduxConstants.UPDATE_SETTING,
          });
        }
        // Migrate Expression Option 'cleanLocalStorage' to cleanSiteData: [ LocalStorage ]
        Object.values(store.getState().lists).forEach((list) => {
          list.forEach((exp) => {
            // Only migrate if cleanSiteData array is undefined/empty.
            if (exp.cleanLocalStorage && !exp.cleanSiteData) {
              store.dispatch({
                payload: {
                  ...exp,
                  cleanSiteData: [SiteDataType.LOCALSTORAGE],
                },
                type: ReduxConstants.UPDATE_EXPRESSION,
              });
            }
          });
        });
        // Migrate Settings [uncheck 'Keep LocalStorage' on New [GREY/WHITE] Expressions]
        // Only does this if either was checked.
        for (const lt of [ListType.GREY, ListType.WHITE]) {
          if (
            getSetting(
              store.getState(),
              `${lt.toLowerCase()}CleanLocalstorage` as SettingID
            )
          ) {
            const containers = new Set<string>(
              Object.keys(store.getState().lists)
            );
            containers.add("default");
            if (getSetting(store.getState(), SettingID.CONTEXTUAL_IDENTITIES)) {
              const contextualIdentitiesObjects =
                await browser.contextualIdentities.query({});
              contextualIdentitiesObjects.forEach((c) =>
                containers.add(c.cookieStoreId)
              );
            }
            containers.forEach((list) => {
              store.dispatch({
                payload: {
                  expression: `_Default:${lt}`,
                  cleanSiteData: [SiteDataType.LOCALSTORAGE],
                  listType: lt,
                  storeId: list,
                },
                type: ReduxConstants.ADD_EXPRESSION,
              });
            });
          }
        }
      }
      if (convertVersionToNumber(details.previousVersion) < 300) {
        store.dispatch({
          type: ReduxConstants.RESET_COOKIE_DELETED_COUNTER,
        });
      }
      if (getSetting(store.getState(), SettingID.ENABLE_NEW_POPUP)) {
        await browser.runtime.openOptionsPage();
      }
      break;
    default:
      break;
  }
});
