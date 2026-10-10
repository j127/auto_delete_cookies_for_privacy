/**
 * Copyright (c) 2020-2022 Kenneth Tran and CAD Team (https://github.com/Cookie-AutoDelete/Cookie-AutoDelete/graphs/contributors)
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

import { when } from "jest-when";

import { resetSettings, updateSetting } from "@/redux/actions";
import { initialState } from "@/redux/state";
import createStore from "@/redux/store";
import AlarmEvents from "@/services/alarm-events";
import CookieEvents from "@/services/cookie-events";
import * as Lib from "@/services/libs";
import RecentCleanup from "@/services/recent-cleanup";
import StoreUser from "@/services/store-user";
import TabEvents from "@/services/tab-events";
import { SettingID } from "@/typings/enums";

const store = createStore(initialState);
StoreUser.init(store);

const spyLib: JestSpyObject = global.generateSpies(Lib);

const defaultCookie: browser.cookies.Cookie = {
  domain: "domain.com",
  hostOnly: false,
  httpOnly: false,
  name: "CookieName",
  path: "/",
  sameSite: "no_restriction",
  secure: false,
  session: true,
  storeId: "0",
  value: "CookieValue",
};

const defaultTab: browser.tabs.Tab = {
  active: true,
  cookieStoreId: "0",
  hidden: false,
  highlighted: false,
  incognito: false,
  id: 1,
  index: 0,
  isArticle: false,
  isInReaderMode: false,
  lastAccessed: 12345678,
  pinned: false,
  url: "https://domain.com",
  windowId: 1,
};

describe("CookieEvents", () => {
  when(global.browser.tabs.query)
    .calledWith({ active: true, windowType: "normal" })
    .mockResolvedValue([
      defaultTab,
      { ...defaultTab, url: "https://example.com" },
    ] as never);

  describe("onCookieChanged()", () => {
    const spyTabUpdate = jest.spyOn(TabEvents, "onTabUpdate");

    it("should do nothing if cookie is not part of any active tabs", async () => {
      await CookieEvents.onCookieChanged({
        removed: false,
        cookie: { ...defaultCookie, domain: "1.1.1.1" },
        cause: "overwrite",
      });
      expect(spyTabUpdate).not.toHaveBeenCalled();
    });

    it("should force update that active tab if the domain matches", async () => {
      await CookieEvents.onCookieChanged({
        removed: false,
        cookie: defaultCookie,
        cause: "overwrite",
      });
      expect(spyTabUpdate).toHaveBeenCalledTimes(1);
      expect(spyTabUpdate.mock.calls[0][1].cookieChanged).toHaveProperty(
        "cookie.value",
        "***"
      );
    });

    it("should not force tab update if tab url is undefined", async () => {
      when(global.browser.tabs.query)
        .calledWith({ active: true, windowType: "normal" })
        .mockResolvedValue([{ ...defaultTab, url: undefined }] as never);
      await CookieEvents.onCookieChanged({
        removed: false,
        cookie: defaultCookie,
        cause: "overwrite",
      });
      expect(spyLib.getHostname).not.toHaveBeenCalled();
    });

    it("should not force tab update if tab id is undefined", async () => {
      when(global.browser.tabs.query)
        .calledWith({ active: true, windowType: "normal" })
        .mockResolvedValue([{ ...defaultTab, id: undefined }] as never);
      await CookieEvents.onCookieChanged({
        removed: false,
        cookie: defaultCookie,
        cause: "overwrite",
      });
      expect(spyLib.getHostname).not.toHaveBeenCalled();
    });
  });

  describe("rescheduleCleanupForLateCookie()", () => {
    const ebayCookie: browser.cookies.Cookie = {
      ...defaultCookie,
      domain: ".ebay.com.au",
      name: "nonsession",
    };
    const added = (cookie = ebayCookie) => ({
      removed: false,
      cookie,
      cause: "explicit" as browser.cookies.OnChangedCause,
    });
    const openTabs = (tabs: Partial<browser.tabs.Tab>[]) =>
      when(global.browser.tabs.query)
        .calledWith({ windowType: "normal" })
        .mockResolvedValue(tabs as never);
    const markCleaned = (domain: string) => {
      RecentCleanup.noteTabDomainLeft(domain);
      RecentCleanup.cleanupStarted();
      RecentCleanup.cleanupFinished([domain]);
    };
    let spyAlarm: ReturnType<typeof jest.spyOn>;

    beforeEach(() => {
      RecentCleanup.reset();
      store.dispatch(
        updateSetting({ name: SettingID.ACTIVE_MODE, value: true })
      );
      spyAlarm = jest
        .spyOn(AlarmEvents, "createActiveModeAlarm")
        .mockResolvedValue(undefined);
      openTabs([{ ...defaultTab, url: "https://example.com" }]);
      markCleaned("ebay.com.au");
    });

    afterEach(() => {
      spyAlarm.mockRestore();
      store.dispatch(resetSettings());
    });

    it("schedules a cleanup when a recently cleaned site with no open tab sets a cookie", async () => {
      await CookieEvents.rescheduleCleanupForLateCookie(added());
      expect(spyAlarm).toHaveBeenCalledTimes(1);
    });

    it("counts the ADCP marker cookie like any other", async () => {
      await CookieEvents.rescheduleCleanupForLateCookie(
        added({
          ...ebayCookie,
          domain: "www.ebay.com.au",
          name: Lib.ADCPCOOKIENAME,
        })
      );
      expect(spyAlarm).toHaveBeenCalledTimes(1);
    });

    it("ignores removals", async () => {
      await CookieEvents.rescheduleCleanupForLateCookie({
        ...added(),
        removed: true,
      });
      expect(spyAlarm).not.toHaveBeenCalled();
    });

    it("ignores the overwrite half of a cookie update", async () => {
      await CookieEvents.rescheduleCleanupForLateCookie({
        ...added(),
        cause: "overwrite",
      });
      expect(spyAlarm).not.toHaveBeenCalled();
    });

    it("does nothing when active mode is off", async () => {
      store.dispatch(
        updateSetting({ name: SettingID.ACTIVE_MODE, value: false })
      );
      await CookieEvents.rescheduleCleanupForLateCookie(added());
      expect(spyAlarm).not.toHaveBeenCalled();
    });

    it("ignores a site that was not recently cleaned", async () => {
      await CookieEvents.rescheduleCleanupForLateCookie(
        added({ ...defaultCookie, domain: ".doubleclick.net" })
      );
      expect(spyAlarm).not.toHaveBeenCalled();
    });

    it("ignores a recently cleaned site once its window has passed", async () => {
      const now = Date.now();
      const spyNow = jest
        .spyOn(Date, "now")
        .mockReturnValue(now + RecentCleanup.WINDOW_MS + 1);
      try {
        await CookieEvents.rescheduleCleanupForLateCookie(added());
      } finally {
        spyNow.mockRestore();
      }
      expect(spyAlarm).not.toHaveBeenCalled();
    });

    it("ignores the site while a tab in the cookie's store shows it", async () => {
      openTabs([{ ...defaultTab, url: "https://www.ebay.com.au/itm/1" }]);
      await CookieEvents.rescheduleCleanupForLateCookie(added());
      expect(spyAlarm).not.toHaveBeenCalled();
    });

    it("still schedules when only a private tab shows the site", async () => {
      // Chrome tabs carry no cookieStoreId; incognito puts this one in "1".
      openTabs([
        {
          ...defaultTab,
          cookieStoreId: undefined,
          incognito: true,
          url: "https://www.ebay.com.au",
        },
      ]);
      await CookieEvents.rescheduleCleanupForLateCookie(added());
      expect(spyAlarm).toHaveBeenCalledTimes(1);
    });

    it("weighs a partitioned cookie by its top-level site", async () => {
      await CookieEvents.rescheduleCleanupForLateCookie(
        added({
          ...defaultCookie,
          domain: ".tracker.example",
          partitionKey: { topLevelSite: "https://ebay.com.au" },
        })
      );
      expect(spyAlarm).toHaveBeenCalledTimes(1);
    });

    it("waits for a running cleanup before deciding", async () => {
      RecentCleanup.reset();
      RecentCleanup.noteTabDomainLeft("ebay.com.au");
      RecentCleanup.cleanupStarted();
      const pending = CookieEvents.rescheduleCleanupForLateCookie(added());
      await Promise.resolve();
      expect(spyAlarm).not.toHaveBeenCalled();
      RecentCleanup.cleanupFinished(["ebay.com.au"]);
      await pending;
      expect(spyAlarm).toHaveBeenCalledTimes(1);
    });
  });
});
