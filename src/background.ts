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

// Must be the first import: provides the `browser` global that MV2 supplied
// via script tags (see src/init-globals.ts).
import { ListType, SettingID, SiteDataType } from "./typings/enums";
import "./init-globals";

import { cookieCleanup, validateSettings } from "./redux/actions";
import createStore, { backgroundActions, type AppStore } from "./redux/store";
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
  adcpLog,
  convertVersionToNumber,
  extractMainDomain,
  getSetting,
} from "./services/libs";
import ContextualIdentityEvents from "./services/contextual-identity-events";
import StoreUser from "./services/store-user";
import TabEvents from "./services/tab-events";
import { ReduxConstants } from "./typings/redux-constants";
import SettingService from "./services/setting-service";

let store: AppStore;

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
const init = async (): Promise<AppStore> => {
  const storage = await browser.storage.local.get();
  let stateFromStorage;
  try {
    if (storage.state) {
      stateFromStorage = JSON.parse(storage.state as string);
    } else {
      stateFromStorage = {};
    }
  } catch {
    stateFromStorage = {};
  }
  store = createStore(stateFromStorage);

  // This is important to initialize the Store for all classes that extend from this
  StoreUser.init(store);

  SettingService.init();
  store.subscribe(SettingService.onSettingsChange);
  store.subscribe(saveToStorage);

  store.dispatch(validateSettings());

  // Rehydrate the per-session tab->domain cache and re-arm any pending
  // delayed cleanup that was scheduled before the worker was suspended.
  await TabEvents.hydrateFromSession();
  await AlarmEvents.recoverPendingCleanup();

  // Container name/color cache (Firefox only; inert on Chrome). Runs on
  // every start: session-hydrate first, then live refresh.
  await ContextualIdentityEvents.init();

  // Cosmetic/optional initialization must never take the whole worker down:
  // if `ready` rejects, every event handler and the UI store bridge die with
  // it (that's exactly how a bad icon path once turned into blank popup and
  // settings pages). Cookie cleanup works without icons or menus.
  try {
    await setGlobalIcon(
      getSetting(store.getState(), SettingID.ACTIVE_MODE) as boolean
    );

    await checkIfProtected(store.getState());

    if (browser.contextMenus) {
      await ContextMenuEvents.menuInit();
    }
  } catch (e) {
    adcpLog(
      {
        msg: `background.init: non-critical initialization failed (icons/menus): ${e}`,
        type: "error",
      },
      true
    );
  }

  adcpLog(
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
const ready: Promise<AppStore> = init();

// Make an init failure loud in the worker console. This taps a separate
// promise branch: handlers awaiting `ready` still observe the rejection.
ready.catch((e) => {
  // eslint-disable-next-line no-console
  console.error("background.init failed; the extension cannot operate:", e);
});

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
    if (!p.name.startsWith("popupADCP_")) return;
    const pn = p.name.slice(9).split(",");
    if (pn[0].endsWith(changeInfo.cookie.domain) || pn[0].endsWith(cDomain)) {
      p.postMessage({ cookieUpdated: true });
    }
  });
}

function handleConnect(p: browser.runtime.Port) {
  if (!p.name || !p.name.startsWith("popupADCP_")) return;
  p.onMessage.addListener((m) => {
    adcpLog(
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
    adcpLog(
      {
        msg: `background.greyCleanup:  dispatching browser restart greyCleanup.`,
      },
      getSetting(store.getState(), SettingID.DEBUG_MODE) as boolean
    );
    store.dispatch(
      cookieCleanup({
        greyCleanup: true,
        ignoreOpenTabs: getSetting(
          store.getState(),
          SettingID.CLEAN_OPEN_TABS_STARTUP
        ) as boolean,
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
        adcpLog(
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

// Firefox containers. The API object does not exist on Chrome, so the
// guard keeps the Chrome build listener-free here; registration itself is
// synchronous at the top level as the event page requires.
if (browser.contextualIdentities) {
  browser.contextualIdentities.onCreated.addListener(async (changeInfo) => {
    await ready;
    await ContextualIdentityEvents.onCreated(changeInfo);
  });
  browser.contextualIdentities.onUpdated.addListener(async (changeInfo) => {
    await ready;
    await ContextualIdentityEvents.onUpdated(changeInfo);
  });
  browser.contextualIdentities.onRemoved.addListener(async (changeInfo) => {
    await ready;
    await ContextualIdentityEvents.onRemoved(changeInfo);
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
      greyCleanup();
    } else {
      adcpLog(
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
      store.dispatch(validateSettings());
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
