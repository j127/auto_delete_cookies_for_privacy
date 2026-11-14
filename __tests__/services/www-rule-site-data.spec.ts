/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * Issue #603. Keep rules treat www.example.com and example.com as one
 * site: cookie cleanup matches rules against the host with its www.
 * dropped (getHostname). The site-data guard matched the raw host instead,
 * and a rule typed as www.example.com matched nothing at all. The Firefox
 * side, where a wipe also names the site's own hosts, is in
 * www-rule-site-data-firefox.spec.ts.
 */
import { initialState } from "@/redux/state";
import {
  isDomainProtectedInAnyStore,
  isSafeToClean,
  prepareCookie,
} from "@/services/cleanup-service";
import {
  ListType,
  ReasonClean,
  ReasonKeep,
  SiteDataType,
} from "@/typings/enums";

const keep = (expression: string, storeId = "default"): Expression => ({
  expression,
  id: expression,
  listType: ListType.WHITE,
  storeId,
});

const chromeCookie = (domain: string): browser.cookies.Cookie =>
  ({
    domain,
    hostOnly: !domain.startsWith("."),
    httpOnly: false,
    name: "SID",
    path: "/",
    sameSite: "lax",
    secure: true,
    session: false,
    storeId: "0",
    value: "v",
  }) as browser.cookies.Cookie;

const cleanupProperties = {
  cachedResults: { dateTime: "", recentlyCleaned: 0 },
  greyCleanup: false,
  hostnamesDeleted: new Set<string>(),
  ignoreOpenTabs: false,
  openTabDomains: {},
  setOfDeletedDomainCookies: new Set<string>(),
} as unknown as CleanupPropertiesInternal;

const verdict = (state: State, domain: string) =>
  isSafeToClean(state, prepareCookie(chromeCookie(domain)), cleanupProperties);

describe("isDomainProtectedInAnyStore() and www. hosts (#603)", () => {
  // The rule sits in another list than the one of the cookie that asked
  // for the wipe, the case this guard exists for (#281).
  const state: State = {
    ...initialState,
    lists: { default: [], private: [keep("youtube.com", "private")] },
  };
  const isProtected = (host: string): boolean =>
    isDomainProtectedInAnyStore(state, {}, host, SiteDataType.SERVICEWORKERS);

  it("protects the www host with a rule for the bare domain", () => {
    expect(isProtected("youtube.com")).toBe(true);
    expect(isProtected("www.youtube.com")).toBe(true);
    expect(isProtected(".www.youtube.com")).toBe(true);
  });

  it("does not protect other subdomains", () => {
    expect(isProtected("m.youtube.com")).toBe(false);
  });
});

describe("a keep rule typed with www. (#603)", () => {
  const state: State = {
    ...initialState,
    lists: { default: [keep("www.youtube.com")] },
  };

  it("keeps the cookies of the bare domain and the www host", () => {
    for (const domain of [".youtube.com", "www.youtube.com"]) {
      const result = verdict(state, domain);
      expect(result.cleanCookie).toBe(false);
      expect(result.reason).toBe(ReasonKeep.MatchedExpression);
    }
  });

  it("does not keep other subdomains", () => {
    const result = verdict(state, "m.youtube.com");
    expect(result.cleanCookie).toBe(true);
    expect(result.reason).toBe(ReasonClean.NoMatchedExpression);
  });

  it("protects the site's storage like a rule for the bare domain", () => {
    expect(
      isDomainProtectedInAnyStore(
        state,
        {},
        "www.youtube.com",
        SiteDataType.INDEXEDDB
      )
    ).toBe(true);
  });
});
