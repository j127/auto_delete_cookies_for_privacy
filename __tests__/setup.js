/**
 * Copyright (c) 2017-2022 Kenneth Tran and CAD Team (https://github.com/Cookie-AutoDelete/Cookie-AutoDelete/graphs/contributors)
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

/**
 * This setup file for jest testing essentially mimics the
 * browser WebExtension APIs with jest mock functions.
 *
 * Use global.browser for testing for calls to webextension API.
 * If you are expecting values to be returned, use jest-when
 *   e.g. when(global.browser.i18n.getMessage)
 *          .calledWith(expect.any(String), expect.any(Array))
 *          .mockReturnValue('translated');
 * to have it return a value depending on the input received.
 */
"use strict";

// event listeners
const eventListeners = {
  addListener: jest.fn(),
  clearListeners: jest.fn(),
  hasListener: jest.fn(),
  removeListener: jest.fn(),
};

// storage functions
const storageArea = {
  storage: {},
  get: jest.fn(),
  set: jest.fn(),
  remove: jest.fn(),
  clear: jest.fn(),
};

// storage.session gets its OWN mock instance: local/managed/sync share
// storageArea, and reusing it for session would make session-persistence
// assertions cross-talk with storage.local assertions.
const sessionStorageArea = {
  storage: {},
  get: jest.fn(),
  set: jest.fn(),
  remove: jest.fn(),
  clear: jest.fn(),
};

const apis = {
  // MV3 API surface: action replaced browserAction, alarms gained onAlarm
  // usage, and scripting replaced tabs.executeScript.
  action: {
    fn: [
      "getBadgeText",
      "getTitle",
      "setBadgeBackgroundColor",
      "setBadgeText",
      "setBadgeTextColor",
      "setIcon",
      "setTitle",
    ],
    events: ["onClicked"],
  },
  alarms: {
    fn: ["clear", "clearAll", "create", "get", "getAll"],
    events: ["onAlarm"],
  },
  browsingData: {
    fn: [
      "remove",
      "removeCache",
      "removeCookies",
      "removeDownloads",
      "removeFormData",
      "removeLocalStorage",
      "removePluginData",
    ],
  },
  cookies: {
    fn: ["get", "getAll", "getAllCookieStores", "remove", "set"],
    events: ["onChanged"],
  },
  i18n: {
    fn: ["getMessage"],
  },
  contextMenus: {
    fn: ["create", "refresh", "remove", "removeAll", "update"],
    events: ["onClicked"],
  },
  // Firefox-only container API; Chrome-flavored suites never call it (the
  // Gecko-flavored mock layer will build on this).
  contextualIdentities: {
    fn: ["create", "get", "move", "query", "remove", "update"],
    events: ["onCreated", "onRemoved", "onUpdated"],
  },
  notifications: {
    fn: ["clear", "create", "getAll", "update"],
    events: ["onClicked", "onClosed"],
  },
  pageAction: {
    fn: [
      "getPopup",
      "getTitle",
      "hide",
      "setIcon",
      "setPopup",
      "setTitle",
      "show",
    ],
    events: ["onClicked"],
  },
  permissions: {
    fn: ["contains", "getAll", "remove", "request"],
    events: ["onAdded", "onRemoved"],
  },
  runtime: {
    fn: [
      "connect",
      "getBackgroundPage",
      "getManifest",
      "getURL",
      "openOptionsPage",
      "reload",
      "sendMessage",
    ],
    events: ["onConnect", "onInstalled", "onMessage", "onStartup"],
  },
  scripting: {
    fn: ["executeScript"],
  },
  tabs: {
    fn: [
      "connect",
      "create",
      "executeScript",
      "get",
      "getCurrent",
      "query",
      "reload",
      "sendMessage",
      "update",
    ],
    events: ["onDetached", "onRemoved", "onSelectionChanged", "onUpdated"],
  },
  webRequest: {
    events: [
      "onCompleted",
      "onErrorOccurred",
      "onHeadersReceived",
      "onResponseStarted",
    ],
  },
};

const browser = {
  extension: {
    isAllowedIncognitoAccess: jest.fn(),
    lastError: undefined,
  },
  storage: {
    local: storageArea,
    managed: storageArea,
    onChanged: eventListeners,
    session: sessionStorageArea,
    sync: storageArea,
  },
};

// Add in rest of webextension functions
Object.keys(apis).forEach((api) => {
  if (!browser[api]) {
    browser[api] = {};
  }
  Object.keys(apis[api]).forEach((a) => {
    if (a === "events") {
      apis[api][a].forEach((ev) => {
        // e.g. browser.cookies.onChanged = eventListeners;
        browser[api][ev] = eventListeners;
      });
    } else if (a === "fn") {
      apis[api][a].forEach((fn) => {
        // e.g. browser.cookies.getAll = jest.fn();
        browser[api][fn] = jest.fn();
      });
    } else {
      throw new Error(`Unknown browser webextension init:  ${a}`);
    }
  });
});

global.browser = browser;
global.chrome = browser;

/**
 * This hides the test console debug logs from jest results.
 */
global.console = {
  _error: console.error, // eslint-disable-line no-console
  _debug: console.debug, // eslint-disable-line no-console
  _info: console.info, // eslint-disable-line no-console
  _log: console.log, // eslint-disable-line no-console
  _warn: console.warn, // eslint-disable-line no-console
  error: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  log: jest.fn(),
  warn: jest.fn(),
};

/**
 * Generate Jest Mock Spies for a given class.
 * @param parent The class to spy on.
 * @returns {{}} an object which contains the generated spy functions
 */
function generateSpies(parent) {
  const spyParent = {};
  for (const k of Object.keys(parent)) {
    try {
      if (!spyParent[k]) spyParent[k] = jest.spyOn(parent, k);
    } catch {
      // Most likely not a function
    }
  }
  return spyParent;
}
global.generateSpies = generateSpies;
