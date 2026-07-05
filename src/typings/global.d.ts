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

declare module "*.json";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
declare const global: any;

// The enums live in ./enums.ts as real runtime objects (Bun.build cannot
// inline ambient const enums the way ts-loader/ts-jest did). These aliases
// keep the names usable in TYPE positions without imports; VALUE usage
// (Enum.MEMBER) requires importing from src/typings/enums.
declare type SiteDataType = import("./enums").SiteDataType;
declare type SettingID = import("./enums").SettingID;
declare type ListType = import("./enums").ListType;
declare type EventListenerAction = import("./enums").EventListenerAction;

type StoreIdToExpressionList = Readonly<{
  [storeId: string]: ReadonlyArray<Expression>;
}>;

type MapToSettingObject = Readonly<{ [setting: string]: Setting }>;

type CacheMap = Readonly<{ [key: string]: any }>;

type GetState = () => State;

type State = Readonly<{
  lists: StoreIdToExpressionList;
  cookieDeletedCounterTotal: number;
  cookieDeletedCounterSession: number;
  settings: MapToSettingObject;
  activityLog: ReadonlyArray<ActivityLog>;
  cache: CacheMap;
}>;

type Expression = Readonly<{
  expression: string;
  cleanAllCookies?: boolean;
  // Deprecated as of 3.5.0, but kept for backwards-compatibility for pre-3.4.0.
  cleanLocalStorage?: boolean;
  cleanSiteData?: SiteDataType[];
  listType: ListType;
  storeId: string;
  id?: string;
  cookieNames?: string[];
}>;

type Setting = Readonly<{
  id?: string | number;
  name: string;
  value: boolean | number | string;
}>;

interface ReleaseNote {
  readonly version: string;
  readonly notes: string[];
}

type CookieCountMsg = Readonly<{
  popupHostname?: string;
  cookieUpdated?: boolean;
}>;

type ADCPLogItem = Readonly<{
  type?: string;
  level?: number;
  msg?: string;
  x?: any;
}>;

type JestSpyObject = { [s: string]: jest.SpyInstance };
