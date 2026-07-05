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

interface CleanupProperties {
  greyCleanup: boolean;
  ignoreOpenTabs: boolean;
}

type ActivityLog = {
  dateTime: string;
  recentlyCleaned: number;
  storeIds: {
    [storeId: string]: CleanReasonObject[];
  };
  browsingDataCleanup?: {
    [siteDataType in SiteDataType]?: string[];
  };
  siteDataCleaned: boolean;
};

interface CleanupPropertiesInternal extends CleanupProperties {
  openTabDomains: { [k: string]: string[] };
}

// The enums live in ./enums.ts as real runtime objects (Bun.build cannot
// inline ambient const enums); these aliases keep the names usable in TYPE
// positions without imports. VALUE usage requires importing from enums.
declare type ReasonKeep = import("./enums").ReasonKeep;
declare type ReasonClean = import("./enums").ReasonClean;
declare type OpenTabStatus = import("./enums").OpenTabStatus;

interface CleanReasonObject {
  cached: boolean;
  cleanCookie: boolean;
  reason: ReasonKeep | ReasonClean;
  openTabStatus: OpenTabStatus;
  expression?: Expression;
  cookie: CookiePropertiesCleanup;
}

interface CookiePropertiesCleanup extends browser.cookies.CookieProperties {
  mainDomain: string;
  hostname: string;
  preparedCookieDomain: string;
}
