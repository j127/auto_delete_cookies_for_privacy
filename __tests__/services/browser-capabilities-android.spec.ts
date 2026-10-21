/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */
import { installAndroidFlavor } from "../android-flavor";

vi.stubGlobal("__BROWSER__", "firefox");
vi.resetModules();
const { browserCapabilities, hasContainerApi, hasContextMenuApi } =
  await import("@/services/browser-capabilities");
const { tabCookieStoreId } = await import("@/services/libs");

describe("runtime API presence on Firefox for Android (#534)", () => {
  it("reports containers and context menus while desktop Firefox has them", () => {
    expect(hasContainerApi()).toBe(true);
    expect(hasContextMenuApi()).toBe(true);
  });

  describe("once the APIs are gone", () => {
    beforeAll(() => installAndroidFlavor());

    it("keeps the build's container capability but reports no container API", () => {
      // The build flag stays true: the store-id scheme and container-list
      // keys are still Firefox's. Only the API is missing.
      expect(browserCapabilities.supportsContextualIdentities).toBe(true);
      expect(hasContainerApi()).toBe(false);
    });

    it("reports no context menus", () => {
      expect(hasContextMenuApi()).toBe(false);
    });

    it("keys a tab without cookieStoreId by Firefox's store ids", () => {
      // Chrome's "0" here would match no cookie (they carry
      // firefox-default), silently turning open-tab protection off.
      expect(tabCookieStoreId({ incognito: false })).toBe("firefox-default");
      expect(tabCookieStoreId({ incognito: true })).toBe("firefox-private");
    });

    it("still uses a store the tab names", () => {
      expect(
        tabCookieStoreId({ cookieStoreId: "firefox-default", incognito: false })
      ).toBe("firefox-default");
    });
  });
});
