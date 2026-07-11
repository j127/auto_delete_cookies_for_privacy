/**
 * Copyright (c) 2020-2022 Kenny Do and CAD Team (https://github.com/Cookie-AutoDelete/Cookie-AutoDelete/graphs/contributors)
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

import {
  EventListenerAction,
  ListType,
  SettingID,
  SiteDataType,
} from "@/typings/enums";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { when } from "jest-when";
import { initialState } from "@/redux/state";
import {
  adcpLog,
  convertVersionToNumber,
  createPartialTabInfo,
  eventListenerActions,
  extractMainDomain,
  getAllCookiesForDomain,
  getContainerExpressionDefault,
  getHostname,
  getMatchedExpressions,
  getPort,
  getSearchResults,
  getSetting,
  getStoreId,
  globExpressionToRegExp,
  isAnIP,
  isAWebpage,
  localFileToRegex,
  matchIPInExpression,
  parseCookieStoreId,
  prepareCleanupDomains,
  prepareCookieDomain,
  returnMatchedExpressionObject,
  showNotification,
  sleep,
  throwErrorNotification,
  trimDot,
  undefinedIsTrue,
  dedupeCookies,
  prepareCleanupHostnames,
  prepareCleanupScope,
  topLevelSiteCandidates,
  validateExpressionDomain,
  withAllPartitions,
  withAnyFirstPartyDomain,
} from "@/services/libs";

import ipaddr from "ipaddr.js";

const mockCookie: browser.cookies.Cookie = {
  domain: "domain.com",
  hostOnly: true,
  httpOnly: true,
  name: "blah",
  path: "/",
  sameSite: "no_restriction",
  secure: true,
  session: true,
  storeId: "default",
  value: "test value",
};

describe("Library Functions", () => {
  describe("adcpLog()", () => {
    beforeAll(() => {
      when(global.browser.runtime.getManifest)
        .calledWith()
        .mockReturnValue({ version: "0.12.34" });
    });

    const origDebug = console.debug; // eslint-disable-line no-console
    const origError = console.error; // eslint-disable-line no-console
    const origInfo = console.info; // eslint-disable-line no-console
    const origLog = console.log; // eslint-disable-line no-console
    const origWarn = console.warn; // eslint-disable-line no-console

    afterEach(() => {
      console.debug = origDebug; // eslint-disable-line no-console
      console.error = origError; // eslint-disable-line no-console
      console.info = origInfo; // eslint-disable-line no-console
      console.log = origLog; // eslint-disable-line no-console
      console.warn = origWarn; // eslint-disable-line no-console
    });

    const consoleOutput = [] as { type: string; msg: string }[];
    const mockedDebug = (msg: string) =>
      consoleOutput.push({ type: "debug", msg });
    const mockedError = (msg: string) =>
      consoleOutput.push({ type: "error", msg });
    const mockedInfo = (msg: string) =>
      consoleOutput.push({ type: "info", msg });
    const mockedLog = (msg: string) => consoleOutput.push({ type: "log", msg });
    const mockedWarn = (msg: string) =>
      consoleOutput.push({ type: "warn", msg });

    beforeEach(() => {
      console.debug = mockedDebug; // eslint-disable-line no-console
      console.error = mockedError; // eslint-disable-line no-console
      console.info = mockedInfo; // eslint-disable-line no-console
      console.log = mockedLog; // eslint-disable-line no-console
      console.warn = mockedWarn; // eslint-disable-line no-console
      consoleOutput.length = 0;
    });

    it("should do nothing if output=false", () => {
      expect.assertions(1);
      adcpLog({ msg: "nothing" }, false);
      expect(consoleOutput.length).toBe(0);
    });

    it("should format the Log Header with manifest version", () => {
      expect.assertions(1);
      adcpLog({ msg: "headerTest" }, true);
      expect(consoleOutput).toEqual([
        { type: "debug", msg: "ADCP_0.12.34 - debug - headerTest\n" },
      ]);
    });

    it("should output to debug when no type is given", () => {
      expect.assertions(1);
      adcpLog({ msg: "noType" }, true);
      expect(consoleOutput).toEqual([
        { type: "debug", msg: "ADCP_0.12.34 - debug - noType\n" },
      ]);
    });
    it("should output to debug when type is debug", () => {
      expect.assertions(1);
      adcpLog({ type: "debug", msg: "debugType" }, true);
      expect(consoleOutput).toEqual([
        { type: "debug", msg: "ADCP_0.12.34 - debug - debugType\n" },
      ]);
    });
    it("should output to error when type is error", () => {
      expect.assertions(1);
      adcpLog({ type: "error", msg: "errorType" }, true);
      expect(consoleOutput).toEqual([
        { type: "error", msg: "ADCP_0.12.34 - error - errorType\n" },
      ]);
    });
    it("should output to info when type is info", () => {
      expect.assertions(1);
      adcpLog({ type: "info", msg: "infoType" }, true);
      expect(consoleOutput).toEqual([
        { type: "info", msg: "ADCP_0.12.34 - info - infoType\n" },
      ]);
    });
    it("should output to log when type is log", () => {
      expect.assertions(1);
      adcpLog({ type: "log", msg: "logType" }, true);
      expect(consoleOutput).toEqual([
        { type: "log", msg: "ADCP_0.12.34 - log - logType\n" },
      ]);
    });
    it("should output to warn when type is warn", () => {
      expect.assertions(1);
      adcpLog({ type: "warn", msg: "warnType" }, true);
      expect(consoleOutput).toEqual([
        { type: "warn", msg: "ADCP_0.12.34 - warn - warnType\n" },
      ]);
    });
    it("should default back to debug type when invalid type is given", () => {
      expect.assertions(1);
      adcpLog({ type: "invalid", msg: "invalidType" }, true);
      expect(consoleOutput).toEqual([
        {
          type: "error",
          msg: "ADCP_0.12.34 - Invalid Console Output Type given [ invalid ].  Using [debug] instead.",
        },
        { type: "debug", msg: "ADCP_0.12.34 - debug - invalidType\n" },
      ]);
    });

    it("should display supplied string accordingly", () => {
      expect.assertions(1);
      adcpLog({ msg: "withObject", x: "test." }, true);
      expect(consoleOutput).toEqual([
        { type: "debug", msg: "ADCP_0.12.34 - debug - withObject\ntest." },
      ]);
    });

    it("should attempt to parse function as string for display", () => {
      expect.assertions(1);
      adcpLog({ msg: "objectFunction", x: RegExp.toString }, true);
      expect(consoleOutput).toEqual([
        {
          type: "warn",
          msg: "ADCP_0.12.34 - Received unexpected typeof [ function ].  Attempting to display it...",
        },
        {
          type: "debug",
          msg: "ADCP_0.12.34 - debug - objectFunction\nfunction toString() { [native code] }",
        },
      ]);
    });

    it("should parse object for display", () => {
      expect.assertions(1);
      adcpLog({ msg: "objectString", x: { a: "abc" } }, true);
      expect(consoleOutput).toEqual([
        {
          type: "debug",
          msg: 'ADCP_0.12.34 - debug - objectString\n{\n  "a": "abc"\n}',
        },
      ]);
    });

    it("should parse number as string.", () => {
      expect.assertions(1);
      adcpLog({ msg: "numberString", x: 123 }, true);
      expect(consoleOutput).toEqual([
        { type: "debug", msg: "ADCP_0.12.34 - debug - numberString\n123" },
      ]);
    });

    it("should parse boolean as string.", () => {
      expect.assertions(1);
      adcpLog({ msg: "booleanString", x: true }, true);
      expect(consoleOutput).toEqual([
        { type: "debug", msg: "ADCP_0.12.34 - debug - booleanString\ntrue" },
      ]);
    });

    it("should parse string as string.", () => {
      expect.assertions(1);
      adcpLog({ msg: "stringString", x: "test" }, true);
      expect(consoleOutput).toEqual([
        { type: "debug", msg: "ADCP_0.12.34 - debug - stringString\ntest" },
      ]);
    });

    it("should parse undefined as empty string.", () => {
      expect.assertions(1);
      adcpLog({ msg: "undefinedString", x: undefined }, true);
      expect(consoleOutput).toEqual([
        { type: "debug", msg: "ADCP_0.12.34 - debug - undefinedString\n" },
      ]);
    });

    it("should not output to console on empty input object (no message), even if output=true", () => {
      expect.assertions(1);
      adcpLog({}, true);
      expect(consoleOutput.length).toEqual(0);
    });
  });

  describe("convertVersionToNumber()", () => {
    it("should return 123 from 1.2.3", () => {
      const results = convertVersionToNumber("1.2.3");
      expect(results).toEqual(123);
    });
    it("should return -1 from ()", () => {
      const results = convertVersionToNumber();
      expect(results).toEqual(-1);
    });
    it("should return 300 from 3.0.0", () => {
      const results = convertVersionToNumber("3.0.0");
      expect(results).toEqual(300);
    });
  });

  describe("createPartialTabInfo()", () => {
    const testTab: Partial<browser.tabs.Tab> = {
      active: true,
      cookieStoreId: "default",
      discarded: false,
      height: 123,
      hidden: false,
      highlighted: false,
      id: 1,
      incognito: false,
      index: 0,
      pinned: false,
      status: "complete",
      title: "TabTitle",
      url: "https://test.cad",
      width: 321,
      windowId: 1,
    };
    it("should extract information relevant to debug from a tab with a cookieStoreId", () => {
      expect(createPartialTabInfo(testTab)).toMatchObject({
        cookieStoreId: "default",
        discarded: false,
        id: 1,
        incognito: false,
        status: "complete",
        url: "https://test.cad",
        windowId: 1,
      });
    });
    it("should extract information relevant to debug from a tab without a cookieStoreId", () => {
      expect(
        createPartialTabInfo({ ...testTab, cookieStoreId: undefined })
      ).toMatchObject({
        discarded: false,
        id: 1,
        incognito: false,
        status: "complete",
        url: "https://test.cad",
        windowId: 1,
      });
    });
  });

  describe("eventListenerActions()", () => {
    it("should do nothing if an event was not passed in", () => {
      expect(() => {
        eventListenerActions(
          undefined as any,
          Function,
          EventListenerAction.ADD
        );
      }).not.toThrowError();
      // Unexpected error would be TypeError: "cannot read property 'hasListener' of undefined"
    });

    it('should do nothing if an "event" passed in is not an Event Listener', () => {
      expect(() => {
        eventListenerActions({} as any, Function, EventListenerAction.REMOVE);
      }).not.toThrowError();
    });

    it("should add the event listener", () => {
      eventListenerActions(
        browser.cookies.onChanged,
        Function,
        EventListenerAction.ADD
      );
      expect(
        global.browser.cookies.onChanged.addListener
      ).toHaveBeenCalledTimes(1);
    });

    it("should not add the event listener again if it already exists", () => {
      when(global.browser.cookies.onChanged.hasListener)
        .calledWith(expect.any(Function))
        .mockReturnValue(true);
      eventListenerActions(
        browser.cookies.onChanged,
        Function,
        EventListenerAction.ADD
      );
      expect(
        global.browser.cookies.onChanged.addListener
      ).not.toHaveBeenCalled();
    });

    it("should remove the listener", () => {
      when(global.browser.cookies.onChanged.hasListener)
        .calledWith(expect.any(Function))
        .mockReturnValue(true);
      eventListenerActions(
        browser.cookies.onChanged,
        Function,
        EventListenerAction.REMOVE
      );
      expect(
        global.browser.cookies.onChanged.removeListener
      ).toHaveBeenCalledTimes(1);
    });

    it("should not remove a non-existent listener", () => {
      when(global.browser.cookies.onChanged.hasListener)
        .calledWith(expect.any(Function))
        .mockReturnValue(false);
      eventListenerActions(
        browser.cookies.onChanged,
        Function,
        EventListenerAction.REMOVE
      );
      expect(
        global.browser.cookies.onChanged.removeListener
      ).not.toHaveBeenCalled();
    });
  });

  describe("extractMainDomain()", () => {
    it("should return itself from file:///home/user/file.html", () => {
      expect(extractMainDomain("file:///home/user/file.html")).toEqual(
        "file:///home/user/file.html"
      );
    });

    it("should return workplace.com from work-12345678.workplace.com", () => {
      expect(extractMainDomain("work-12345678.workplace.com")).toEqual(
        "workplace.com"
      );
    });

    it("should return domain.com from domain.com", () => {
      expect(extractMainDomain("domain.com")).toEqual("domain.com");
    });

    it("should return domain.com from sub.domain.com", () => {
      expect(extractMainDomain("sub.domain.com")).toEqual("domain.com");
    });

    it("should return domain.com from sub.sub.domain.com", () => {
      expect(extractMainDomain("sub.sub.domain.com")).toEqual("domain.com");
    });

    it("should return domain.com from sub.sub.sub.domain.com", () => {
      expect(extractMainDomain("sub.sub.sub.domain.com")).toEqual("domain.com");
    });

    it("should return example.co.uk from sub.example.co.uk", () => {
      expect(extractMainDomain("sub.example.co.uk")).toEqual("example.co.uk");
    });

    it("should return example.co.uk. from sub.example.com.uk.", () => {
      expect(extractMainDomain("sub.example.co.uk.")).toEqual("example.co.uk.");
    });

    it("should return example.com.br from sub.example.com.br", () => {
      expect(extractMainDomain("sub.example.com.br")).toEqual("example.com.br");
    });

    it("should return the ip address from an ip address", () => {
      expect(extractMainDomain("127.0.0.1")).toEqual("127.0.0.1");
    });

    it("should return the srv-test01 from an srv-test01", () => {
      expect(extractMainDomain("srv-test01")).toEqual("srv-test01");
    });

    it("should return the test.i2p from an test.i2p", () => {
      expect(extractMainDomain("test.i2p")).toEqual("test.i2p");
    });

    it("should return domain.com. from .domain.com.", () => {
      expect(extractMainDomain(".domain.com.")).toEqual("domain.com.");
    });

    it("should return domain.com from .domain.com", () => {
      expect(extractMainDomain(".domain.com")).toEqual("domain.com");
    });

    it("should return local from local", () => {
      expect(extractMainDomain("local")).toEqual("local");
    });

    it("should return nothing on empty string", () => {
      expect(extractMainDomain("")).toEqual("");
    });

    // Real Public Suffix List behavior (audit bug 9): the old heuristic
    // handled neither multi-label public suffixes it didn't know...
    it("should return bbc.co.uk from foo.bbc.co.uk", () => {
      expect(extractMainDomain("foo.bbc.co.uk")).toEqual("bbc.co.uk");
    });

    // ...nor private platform suffixes: every *.github.io site is its own
    // registrable domain, not one shared github.io neighborhood.
    it("should return user.github.io from user.github.io", () => {
      expect(extractMainDomain("user.github.io")).toEqual("user.github.io");
    });

    it("should return user.github.io from sub.user.github.io", () => {
      expect(extractMainDomain("sub.user.github.io")).toEqual("user.github.io");
    });

    it("should keep IPv6 addresses untouched", () => {
      expect(extractMainDomain("2001:db8::1")).toEqual("2001:db8::1");
    });
  });

  describe("getAllCookiesForDomain()", () => {
    beforeAll(() => {
      // Default implementation: untrained calls (e.g. the partition-bucket
      // queries) resolve empty; the trainings below win for their args.
      global.browser.cookies.getAll.mockResolvedValue([] as never);
      when(global.browser.cookies.getAll)
        .calledWith({ storeId: "default", partitionKey: {} })
        .mockResolvedValue([
          testCookie,
          { ...testCookie, domain: "", path: "/test/" },
        ] as never);
      when(global.browser.cookies.getAll)
        .calledWith({
          domain: "domain.com",
          storeId: "default",
          partitionKey: {},
        })
        .mockResolvedValue([testCookie] as never);
    });

    const testCookie: browser.cookies.Cookie = {
      domain: "domain.com",
      hostOnly: true,
      httpOnly: true,
      name: "blah",
      path: "/",
      sameSite: "no_restriction",
      secure: true,
      session: true,
      storeId: "default",
      value: "test value",
    };

    const sampleTab: browser.tabs.Tab = {
      active: true,
      cookieStoreId: "default",
      discarded: false,
      hidden: false,
      highlighted: false,
      incognito: false,
      index: 0,
      isArticle: false,
      isInReaderMode: false,
      lastAccessed: 12345678,
      pinned: false,
      url: "https://www.example.com",
      windowId: 1,
    };

    it("should do nothing if url is an internal page", async () => {
      const result = await getAllCookiesForDomain(initialState, {
        ...sampleTab,
        url: "about:home",
      });
      const result2 = await getAllCookiesForDomain(initialState, {
        ...sampleTab,
        url: "chrome:newtab",
      });
      expect(result).toBeUndefined();
      expect(result2).toBeUndefined();
    });

    it("should do nothing if url is empty string", async () => {
      const result = await getAllCookiesForDomain(initialState, {
        ...sampleTab,
        url: "",
      });
      expect(result).toBeUndefined();
    });

    it("should do nothing if url is undefined", async () => {
      const result = await getAllCookiesForDomain(initialState, {
        ...sampleTab,
        url: undefined,
      });
      expect(result).toBeUndefined();
    });

    it("should do nothing if url is not valid", async () => {
      const result = await getAllCookiesForDomain(initialState, {
        ...sampleTab,
        url: "bad",
      });
      expect(result).toBeUndefined();
    });

    it("should work on local files", async () => {
      const result = await getAllCookiesForDomain(initialState, {
        ...sampleTab,
        url: "file:///test/file.html",
      });
      expect(result).toStrictEqual(
        expect.arrayContaining([{ ...testCookie, domain: "", path: "/test/" }])
      );
      expect(global.browser.cookies.getAll).toHaveBeenCalledWith({
        storeId: "default",
        partitionKey: {},
      });
    });

    it("should fetch cookies for the tab domain", async () => {
      const result = await getAllCookiesForDomain(initialState, {
        ...sampleTab,
        url: "https://domain.com",
      });
      expect(result).toStrictEqual([testCookie]);
      expect(global.browser.cookies.getAll).toHaveBeenCalledWith({
        domain: "domain.com",
        storeId: "default",
        partitionKey: {},
      });
      // The site's partition bucket is queried too (third-party cookies
      // partitioned under this top-level site).
      expect(global.browser.cookies.getAll).toHaveBeenCalledWith({
        partitionKey: { topLevelSite: "https://domain.com" },
        storeId: "default",
      });
    });

    it("includes the site's partition bucket in the count and dedupes overlaps", async () => {
      const bucketCookie: browser.cookies.Cookie = {
        ...testCookie,
        domain: "tracker.example",
        name: "ptrack",
        partitionKey: { topLevelSite: "https://domain.com" },
      };
      when(global.browser.cookies.getAll)
        .calledWith({
          partitionKey: { topLevelSite: "https://domain.com" },
          storeId: "default",
        })
        .mockResolvedValue([bucketCookie] as never);
      when(global.browser.cookies.getAll)
        .calledWith({
          partitionKey: { topLevelSite: "http://domain.com" },
          storeId: "default",
        })
        .mockResolvedValue([bucketCookie] as never);
      const result = await getAllCookiesForDomain(initialState, {
        ...sampleTab,
        url: "https://domain.com",
      });
      // testCookie from the domain query, bucketCookie found via BOTH
      // scheme candidates but counted once.
      expect(result).toStrictEqual([testCookie, bucketCookie]);
    });
  });

  describe("getContainerExpressionDefault()", () => {
    const mockExpression: Expression = {
      expression: "",
      listType: ListType.WHITE,
      storeId: "",
    };
    it("should return default expression if list does not contain storeId given", () => {
      expect(
        getContainerExpressionDefault(initialState, "default", ListType.WHITE)
      ).toEqual(mockExpression);
    });
    it("should return default expression if existing list does not contain default expression key", () => {
      expect(
        getContainerExpressionDefault(
          { ...initialState, lists: { default: [mockExpression] } },
          "default",
          ListType.WHITE
        )
      ).toEqual(mockExpression);
    });
    it("should return customized default expression if existing list contains default expression key", () => {
      expect(
        getContainerExpressionDefault(
          {
            ...initialState,
            lists: {
              default: [
                {
                  expression: `_Default:${ListType.WHITE}`,
                  cleanSiteData: [SiteDataType.PLUGINDATA],
                  listType: ListType.WHITE,
                  storeId: "default",
                },
              ],
            },
          },
          "default",
          ListType.WHITE
        )
      ).toEqual(
        expect.objectContaining({ cleanSiteData: [SiteDataType.PLUGINDATA] })
      );
    });
    it("should return customized default expression for non-default container if its list contains default expression key", () => {
      expect(
        getContainerExpressionDefault(
          {
            ...initialState,
            lists: {
              "container-1": [
                {
                  expression: `_Default:${ListType.WHITE}`,
                  cleanSiteData: [SiteDataType.PLUGINDATA],
                  listType: ListType.WHITE,
                  storeId: "container-1",
                },
              ],
            },
          },
          "container-1",
          ListType.WHITE
        )
      ).toEqual(
        expect.objectContaining({ cleanSiteData: [SiteDataType.PLUGINDATA] })
      );
    });
    it("should return default expression for non-default container if non-default container is missing defaults", () => {
      expect(
        getContainerExpressionDefault(
          initialState,
          "container-1",
          ListType.WHITE
        )
      ).toEqual(mockExpression);
    });
  });

  describe("getHostname()", () => {
    it("should return en.wikipedia.org from https://en.wikipedia.org/wiki/Cat", () => {
      expect(getHostname("https://en.wikipedia.org/wiki/Cat")).toEqual(
        "en.wikipedia.org"
      );
    });

    it("should return yahoo.com from http://yahoo.com", () => {
      expect(getHostname("http://yahoo.com")).toEqual("yahoo.com");
    });

    it("should return scotiaonline.scotiabank.com from https://www1.scotiaonline.scotiabank.com/online/authentication/authentication.bns", () => {
      expect(
        getHostname(
          "https://www1.scotiaonline.scotiabank.com/online/authentication/authentication.bns"
        )
      ).toEqual("scotiaonline.scotiabank.com");
    });

    it("should return mint.com from https://wwws.mint.com", () => {
      expect(getHostname("https://wwws.mint.com")).toEqual("mint.com");
    });

    it("should return file:///home/user/folder from file:///home/user/folder/file.html", () => {
      expect(getHostname("file:///home/user/folder/file.html")).toEqual(
        "file:///home/user/folder"
      );
    });

    it("should return file:///C: from file:///C:/test.html", () => {
      expect(getHostname("file:///C:/test.html")).toEqual("file:///C:");
    });

    it("should return an empty string from empty URLs", () => {
      expect(getHostname("")).toEqual("");
    });

    it("should return an empty string from invalid URLs", () => {
      expect(getHostname("test")).toEqual("");
    });
  });

  describe("getMatchedExpressions()", () => {
    const defaultExpression: Expression = {
      expression: "*.expression.com",
      listType: ListType.WHITE,
      storeId: "default",
    };
    const lists: StoreIdToExpressionList = {
      default: [
        defaultExpression,
        {
          ...defaultExpression,
          expression: "192.168.1.1",
        },
        {
          ...defaultExpression,
          expression: "fd12:3456:789a:1::1",
        },
        {
          ...defaultExpression,
          expression: "192.168.10.0/24",
        },
        {
          ...defaultExpression,
          expression: "fd12:3456:7890:1::/64",
        },
        {
          ...defaultExpression,
          expression: "192.168.10.256/22",
        },
      ],
    };
    it("should return empty array if lists have no storeId", () => {
      expect(getMatchedExpressions(lists, "test")).toEqual([]);
    });
    it("should return entire storeId list in search mode if no input was given.", () => {
      expect(getMatchedExpressions(lists, "default", undefined, true)).toEqual([
        ...lists["default"],
      ]);
    });
    it("should return entire storeId list in search mode if input was only whitespaces", () => {
      expect(getMatchedExpressions(lists, "default", "  ", true)).toEqual([
        ...lists["default"],
      ]);
    });
    it("should match nothing in match mode if no input was given (#101)", () => {
      expect(getMatchedExpressions(lists, "default")).toEqual([]);
    });
    it("should match nothing in match mode if input was only whitespaces (#101)", () => {
      expect(getMatchedExpressions(lists, "default", "  ")).toEqual([]);
    });
    it("should not match 192.168.1.1 with 0xc0.168.1.1 as not valid IPv4 Four-Part Decimal format", () => {
      // 0xc0 = 192
      expect(getMatchedExpressions(lists, "default", "0xc0.168.1.1")).toEqual(
        []
      );
    });
    it("should return expressions with matching IPv4 Address", () => {
      expect(getMatchedExpressions(lists, "default", "192.168.1.1")).toEqual([
        lists["default"][1],
      ]);
    });
    it("should return expressions with matching IPv6 Address", () => {
      expect(
        getMatchedExpressions(lists, "default", "fd12:3456:789a:1::1")
      ).toEqual([lists["default"][2]]);
    });
    it("should return expressions with matching IPv4 Address with CIDR", () => {
      expect(getMatchedExpressions(lists, "default", "192.168.10.5")).toEqual([
        lists["default"][3],
      ]);
    });
    it("should return expressions with matching IPv6 Address with CIDR", () => {
      expect(
        getMatchedExpressions(lists, "default", "fd12:3456:7890:1:5555::")
      ).toEqual([lists["default"][4]]);
    });
    it("should return partial matched expressions when searching", () => {
      expect(getMatchedExpressions(lists, "default", "express", true)).toEqual([
        lists["default"][0],
      ]);
    });
  });

  describe("getSearchResults()", () => {
    it("should return false if string is not matched", () => {
      expect(getSearchResults("*.expression.com", "test")).toEqual(false);
    });
    it("should return true if string was partially matched", () => {
      expect(getSearchResults("*.expression.com", "express")).toEqual(true);
    });
    it("should return true if string was exactly matched", () => {
      expect(getSearchResults("test", "test")).toEqual(true);
    });
    it("should return false if string is invalid regex", () => {
      expect(getSearchResults("abc(x", "abc")).toEqual(false);
    });
  });

  describe("getSetting()", () => {
    it("should return value of false for activeMode in default settings", () => {
      expect(getSetting(initialState, SettingID.ACTIVE_MODE)).toEqual(false);
    });
  });

  describe("getStoreId()", () => {
    // Default storeIds
    it("should return default from storeId 0", () => {
      expect(getStoreId("0")).toEqual("default");
    });

    it("should return default from storeId default", () => {
      expect(getStoreId("default")).toEqual("default");
    });

    // Private storeIds
    it("should return private from storeId 1 (private)", () => {
      expect(getStoreId("1")).toEqual("private");
    });

    it("should return private from storeId private", () => {
      expect(getStoreId("private")).toEqual("private");
    });

    // Firefox storeIds unify onto the same keys Chrome uses (audit bug 4:
    // upstream kept firefox-private separate from what the UI wrote, so
    // private-window whitelists never matched).
    it("should return default from storeId firefox-default", () => {
      expect(getStoreId("firefox-default")).toEqual("default");
    });

    it("should return private from storeId firefox-private", () => {
      expect(getStoreId("firefox-private")).toEqual("private");
    });

    // Firefox containers keep their own per-container lists.
    it("should pass firefox-container-3 through unchanged", () => {
      expect(getStoreId("firefox-container-3")).toEqual("firefox-container-3");
    });

    // Any other storeId passes through untouched.
    it("should return some-id from storeId some-id", () => {
      expect(getStoreId("some-id")).toEqual("some-id");
    });
  });

  describe("globExpressionToRegExp", () => {
    it("should match example.com for example.com", () => {
      const regExp = new RegExp(globExpressionToRegExp("example.com"));
      expect(regExp.test("example.com")).toEqual(true);
    });
    it("should not match badexample.com for example.com", () => {
      const regExp = new RegExp(globExpressionToRegExp("example.com"));
      expect(regExp.test("badexample.com")).toEqual(false);
    });
    it("should match example.com for *.example.com", () => {
      const regExp = new RegExp(globExpressionToRegExp("*.example.com"));
      expect(regExp.test("example.com")).toEqual(true);
    });
    it("should match a.example.com for *.example.com", () => {
      const regExp = new RegExp(globExpressionToRegExp("*.example.com"));
      expect(regExp.test("a.example.com")).toEqual(true);
    });
    it("should match a.b.example.com for *.example.com", () => {
      const regExp = new RegExp(globExpressionToRegExp("*.example.com"));
      expect(regExp.test("a.b.example.com")).toEqual(true);
    });
    it("should match a.b-c.example.com for *.example.com", () => {
      const regExp = new RegExp(globExpressionToRegExp("*.example.com"));
      expect(regExp.test("a.b-c.example.com")).toEqual(true);
    });
    it("should match a.b_c.example.com for *.example.com", () => {
      const regExp = new RegExp(globExpressionToRegExp("*.example.com"));
      expect(regExp.test("a.b_c.example.com")).toEqual(true);
    });
    it("should match sub-with-strage_chars.example.another.sub.example.com for *.example.com", () => {
      const regExp = new RegExp(globExpressionToRegExp("*.example.com"));
      expect(
        regExp.test("sub-with-strage_chars.example.another.sub.example.com")
      ).toEqual(true);
    });
    it("should not match badexample.com for *.example.com", () => {
      const regExp = new RegExp(globExpressionToRegExp("*.example.com"));
      expect(regExp.test("badexample.com")).toEqual(false);
    });
    it("should not match bad.example.com.others.org for *.example.com", () => {
      const regExp = new RegExp(globExpressionToRegExp("*.example.com"));
      expect(regExp.test("bad.example.com.others.org")).toEqual(false);
    });
    it("should equal ^.*$ for just *", () => {
      const regExp = new RegExp(globExpressionToRegExp("*"));
      expect(regExp.toString()).toEqual("/^.*$/");
    });
    it("should match github.com with git*b.com", () => {
      const regExp = new RegExp(globExpressionToRegExp("git*b.com"));
      expect(regExp.test("github.com")).toEqual(true);
    });
    it("should match sub.gitlab.com with *.git*b.com", () => {
      const regExp = new RegExp(globExpressionToRegExp("*.git*b.com"));
      expect(regExp.test("sub.gitlab.com")).toEqual(true);
    });
    it("should match [2a03:4000:6:310e:216:3eff:fe53:99b3] with [*]", () => {
      const regExp = new RegExp(globExpressionToRegExp("[*]"));
      expect(regExp.test("[2a03:4000:6:310e:216:3eff:fe53:99b3]")).toEqual(
        true
      );
    });
    it("should match [2a03:4000:6:310e:216:3eff:fe53:99b3] with itself", () => {
      const regExp = new RegExp(
        globExpressionToRegExp("[2a03:4000:6:310e:216:3eff:fe53:99b3]")
      );
      expect(regExp.test("[2a03:4000:6:310e:216:3eff:fe53:99b3]")).toEqual(
        true
      );
    });
    it("should match github.com with /^git[hub]{3}.com$/", () => {
      const regExp = new RegExp(globExpressionToRegExp("/^git[hub]{3}.com$/"));
      expect(regExp.test("github.com")).toEqual(true);
    });
    it("should escape all backslash properly. (should only fail on pre-3.6.0)", () => {
      expect(globExpressionToRegExp("test\\abc")).toEqual("^test\\\\abc$");
    });
    it("should parse *. only in the beginning as (^|.).  Otherwise as wildcard before dot.", () => {
      const regExp = new RegExp(globExpressionToRegExp("*.test*.com"));
      expect(regExp.test("sub.testcom.com")).toEqual(true);
      expect(regExp.test("tests.com")).toEqual(true);
      expect(regExp.test("test.com")).toEqual(true);
      expect(regExp.test("a.test.com")).toEqual(true);
    });
  });

  describe("isAnIP()", () => {
    it("should return false from https://work-12345678.workplace.com", () => {
      expect(isAnIP("https://work-12345678.workplace.com")).toEqual(false);
    });

    it("should return false from https://en.wikipedia.org/wiki/Cat", () => {
      expect(isAnIP("https://en.wikipedia.org/wiki/Cat")).toEqual(false);
    });

    it("should return false from http://yahoo.com", () => {
      expect(isAnIP("http://yahoo.com")).toEqual(false);
    });

    it("should return false from random", () => {
      expect(isAnIP("random")).toEqual(false);
    });

    it("should return false from extension page", () => {
      expect(isAnIP("moz-extension://test/settings/settings.html")).toEqual(
        false
      );
    });

    it("should return true from http ip", () => {
      expect(isAnIP("http://192.168.1.1/")).toEqual(true);
    });

    it("should return true from https ip", () => {
      expect(isAnIP("https://192.168.1.1/")).toEqual(true);
    });

    it("should return true from IPv6 Address", () => {
      expect(isAnIP("https://[2607:f8b0:4006:81a:0:0:0:200e]")).toEqual(true);
    });

    it("should return true from Google DNS IPv6 Address", () => {
      expect(isAnIP("https://[2001:4860:4860::8888]")).toEqual(true);
    });

    it("should return false from undefined", () => {
      expect(isAnIP(undefined)).toEqual(false);
    });
  });

  describe("isAWebpage()", () => {
    it("should return true from https://en.wikipedia.org/wiki/Cat", () => {
      expect(isAWebpage("https://en.wikipedia.org/wiki/Cat")).toEqual(true);
    });

    it("should return true from http://yahoo.com", () => {
      expect(isAWebpage("http://yahoo.com")).toEqual(true);
    });

    it("should return false from random", () => {
      expect(isAWebpage("random")).toEqual(false);
    });

    it("should return false from extension page", () => {
      expect(isAWebpage("moz-extension://test/settings/settings.html")).toEqual(
        false
      );
    });

    it("should return true from local file file:///home/user/test.html", () => {
      expect(isAWebpage("file:///home/user/test.html")).toEqual(true);
    });

    it("should return false from undefined", () => {
      expect(isAWebpage(undefined)).toEqual(false);
    });
  });

  describe("localFileToRegex()", () => {
    it("should return itself if not a local file url (https://example.com)", () => {
      expect(localFileToRegex("https://example.com")).toEqual(
        "https://example.com"
      );
    });

    it("should return an escaped file url from url with RegExp special characters", () => {
      expect(localFileToRegex("file:///home/[u]ser")).toEqual(
        "file:///home/\\[u\\]ser"
      );
    });

    it("should return empty string from empty hostname", () => {
      expect(localFileToRegex("")).toEqual("");
    });
  });

  describe("matchIPInExpression()", () => {
    const ipv4Test = ipaddr.parse("1.1.1.1");
    it("should return undefined if Expression is not an IP", () => {
      expect(matchIPInExpression("test", ipv4Test)).toBeUndefined();
    });
    it("should return false if IP type is mismatched", () => {
      expect(matchIPInExpression("fd12:3456:7890:1:5555::", ipv4Test)).toEqual(
        false
      );
    });
    it("should return undefined if CIDR notation format is not as expected", () => {
      expect(matchIPInExpression("1.1/1/1", ipv4Test)).toBeUndefined();
    });
  });

  describe("withAnyFirstPartyDomain() on Chrome (default flavor)", () => {
    it("adds no firstPartyDomain key — Chrome rejects unknown getAll keys", () => {
      const details = { domain: "example.com", storeId: "0" };
      const wrapped = withAnyFirstPartyDomain(details);
      expect(wrapped).toEqual(details);
      expect(wrapped).not.toHaveProperty("firstPartyDomain");
    });
  });

  describe("prepareCleanupHostnames()", () => {
    it("carries the observed host, registrable domain, and www variant", () => {
      expect(prepareCleanupHostnames("sub.domain.com")).toEqual([
        "sub.domain.com",
        "domain.com",
        "www.domain.com",
      ]);
    });

    it("dedupes when the host IS the registrable domain", () => {
      expect(prepareCleanupHostnames("domain.com")).toEqual([
        "domain.com",
        "www.domain.com",
      ]);
    });

    it("returns bare IPs untouched", () => {
      expect(prepareCleanupHostnames("127.0.0.1")).toEqual(["127.0.0.1"]);
    });

    it("returns nothing for a blank domain", () => {
      expect(prepareCleanupHostnames("  ")).toEqual([]);
    });
  });

  describe("prepareCleanupScope() on Chrome (default flavor)", () => {
    it("produces origins, exactly like prepareCleanupDomains", () => {
      expect(prepareCleanupScope("sub.domain.com", "8080")).toEqual(
        prepareCleanupDomains("sub.domain.com", "8080")
      );
      expect(prepareCleanupScope("domain.com")[0]).toMatch(/^http:\/\//);
    });
  });

  describe("withAllPartitions()", () => {
    it("adds partitionKey {} on every build (TCP and CHIPS)", () => {
      expect(withAllPartitions({ storeId: "0" })).toEqual({
        storeId: "0",
        partitionKey: {},
      });
    });
  });

  describe("topLevelSiteCandidates()", () => {
    it("returns https and http sites for the registrable domain", () => {
      expect(topLevelSiteCandidates("sub.domain.com")).toEqual([
        "https://domain.com",
        "http://domain.com",
      ]);
    });

    it("returns nothing for an empty hostname", () => {
      expect(topLevelSiteCandidates("")).toEqual([]);
    });
  });

  describe("dedupeCookies()", () => {
    const base: browser.cookies.Cookie = {
      domain: "domain.com",
      hostOnly: true,
      httpOnly: true,
      name: "a",
      path: "/",
      sameSite: "no_restriction",
      secure: true,
      session: true,
      storeId: "default",
      value: "v",
    };

    it("collapses identical cookies from overlapping queries", () => {
      expect(dedupeCookies([base, { ...base }])).toHaveLength(1);
    });

    it("keeps cookies that differ only by partition", () => {
      const partitioned = {
        ...base,
        partitionKey: { topLevelSite: "https://shop.example" },
      };
      expect(dedupeCookies([base, partitioned])).toHaveLength(2);
    });

    it("keeps cookies that differ only by firstPartyDomain", () => {
      const isolated = { ...base, firstPartyDomain: "domain.com" };
      expect(dedupeCookies([base, isolated])).toHaveLength(2);
    });
  });

  describe("parseCookieStoreId()", () => {
    it("should return default if cookieStoreId was undefined", () => {
      expect(parseCookieStoreId(undefined)).toEqual("default");
    });

    it("should return default if cookieStoreId was an empty string", () => {
      expect(parseCookieStoreId("")).toEqual("default");
    });

    it("should return the specified cookieStoreId if given", () => {
      expect(parseCookieStoreId("test-container")).toEqual("test-container");
    });

    // Firefox tab store ids land in the unified key space so the UI write
    // path uses the same keys the cleanup read path matches against.
    it("should return default for firefox-default", () => {
      expect(parseCookieStoreId("firefox-default")).toEqual("default");
    });

    it("should return private for firefox-private", () => {
      expect(parseCookieStoreId("firefox-private")).toEqual("private");
    });

    it("should pass firefox-container-3 through unchanged", () => {
      expect(parseCookieStoreId("firefox-container-3")).toEqual(
        "firefox-container-3"
      );
    });
  });

  // Audit bug 4 regression: an expression added from a Firefox private
  // window must land in the SAME list the cleanup decision path reads for
  // private-window cookies. Upstream wrote to one key and read another, so
  // private-window whitelists silently protected nothing.
  describe("firefox private-window list unification (regression)", () => {
    const privateExpression: Expression = {
      expression: "example.com",
      listType: ListType.WHITE,
      // What the popup write path computes from tab.cookieStoreId in a
      // Firefox private window:
      storeId: parseCookieStoreId("firefox-private"),
    };
    const state: State = {
      ...initialState,
      lists: { [privateExpression.storeId]: [privateExpression] },
    };

    it("writes the expression under the unified private key", () => {
      expect(privateExpression.storeId).toEqual("private");
    });

    it("matches a firefox-private cookie against that list", () => {
      expect(
        returnMatchedExpressionObject(state, "firefox-private", "example.com")
      ).toEqual(privateExpression);
    });

    it("matches a Chrome incognito cookie against the same list", () => {
      expect(returnMatchedExpressionObject(state, "1", "example.com")).toEqual(
        privateExpression
      );
    });

    it("does not leak private-list protection into the default store", () => {
      expect(
        returnMatchedExpressionObject(state, "firefox-default", "example.com")
      ).toBeUndefined();
    });

    it("keeps container lists separate from private and default", () => {
      const containerExpression: Expression = {
        ...privateExpression,
        storeId: parseCookieStoreId("firefox-container-3"),
      };
      const containerState: State = {
        ...initialState,
        // Per-container lists apply while the container setting is on.
        settings: {
          ...initialState.settings,
          [SettingID.CONTEXTUAL_IDENTITIES]: {
            name: SettingID.CONTEXTUAL_IDENTITIES,
            value: true,
          },
        },
        lists: { [containerExpression.storeId]: [containerExpression] },
      };
      expect(
        returnMatchedExpressionObject(
          containerState,
          "firefox-container-3",
          "example.com"
        )
      ).toEqual(containerExpression);
      expect(
        returnMatchedExpressionObject(
          containerState,
          "firefox-default",
          "example.com"
        )
      ).toBeUndefined();
    });
  });

  // Audit bug 6a companion: container stores are ALWAYS enumerated and
  // cleaned; the contextualIdentities setting only decides which list
  // governs them. Off (or absent, pre-restore): the default list. On:
  // each container's own list, with no silent fallback to default.
  describe("container expression matching vs contextualIdentities setting", () => {
    const defaultExpression: Expression = {
      expression: "example.com",
      listType: ListType.WHITE,
      storeId: "default",
    };
    const containerExpression: Expression = {
      ...defaultExpression,
      storeId: "firefox-container-5",
    };

    it("matches container cookies against the default list when the setting is absent", () => {
      const state: State = {
        ...initialState,
        lists: { default: [defaultExpression] },
      };
      expect(
        returnMatchedExpressionObject(
          state,
          "firefox-container-5",
          "example.com"
        )
      ).toEqual(defaultExpression);
    });

    it("matches container cookies against the default list when the setting is off", () => {
      const state: State = {
        ...initialState,
        settings: {
          ...initialState.settings,
          [SettingID.CONTEXTUAL_IDENTITIES]: {
            name: SettingID.CONTEXTUAL_IDENTITIES,
            value: false,
          },
        },
        lists: { default: [defaultExpression] },
      };
      expect(
        returnMatchedExpressionObject(
          state,
          "firefox-container-5",
          "example.com"
        )
      ).toEqual(defaultExpression);
    });

    it("uses the container's own list, not default, when the setting is on", () => {
      const state: State = {
        ...initialState,
        settings: {
          ...initialState.settings,
          [SettingID.CONTEXTUAL_IDENTITIES]: {
            name: SettingID.CONTEXTUAL_IDENTITIES,
            value: true,
          },
        },
        lists: {
          default: [defaultExpression],
          "firefox-container-5": [containerExpression],
        },
      };
      expect(
        returnMatchedExpressionObject(
          state,
          "firefox-container-5",
          "example.com"
        )
      ).toEqual(containerExpression);
      // A container without its own matching entry gets NO default-list
      // fallback while per-container lists are active.
      expect(
        returnMatchedExpressionObject(
          state,
          "firefox-container-6",
          "example.com"
        )
      ).toBeUndefined();
    });

    it("never folds Chrome or non-container ids", () => {
      const state: State = {
        ...initialState,
        lists: { default: [defaultExpression] },
      };
      expect(returnMatchedExpressionObject(state, "0", "example.com")).toEqual(
        defaultExpression
      );
      expect(
        returnMatchedExpressionObject(state, "1", "example.com")
      ).toBeUndefined();
    });
  });

  describe("prepareCleanupDomains()", () => {
    it("should return empty array for empty domain", () => {
      expect(prepareCleanupDomains("")).toEqual([]);
    });

    it("should return empty array for domains with only whitespaces", () => {
      expect(prepareCleanupDomains(" ")).toEqual([]);
    });

    it("should return cleanup origins from www.example.com", () => {
      expect(prepareCleanupDomains("www.example.com")).toEqual([
        "http://www.example.com",
        "https://www.example.com",
      ]);
    });

    it("should return cleanup origins from .example.com", () => {
      // No dot-prefixed variants: those are cookie-domain syntax, not valid
      // origins, and Chrome's browsingData API silently ignores them.
      expect(prepareCleanupDomains(".example.com")).toEqual([
        "http://example.com",
        "https://example.com",
        "http://www.example.com",
        "https://www.example.com",
      ]);
    });

    it("should return cleanup origins from example.com", () => {
      // No dot-prefixed variants: those are cookie-domain syntax, not valid
      // origins, and Chrome's browsingData API silently ignores them.
      expect(prepareCleanupDomains("example.com")).toEqual([
        "http://example.com",
        "https://example.com",
        "http://www.example.com",
        "https://www.example.com",
      ]);
    });

    it("should return proper IPv4 address origins", () => {
      expect(prepareCleanupDomains("127.0.0.1")).toEqual([
        "http://127.0.0.1",
        "https://127.0.0.1",
      ]);
    });

    it("should return proper IPv6 address origins", () => {
      expect(prepareCleanupDomains("::1")).toEqual([
        "http://[::1]",
        "https://[::1]",
      ]);
    });

    it("should include port-carrying origins when a port is given", () => {
      // browsingData removals are origin-scoped, and a non-default port is
      // part of the origin (e.g. http://localhost:3000).
      expect(prepareCleanupDomains("example.com", "3000")).toEqual([
        "http://example.com",
        "https://example.com",
        "http://example.com:3000",
        "https://example.com:3000",
        "http://www.example.com",
        "https://www.example.com",
        "http://www.example.com:3000",
        "https://www.example.com:3000",
      ]);
    });

    it("should include port-carrying origins for IP addresses", () => {
      expect(prepareCleanupDomains("::1", "8443")).toEqual([
        "http://[::1]",
        "https://[::1]",
        "http://[::1]:8443",
        "https://[::1]:8443",
      ]);
    });
  });

  describe("getPort()", () => {
    it("should return the explicit port", () => {
      expect(getPort("http://localhost:3000/app")).toBe("3000");
    });
    it("should return empty string for default ports", () => {
      expect(getPort("https://example.com/path")).toBe("");
    });
    it("should return empty string for file urls", () => {
      expect(getPort("file:///home/user/index.html")).toBe("");
    });
    it("should return empty string for undefined and garbage", () => {
      expect(getPort(undefined)).toBe("");
      expect(getPort("not a url")).toBe("");
    });
  });

  describe("prepareCookieDomain()", () => {
    it("should return https://google.com", () => {
      expect(
        prepareCookieDomain({
          ...mockCookie,
          domain: "google.com",
          path: "/",
          secure: true,
        })
      ).toEqual("https://google.com/");
    });

    it("should return an IPv4 Address if domain was an IPv4 address", () => {
      expect(
        prepareCookieDomain({
          ...mockCookie,
          domain: "127.0.0.1",
          path: "/",
          secure: true,
        })
      ).toEqual("https://127.0.0.1/");
    });

    it("should return a wrapped ivp6 ip cookie domain in brackets", () => {
      expect(
        prepareCookieDomain({
          ...mockCookie,
          domain: "2001:0db8:85a3:0000:0000:8a2e:0370:7334",
          path: "/",
          secure: true,
        })
      ).toEqual("https://[2001:0db8:85a3:0000:0000:8a2e:0370:7334]/");
    });

    it("should return http://google.com with a removed leading .", () => {
      expect(
        prepareCookieDomain({
          ...mockCookie,
          domain: ".google.com",
          path: "/test",
          secure: false,
        })
      ).toEqual("http://google.com/test");
    });

    it("should return local file path for cookie from local file", () => {
      expect(
        prepareCookieDomain({ ...mockCookie, domain: "", path: "/home/user" })
      ).toEqual("file:///home/user");
    });

    it("should return domain ending with a dot if supplied", () => {
      expect(
        prepareCookieDomain({
          ...mockCookie,
          domain: "example.com.",
          secure: true,
        })
      ).toEqual("https://example.com./");
    });
  });

  describe("returnMatchedExpressionObject()", () => {
    const state: State = {
      ...initialState,
      lists: {
        default: [
          {
            expression: "*.expression.com",
            listType: ListType.WHITE,
            storeId: "default",
          },
        ],
      },
    };
    it("should return a matched expression", () => {
      const results = returnMatchedExpressionObject(
        state,
        "default",
        "expression.com"
      );
      expect(results).toEqual(
        expect.objectContaining({ expression: "*.expression.com" })
      );
    });
    it("should return undefined", () => {
      const results = returnMatchedExpressionObject(
        state,
        "container-1",
        "expression.com"
      );
      expect(results).toEqual(undefined);
    });
  });

  describe("showNotification()", () => {
    beforeAll(() => {
      when(global.browser.notifications.create)
        .calledWith(expect.any(String), expect.any(Object))
        .mockResolvedValue("testID" as never);
      when(global.browser.notifications.clear)
        .calledWith(expect.any(String))
        .mockResolvedValue(true as never);
      when(global.browser.i18n.getMessage)
        .calledWith("manualActionNotification")
        .mockReturnValue("manual");
      when(global.browser.runtime.getManifest)
        .calledWith()
        .mockReturnValue({ version: "3.99.99" });
      when(global.browser.runtime.getURL)
        .calledWith(expect.anything())
        .mockReturnValue("");
    });
    afterAll(() => {
      global.browser.i18n.getMessage.mockReset();
      global.browser.runtime.getManifest.mockReset();
      global.browser.runtime.getURL.mockReset();
      jest.clearAllTimers();
    });

    it("should expect one call to browser.notifications.create with default title", async () => {
      const spyTimeout = jest.spyOn(global, "setTimeout");
      showNotification({ duration: 1, msg: "Test Notification" });
      expect(global.browser.notifications.create).toHaveBeenCalled();
      expect(global.browser.notifications.create.mock.calls[0][0]).toEqual(
        expect.stringContaining("ADCP-notification-")
      );
      expect(global.browser.notifications.create.mock.calls[0][1]).toEqual(
        expect.objectContaining({
          message: "Test Notification",
          title: "ADCP 3.99.99 - manual",
          type: "basic",
        })
      );
      expect(spyTimeout).toHaveBeenCalled();
      expect(spyTimeout).toHaveBeenCalledWith(expect.any(Function), 1000);

      jest.runAllTimers();
      expect(browser.notifications.clear).toHaveBeenCalledTimes(1);
    });

    it("should expect one call to browser.notifications.create with custom title", async () => {
      showNotification({
        duration: 1,
        msg: "Test Notification",
        title: "custom",
      });
      expect(global.browser.notifications.create).toHaveBeenCalled();
      expect(global.browser.notifications.create.mock.calls[0][1]).toEqual(
        expect.objectContaining({
          message: "Test Notification",
          title: "ADCP 3.99.99 - custom",
          type: "basic",
        })
      );
    });

    it("should not show notification if display was false", async () => {
      showNotification(
        {
          duration: 1,
          msg: "Unshown Notification",
        },
        false
      );
      expect(global.browser.notifications.create).not.toHaveBeenCalled();
    });
  });

  describe("sleep()", () => {
    jest.useFakeTimers();
    const spySetTimeout = jest.spyOn(global, "setTimeout");
    afterEach(() => {
      spySetTimeout.mockClear();
      jest.clearAllTimers();
    });

    it("should return undefined as result", () => {
      expect.assertions(1);
      const result = sleep(1).then((r) => expect(r).toEqual(undefined));
      jest.runAllTimers();
      return result;
    });

    it("setTimeout in Promise should be set to 250ms if input was 100", () => {
      expect.assertions(3);
      const result = sleep(100).then((r) => {
        expect(r).toEqual(undefined);
        expect(spySetTimeout).toBeCalledTimes(1);
        expect(spySetTimeout).toHaveBeenCalledWith(expect.any(Function), 250);
      });
      jest.runAllTimers();
      return result;
    });

    it("setTimeout in Promise should be set to 1500ms if input was 1500", () => {
      expect.assertions(3);
      const result = sleep(1500).then((r) => {
        expect(r).toEqual(undefined);
        expect(spySetTimeout).toBeCalledTimes(1);
        expect(spySetTimeout).toHaveBeenCalledWith(expect.any(Function), 1500);
      });
      jest.runAllTimers();
      return result;
    });

    it("setTimeout in Promise should be set to 2147483500ms if input was greater than 2147483500", () => {
      expect.assertions(3);
      const result = sleep(2345678901).then((r) => {
        expect(r).toEqual(undefined);
        expect(spySetTimeout).toBeCalledTimes(1);
        expect(spySetTimeout).toHaveBeenCalledWith(
          expect.any(Function),
          2147483500
        );
      });
      jest.runAllTimers();
      return result;
    });
  });

  describe("trimDot()", () => {
    it("should return example.com with no leading dots", () => {
      const results = trimDot(".example.com");
      expect(results).toEqual("example.com");
    });
    it("should return example.com with no leading and ending dots", () => {
      const results = trimDot(".example.com.");
      expect(results).toEqual("example.com");
    });
  });

  describe("throwErrorNotification()", () => {
    beforeAll(() => {
      when(global.browser.notifications.create)
        .calledWith(expect.any(String), expect.any(Object))
        .mockResolvedValue("testID" as never);
      when(global.browser.notifications.clear)
        .calledWith(expect.any(String))
        .mockResolvedValue(true as never);
      when(global.browser.i18n.getMessage)
        .calledWith("errorText")
        .mockReturnValue("Error!");
      when(global.browser.runtime.getManifest)
        .calledWith()
        .mockReturnValue({ version: "3.99.99" });
      when(global.browser.runtime.getURL)
        .calledWith(expect.anything())
        .mockReturnValue("");
    });
    beforeEach(() => {
      jest.spyOn(global, "setTimeout");
    });
    afterEach(() => {
      jest.clearAllTimers();
    });
    afterAll(() => {
      global.browser.i18n.getMessage.mockReset();
      global.browser.runtime.getManifest.mockReset();
      global.browser.runtime.getURL.mockReset();
    });

    it("should expect one call to browser.notifications.create", () => {
      throwErrorNotification({ name: "Test Error", message: "An ERROR!" }, 1);
      expect(global.browser.notifications.create).toHaveBeenCalled();
      expect(global.browser.notifications.create.mock.calls[0][0]).toEqual(
        expect.stringContaining("ADCP-notification-failed-")
      );
      expect(global.browser.notifications.create.mock.calls[0][1]).toEqual(
        expect.objectContaining({
          message: "An ERROR!",
          title: "Error!",
          type: "basic",
        })
      );
      expect(setTimeout).toHaveBeenCalled();
      expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 1000);
      jest.runAllTimers();
      expect(browser.notifications.clear).toHaveBeenCalledTimes(1);
    });

    it("references an icon file that actually ships", () => {
      // Chrome fails the whole notification when the icon can't load
      // ("Unable to download all specified images"), which would silently
      // suppress every error notification — pin the path to disk.
      throwErrorNotification({ name: "Test Error", message: "An ERROR!" }, 1);
      const iconPath = global.browser.runtime.getURL.mock.calls.at(
        -1
      )?.[0] as string;
      expect(iconPath).toBe("icons/icon_48_red.png");
      expect(
        existsSync(
          fileURLToPath(new URL(`../../extension/${iconPath}`, import.meta.url))
        )
      ).toBe(true);
    });
  });

  describe("undefinedIsTrue()", () => {
    it("should return true for undefined", () => {
      expect(undefinedIsTrue(undefined)).toEqual(true);
    });
    it("should return true for true", () => {
      expect(undefinedIsTrue(true)).toEqual(true);
    });
    it("should return false for false", () => {
      expect(undefinedIsTrue(false)).toEqual(false);
    });
  });

  describe("validateExpressionDomain()", () => {
    when(global.browser.i18n.getMessage)
      .calledWith(expect.any(String))
      .mockReturnValue("message");
    when(global.browser.i18n.getMessage)
      .calledWith(expect.any(String), expect.any(Array))
      .mockReturnValue(`message with substitution array`);
    it('should return invalid message on "" input', () => {
      validateExpressionDomain("");
      expect(global.browser.i18n.getMessage).toHaveBeenCalledWith(
        "inputErrorEmpty"
      );
    });
    it("should return invalid message on invalid RegExp", () => {
      validateExpressionDomain("/abc(def]/");
      expect(global.browser.i18n.getMessage).toHaveBeenCalledWith(
        "inputErrorRegExp",
        [expect.any(String)]
      );
    });
    it("should return invalid message on start slash missing end slash", () => {
      validateExpressionDomain("/abc");
      expect(global.browser.i18n.getMessage).toHaveBeenCalledWith(
        "inputErrorSlashStartMissingEnd"
      );
    });
    it("should return invalid message on end slash missing start slash", () => {
      validateExpressionDomain("abc/");
      expect(global.browser.i18n.getMessage).toHaveBeenCalledWith(
        "inputErrorSlashEndMissingStart"
      );
    });
    it("should return invalid message on comma usage outside of RegExp", () => {
      validateExpressionDomain("a,b");
      expect(global.browser.i18n.getMessage).toHaveBeenCalledWith(
        "inputErrorComma"
      );
    });
    it("should return invalid message on spaces between words.", () => {
      validateExpressionDomain("test expression");
      expect(global.browser.i18n.getMessage).toHaveBeenCalledWith(
        "inputErrorSpace"
      );
    });
    it("should return empty string if valid domain expression", () => {
      const r = validateExpressionDomain("test");
      expect(global.browser.i18n.getMessage).not.toHaveBeenCalled();
      expect(r).toEqual("");
    });
    it("should return empty string if valid RegExp", () => {
      const r = validateExpressionDomain("/[Rr]eg[Ee]xp.com/");
      expect(global.browser.i18n.getMessage).not.toHaveBeenCalled();
      expect(r).toEqual("");
    });
  });
});
