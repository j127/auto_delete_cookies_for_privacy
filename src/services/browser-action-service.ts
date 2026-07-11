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

import { ListType, SettingID } from "@/typings/enums";
import { getHostname, returnMatchedExpressionObject } from "./libs";

// A tab can close between the event that captured it and these paint calls
// (TabEvents.onTabUpdate delays actions by ~750 ms, and the cookie fetch adds
// more). Chromium then rejects with "No tab with id: N" — there is nothing
// left to paint, so that specific rejection is dropped. Anything else is
// re-thrown asynchronously so real failures still surface.
const isMissingTabError = (e: unknown): boolean =>
  /No tab with id/.test(String(e));

const ignoreMissingTab = (result: Promise<unknown> | void): void => {
  Promise.resolve(result).catch((e) => {
    if (!isMissingTabError(e)) throw e;
  });
};

// Show the # of cookies in icon
export const showNumberOfCookiesInIcon = (
  tab: browser.tabs.Tab,
  cookieLength: number
): void => {
  if (browser.action.setBadgeText) {
    ignoreMissingTab(
      browser.action.setBadgeText({
        tabId: tab.id,
        text: `${cookieLength === 0 ? "" : cookieLength.toString()}`,
      })
    );
  }
  if (browser.action.setBadgeTextColor) {
    ignoreMissingTab(
      browser.action.setBadgeTextColor({
        color: "white",
        tabId: tab.id,
      })
    );
  }
};

// Set BrowserAction Title with number of cookies in square brackets.
export const showNumberOfCookiesInTitle = async (
  tab: browser.tabs.Tab,
  otherInfo: {
    cookieLength?: number;
    listType?: string;
  }
): Promise<void> => {
  const mf = browser.runtime.getManifest();
  const tabTitle = `${mf.name} ${mf.version}`;

  let curTitle: string;
  try {
    curTitle = await browser.action.getTitle({
      tabId: tab.id,
    });
  } catch (e) {
    // The tab closed while this paint was queued; skip it entirely.
    if (isMissingTabError(e)) return;
    throw e;
  }
  const curData = /\[(.*)] \((\d*)\)/.exec(curTitle);
  const newData = {
    // ?? not ||: a fresh count of 0 is authoritative and must replace a
    // stale non-zero count parsed back out of the current title (#101).
    cookies: otherInfo.cookieLength ?? ((curData && curData[2]) || 0),
    list: otherInfo.listType || (curData && curData[1]) || "NO LIST",
  };

  ignoreMissingTab(
    browser.action.setTitle({
      tabId: tab.id,
      title: `${tabTitle} [${newData.list}] (${newData.cookies})`,
    })
  );
};

// Set Badge Color accordingly (to matching list)
const setBadgeColor = (tab: browser.tabs.Tab, color = "default") => {
  const badgeBackgroundColor: { [key: string]: string } = {
    default: "blue",
    red: "red",
    yellow: "#e6a32e",
  };
  if (browser.action.setBadgeBackgroundColor) {
    ignoreMissingTab(
      browser.action.setBadgeBackgroundColor({
        color: badgeBackgroundColor[color],
        tabId: tab.id,
      })
    );
  }
};

// Set Background icon color and badgeBackgroundColor accordingly.
const setIconColor = (
  tab: browser.tabs.Tab,
  keepDefault = false,
  color = "default"
) => {
  if (browser.action.setIcon) {
    ignoreMissingTab(
      browser.action.setIcon({
        path: {
          48: `/icons/icon_48${
            keepDefault || color === "default" ? "" : `_${color}`
          }.png`,
        },
        tabId: tab.id,
      })
    );
  }

  setBadgeColor(tab, color);
};

// Set background icon for browser.
export const setGlobalIcon = async (enabled: boolean): Promise<void> => {
  // This sets global icon
  if (browser.action.setIcon) {
    // Set Global Icon
    await browser.action.setIcon({
      path: {
        48: `/icons/icon_48${enabled ? "" : "_greyscale"}.png`,
      },
    });

    const tabAwait = await browser.tabs.query({
      windowType: "normal",
    });
    for (const tab of tabAwait) {
      if (tab.id !== browser.tabs.TAB_ID_NONE) {
        // Not awaited: a tab that closed since the query must neither
        // reject this whole function nor stop the remaining tabs from
        // being repainted.
        ignoreMissingTab(
          browser.action.setIcon({
            path: {
              48: `/icons/icon_48${enabled ? "" : "_greyscale"}.png`,
            },
            tabId: tab.id,
          })
        );
      }
    }
  }
};

// Check if the site is protected and adjust the icon and titles appropriately
export const checkIfProtected = async (
  state: State,
  tab: browser.tabs.Tab | undefined = undefined,
  cookieLength?: number
): Promise<void> => {
  const active = state.settings[SettingID.ACTIVE_MODE].value as boolean;
  let activeTabs: browser.tabs.Tab[] = [];

  if (tab) {
    activeTabs.push(tab);
  } else {
    // No tab provided - re-evaluate every normal tab, not just the active
    // ones. Expression and settings changes (popup keeps, context-menu adds,
    // removals) must also repaint background tabs of the same site (#263).
    activeTabs = await browser.tabs.query({
      windowType: "normal",
    });
  }

  activeTabs.forEach((aTab) => {
    const matchedExpression = returnMatchedExpressionObject(
      state,
      aTab.cookieStoreId || "default",
      getHostname(aTab.url || "")
    );

    if (matchedExpression) {
      showNumberOfCookiesInTitle(aTab, {
        listType: matchedExpression.listType,
        cookieLength,
      });
    } else {
      showNumberOfCookiesInTitle(aTab, {
        listType: "NO LIST",
        cookieLength,
      });
    }

    if (matchedExpression) {
      switch (matchedExpression.listType) {
        case ListType.WHITE:
          if (active) {
            setIconColor(aTab);
          } else {
            setBadgeColor(aTab);
          }
          break;
        case ListType.GREY:
          if (active) {
            setIconColor(
              aTab,
              state.settings[SettingID.KEEP_DEFAULT_ICON].value as boolean,
              "yellow"
            );
          } else {
            setBadgeColor(aTab, "yellow");
          }
          break;
        default:
          if (active) {
            setIconColor(
              aTab,
              state.settings[SettingID.KEEP_DEFAULT_ICON].value as boolean,
              "red"
            );
          } else {
            setBadgeColor(aTab, "red");
          }
          break;
      }
    } else {
      if (cookieLength !== undefined && cookieLength === 0) {
        if (active) {
          setIconColor(aTab);
        } else {
          setBadgeColor(aTab);
        }
      } else {
        if (active) {
          setIconColor(
            aTab,
            state.settings[SettingID.KEEP_DEFAULT_ICON].value as boolean,
            "red"
          );
        } else {
          setBadgeColor(aTab, "red");
        }
      }
    }
  });
};
