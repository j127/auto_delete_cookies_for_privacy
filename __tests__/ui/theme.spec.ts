/** @jest-environment jsdom */
import { initTheme, setTheme, THEME_STORAGE_KEY } from "@/ui/theme";

const themeAttr = () => document.documentElement.dataset.theme;

type StorageChangeListener = (
  changes: { [key: string]: { newValue?: unknown; oldValue?: unknown } },
  areaName: string
) => void;

const registeredListener = (): StorageChangeListener =>
  global.browser.storage.onChanged.addListener.mock.calls[0][0];

describe("theme", () => {
  afterEach(() => {
    delete document.documentElement.dataset.theme;
  });

  describe("initTheme()", () => {
    it("applies a stored dark choice as data-theme", async () => {
      global.browser.storage.local.get.mockResolvedValue({
        [THEME_STORAGE_KEY]: "dark",
      });
      await initTheme();
      expect(themeAttr()).toBe("dark");
    });

    it("applies a stored light choice as data-theme", async () => {
      global.browser.storage.local.get.mockResolvedValue({
        [THEME_STORAGE_KEY]: "light",
      });
      await initTheme();
      expect(themeAttr()).toBe("light");
    });

    it("leaves no data-theme when nothing is stored (auto)", async () => {
      document.documentElement.dataset.theme = "dark";
      global.browser.storage.local.get.mockResolvedValue({});
      await initTheme();
      expect(themeAttr()).toBeUndefined();
    });

    it("treats an unknown stored value as auto", async () => {
      global.browser.storage.local.get.mockResolvedValue({
        [THEME_STORAGE_KEY]: "purple",
      });
      await initTheme();
      expect(themeAttr()).toBeUndefined();
    });

    it("falls back to auto when storage reads fail", async () => {
      document.documentElement.dataset.theme = "dark";
      global.browser.storage.local.get.mockRejectedValue(new Error("nope"));
      await expect(initTheme()).resolves.toBeUndefined();
      expect(themeAttr()).toBeUndefined();
    });

    it("subscribes to storage changes from other pages", async () => {
      global.browser.storage.local.get.mockResolvedValue({});
      await initTheme();
      expect(
        global.browser.storage.onChanged.addListener
      ).toHaveBeenCalledTimes(1);
    });
  });

  describe("storage.onChanged listener", () => {
    beforeEach(async () => {
      global.browser.storage.local.get.mockResolvedValue({});
      await initTheme();
    });

    it("applies a theme change from the local area", () => {
      registeredListener()(
        { [THEME_STORAGE_KEY]: { newValue: "dark" } },
        "local"
      );
      expect(themeAttr()).toBe("dark");
    });

    it("applies a change back to auto", () => {
      document.documentElement.dataset.theme = "dark";
      registeredListener()(
        { [THEME_STORAGE_KEY]: { newValue: "auto" } },
        "local"
      );
      expect(themeAttr()).toBeUndefined();
    });

    it("ignores changes in other storage areas", () => {
      registeredListener()(
        { [THEME_STORAGE_KEY]: { newValue: "dark" } },
        "sync"
      );
      expect(themeAttr()).toBeUndefined();
    });

    it("ignores changes to unrelated keys", () => {
      registeredListener()({ state: { newValue: "{}" } }, "local");
      expect(themeAttr()).toBeUndefined();
    });
  });

  describe("setTheme()", () => {
    it("applies and persists an explicit choice", async () => {
      global.browser.storage.local.set.mockResolvedValue(undefined);
      await setTheme("dark");
      expect(themeAttr()).toBe("dark");
      expect(global.browser.storage.local.set).toHaveBeenCalledWith({
        [THEME_STORAGE_KEY]: "dark",
      });
    });

    it("applies and persists a return to auto", async () => {
      document.documentElement.dataset.theme = "light";
      global.browser.storage.local.set.mockResolvedValue(undefined);
      await setTheme("auto");
      expect(themeAttr()).toBeUndefined();
      expect(global.browser.storage.local.set).toHaveBeenCalledWith({
        [THEME_STORAGE_KEY]: "auto",
      });
    });
  });
});
