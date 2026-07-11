/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2017-2022 Kenny Do and CAD Team; fork changes (c) 2026 j127.
 * Licensed under MIT (see LICENSE).
 */

/**
 * Compile-time contracts for the Firefox-aware typings in
 * src/typings/webext.d.ts. These specs exist so `just check` (tsc) fails
 * if the ambient types regress — the runtime assertions are trivial on
 * purpose; the literals ARE the test.
 */

describe("webext.d.ts Firefox-aware typings", () => {
  it("types cookies without firstPartyDomain (Chrome shape)", () => {
    const chromeCookie: browser.cookies.Cookie = {
      domain: "example.com",
      hostOnly: true,
      httpOnly: false,
      name: "a",
      path: "/",
      sameSite: "lax",
      secure: true,
      session: false,
      storeId: "0",
      value: "b",
    };
    expect(chromeCookie.firstPartyDomain).toBeUndefined();
    expect(chromeCookie.partitionKey).toBeUndefined();
  });

  it("types cookies with firstPartyDomain and partitionKey (Firefox shape)", () => {
    const firefoxCookie: browser.cookies.Cookie = {
      domain: "example.com",
      firstPartyDomain: "example.com",
      hostOnly: true,
      httpOnly: false,
      name: "a",
      partitionKey: { topLevelSite: "https://top.example" },
      path: "/",
      sameSite: "no_restriction",
      secure: true,
      session: false,
      storeId: "firefox-default",
      value: "b",
    };
    expect(firefoxCookie.firstPartyDomain).toBe("example.com");
    expect(firefoxCookie.partitionKey?.topLevelSite).toBe(
      "https://top.example"
    );
  });

  it("types the standalone PartitionKey shape", () => {
    const matchAll: browser.cookies.PartitionKey = {};
    const specific: browser.cookies.PartitionKey = {
      topLevelSite: "https://top.example",
    };
    expect(matchAll.topLevelSite).toBeUndefined();
    expect(specific.topLevelSite).toBe("https://top.example");
  });

  it("types browsingData.RemovalOptions with both scoping keys", () => {
    const chromeScoped: browser.browsingData.RemovalOptions = {
      origins: ["https://example.com"],
    };
    const firefoxScoped: browser.browsingData.RemovalOptions = {
      cookieStoreId: "firefox-default",
      hostnames: ["example.com", "www.example.com"],
    };
    expect(chromeScoped.origins).toHaveLength(1);
    expect(firefoxScoped.hostnames).toHaveLength(2);
    expect(firefoxScoped.cookieStoreId).toBe("firefox-default");
  });

  it("types contextualIdentities containers", () => {
    const container: browser.contextualIdentities.ContextualIdentity = {
      cookieStoreId: "firefox-container-1",
      color: "blue",
      colorCode: "#37adff",
      icon: "fingerprint",
      iconUrl: "resource://usercontext-content/fingerprint.svg",
      name: "Personal",
    };
    expect(container.cookieStoreId).toBe("firefox-container-1");
  });
});
