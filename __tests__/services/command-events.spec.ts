/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * The optional keyboard commands for the popup's common actions (#588):
 * each runs the same background action as its popup button.
 */
import { initialState } from "@/redux/state";
import createStore from "@/redux/store";
import CommandEvents, { ShortcutCommand } from "@/services/command-events";
import { keepTargetFor } from "@/services/keep-target";
import { localFileToRegex } from "@/services/libs";
import StoreUser from "@/services/store-user";
import { ListType, SettingID } from "@/typings/enums";

const cookieCleanup = vi.hoisted(() =>
  vi.fn(() => ({ type: "TEST_COOKIE_CLEANUP" }))
);
vi.mock("@/redux/actions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/redux/actions")>()),
  cookieCleanup,
}));
const clearCookiesForThisDomain = vi.hoisted(() => vi.fn(async () => true));
vi.mock("@/services/cleanup-service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/cleanup-service")>()),
  clearCookiesForThisDomain,
}));

const tabFor = (url: string, extra: Partial<browser.tabs.Tab> = {}) =>
  ({
    active: true,
    highlighted: true,
    incognito: false,
    index: 0,
    pinned: false,
    url,
    windowId: 1,
    ...extra,
  }) as browser.tabs.Tab;

const site = tabFor("https://shop.example.com/cart");
const newTab = tabFor("chrome://newtab/");

let store: ReturnType<typeof createStore>;
const lists = () => store.getState().lists;

beforeEach(() => {
  store = createStore(initialState);
  StoreUser.init(store);
});

describe("CommandEvents.onCommand (#588)", () => {
  it("ignores commands that are not its own", async () => {
    expect(await CommandEvents.onCommand("toggle-active-mode", site)).toBe(
      false
    );
    expect(await CommandEvents.onCommand("something-else", site)).toBe(false);
    expect(cookieCleanup).not.toHaveBeenCalled();
    expect(clearCookiesForThisDomain).not.toHaveBeenCalled();
    expect(lists()).toEqual({});
  });

  describe("Clean now", () => {
    it("runs the popup's Clean: open tabs are left alone", async () => {
      expect(await CommandEvents.onCommand(ShortcutCommand.CLEAN)).toBe(true);
      expect(cookieCleanup).toHaveBeenCalledWith({
        greyCleanup: false,
        ignoreOpenTabs: false,
      });
    });

    it("including open tabs runs the popup's advanced clean", async () => {
      await CommandEvents.onCommand(ShortcutCommand.CLEAN_INCLUDING_OPEN_TABS);
      expect(cookieCleanup).toHaveBeenCalledWith({
        greyCleanup: false,
        ignoreOpenTabs: true,
      });
    });

    it("needs no tab", async () => {
      await CommandEvents.onCommand(ShortcutCommand.CLEAN, newTab);
      expect(cookieCleanup).toHaveBeenCalledTimes(1);
      expect(browser.tabs.query).not.toHaveBeenCalled();
    });
  });

  describe("Delete this site's cookies", () => {
    it("deletes the tab's site cookies as the popup does", async () => {
      expect(
        await CommandEvents.onCommand(ShortcutCommand.DELETE_SITE_COOKIES, site)
      ).toBe(true);
      expect(clearCookiesForThisDomain).toHaveBeenCalledWith(
        store.getState(),
        site
      );
    });

    it("does nothing on a tab with no site", async () => {
      await CommandEvents.onCommand(
        ShortcutCommand.DELETE_SITE_COOKIES,
        newTab
      );
      expect(clearCookiesForThisDomain).not.toHaveBeenCalled();
    });

    it("falls back to the focused window's active tab", async () => {
      vi.mocked(browser.tabs.query).mockResolvedValueOnce([site] as never);
      await CommandEvents.onCommand(ShortcutCommand.DELETE_SITE_COOKIES);
      expect(browser.tabs.query).toHaveBeenCalledWith({
        active: true,
        lastFocusedWindow: true,
      });
      expect(clearCookiesForThisDomain).toHaveBeenCalledWith(
        store.getState(),
        site
      );
    });

    it("does nothing when there is no active tab", async () => {
      vi.mocked(browser.tabs.query).mockResolvedValueOnce([] as never);
      await CommandEvents.onCommand(ShortcutCommand.DELETE_SITE_COOKIES);
      expect(clearCookiesForThisDomain).not.toHaveBeenCalled();
    });
  });

  describe("Keep this site", () => {
    it("adds the popup's Keep rule to the default list", async () => {
      expect(
        await CommandEvents.onCommand(ShortcutCommand.KEEP_SITE, site)
      ).toBe(true);
      const rules = lists().default;
      expect(rules).toHaveLength(1);
      expect(rules[0]).toMatchObject({
        expression: localFileToRegex(keepTargetFor(site.url).keepExpression),
        listType: ListType.WHITE,
        storeId: "default",
      });
      expect(rules[0].expression).toBe("*.example.com");
    });

    it("until the browser closes adds the same rule as a GREY one", async () => {
      await CommandEvents.onCommand(
        ShortcutCommand.KEEP_SITE_UNTIL_CLOSE,
        site
      );
      expect(lists().default).toEqual([
        expect.objectContaining({
          expression: "*.example.com",
          listType: ListType.GREY,
          storeId: "default",
        }),
      ]);
    });

    it("keeps a private tab's site in the Private list", async () => {
      await CommandEvents.onCommand(
        ShortcutCommand.KEEP_SITE,
        tabFor("https://example.com/", { incognito: true })
      );
      expect(lists().private).toEqual([
        expect.objectContaining({
          expression: "*.example.com",
          listType: ListType.WHITE,
        }),
      ]);
      expect(lists().default).toBeUndefined();
    });

    it("keeps a container tab's site in the list that governs it", async () => {
      const container = tabFor("https://example.com/", {
        cookieStoreId: "firefox-container-1",
      });
      await CommandEvents.onCommand(ShortcutCommand.KEEP_SITE, container);
      // Per-container lists are off: the default list governs the tab.
      expect(Object.keys(lists())).toEqual(["default"]);

      store.dispatch({
        payload: { name: SettingID.CONTEXTUAL_IDENTITIES, value: true },
        type: "UPDATE_SETTING",
      } as never);
      await CommandEvents.onCommand(
        ShortcutCommand.KEEP_SITE,
        tabFor("https://other.org/", { cookieStoreId: "firefox-container-1" })
      );
      expect(lists()["firefox-container-1"]).toEqual([
        expect.objectContaining({ expression: "*.other.org" }),
      ]);
    });

    it("adds nothing while a rule already matches, as the popup hides Keep", async () => {
      await CommandEvents.onCommand(
        ShortcutCommand.KEEP_SITE_UNTIL_CLOSE,
        site
      );
      await CommandEvents.onCommand(ShortcutCommand.KEEP_SITE, site);
      await CommandEvents.onCommand(
        ShortcutCommand.KEEP_SITE_UNTIL_CLOSE,
        site
      );
      expect(lists().default).toEqual([
        expect.objectContaining({ listType: ListType.GREY }),
      ]);
    });

    it("does nothing on a tab with no site", async () => {
      await CommandEvents.onCommand(ShortcutCommand.KEEP_SITE, newTab);
      await CommandEvents.onCommand(
        ShortcutCommand.KEEP_SITE_UNTIL_CLOSE,
        tabFor("about:blank")
      );
      expect(lists()).toEqual({});
    });

    it("uses the focused window's active tab when none is passed", async () => {
      vi.mocked(browser.tabs.query).mockResolvedValueOnce([site] as never);
      await CommandEvents.onCommand(ShortcutCommand.KEEP_SITE_UNTIL_CLOSE);
      expect(lists().default).toEqual([
        expect.objectContaining({ expression: "*.example.com" }),
      ]);
    });

    it("does nothing when there is no active tab", async () => {
      vi.mocked(browser.tabs.query).mockResolvedValueOnce([] as never);
      await CommandEvents.onCommand(ShortcutCommand.KEEP_SITE);
      expect(lists()).toEqual({});
    });
  });
});
