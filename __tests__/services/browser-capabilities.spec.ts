/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2017-2022 Kenny Do and CAD Team; fork changes (c) 2026 j127.
 * Licensed under MIT (see LICENSE).
 */
import {
  browserCapabilities,
  CAPABILITIES,
  CURRENT_BROWSER,
} from "@/services/browser-capabilities";

describe("CAPABILITIES", () => {
  it("declares the chrome capability map", () => {
    expect(CAPABILITIES.chrome).toEqual({
      browsingDataScoping: "origins",
      cacheHostScopable: true,
      supportsFirstPartyDomain: false,
      supportsContextualIdentities: false,
      storeIdScheme: "chrome",
    });
  });

  it("declares the firefox capability map", () => {
    expect(CAPABILITIES.firefox).toEqual({
      browsingDataScoping: "hostnames",
      cacheHostScopable: false,
      supportsFirstPartyDomain: true,
      supportsContextualIdentities: true,
      storeIdScheme: "firefox",
    });
  });
});

describe("CURRENT_BROWSER binding", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("defaults to chrome under the test setup", () => {
    expect(CURRENT_BROWSER).toBe("chrome");
    expect(browserCapabilities).toEqual(CAPABILITIES.chrome);
  });

  it("binds to the firefox map when built for firefox", async () => {
    vi.stubGlobal("__BROWSER__", "firefox");
    vi.resetModules();
    const firefoxFlavored = await import("@/services/browser-capabilities");
    expect(firefoxFlavored.CURRENT_BROWSER).toBe("firefox");
    expect(firefoxFlavored.browserCapabilities).toEqual(
      firefoxFlavored.CAPABILITIES.firefox
    );
  });
});
