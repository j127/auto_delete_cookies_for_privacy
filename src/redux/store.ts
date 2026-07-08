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
/* istanbul ignore file: Redux stuff.*/

import { configureStore } from "@reduxjs/toolkit";
import { ReduxConstants } from "@/typings/redux-constants";
import {
  addExpression,
  clearActivities,
  clearExpressions,
  cookieCleanup,
  removeActivity,
  removeExpression,
  removeList,
  resetAll,
  resetCookieDeletedCounter,
  resetSettings,
  updateExpression,
  updateSetting,
} from "./actions";
import { BackgroundActionsMap } from "./store-bridge";
import reducer from "./reducers";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const consoleMessages = (store: any) => (next: any) => (action: any) => {
  // console.log(
  //   `dispatching action => ${action.type}
  // payload => ${JSON.stringify(action.payload)}`,
  // );

  return next(action);
};

// Map from serialized UI action types to the background action creators the
// store bridge dispatches (previously handed to redux-webext's
// createBackgroundStore).
export const backgroundActions: {
  [key in ReduxConstants]?: any;
} & BackgroundActionsMap = {
  ADD_EXPRESSION: addExpression,
  CLEAR_ACTIVITY_LOG: clearActivities,
  CLEAR_EXPRESSIONS: clearExpressions,
  COOKIE_CLEANUP: cookieCleanup,
  REMOVE_ACTIVITY_LOG: removeActivity,
  REMOVE_EXPRESSION: removeExpression,
  REMOVE_LIST: removeList,
  RESET_ALL: resetAll,
  RESET_COOKIE_DELETED_COUNTER: resetCookieDeletedCounter,
  RESET_SETTINGS: resetSettings,
  UPDATE_EXPRESSION: updateExpression,
  UPDATE_SETTING: updateSetting,
};

const createStore = (state: Partial<State> = {}) => {
  // RTK's default middleware bundles the thunk middleware that used to come
  // from the redux-thunk dependency. An empty preloaded state is valid at
  // runtime (every slice reducer supplies its own default), hence the cast.
  return configureStore({
    reducer,
    preloadedState: state as State,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(consoleMessages),
  });
};

// Derived store/dispatch types keep RTK's thunk-aware dispatch, so callers
// don't need the store.dispatch<any>() casts the old downcast to
// Store<State, ReduxAction> forced everywhere.
export type AppStore = ReturnType<typeof createStore>;
export type AppDispatch = AppStore["dispatch"];

export default createStore;
