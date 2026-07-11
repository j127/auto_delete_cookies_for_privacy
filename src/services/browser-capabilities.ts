/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2017-2022 Kenny Do and CAD Team; fork changes (c) 2026 j127.
 * Licensed under MIT (see LICENSE).
 */

/**
 * Build-time browser identity and the static per-browser capability map.
 *
 * Store artifacts are per-browser, so browser identity is a compile-time
 * fact (`__BROWSER__`, injected by scripts/build.ts), never runtime
 * detection — no runtime.getBrowserInfo, no UA sniffing, no API
 * duck-typing in shared code paths. Code that must diverge per browser
 * branches on this map, which keeps every platform difference documented
 * in one place and lets tests assert both sides of each branch.
 */

export type BrowserTarget = "chrome" | "firefox";

export interface BrowserCapabilities {
  /**
   * Which scoping key browsingData.remove accepts for per-site cleanup:
   * Chrome takes `origins` (full origins, scheme + host + port); Firefox
   * rejects `origins` outright and takes `hostnames` (bare hosts, exact
   * match — no subdomain expansion).
   */
  browsingDataScoping: "origins" | "hostnames";
  /**
   * Whether cache removal can be scoped to specific sites. Firefox can
   * only clear cache globally, so per-domain cleanup must exclude the
   * cache type there.
   */
  cacheHostScopable: boolean;
  /**
   * First-Party Isolation support: on Firefox every cookies.getAll that
   * enumerates across sites must pass `firstPartyDomain: null` (match any
   * FPD) or the call rejects under FPI. Chrome has no such key.
   */
  supportsFirstPartyDomain: boolean;
  /** Container tabs (contextualIdentities API) — Firefox only. */
  supportsContextualIdentities: boolean;
  /**
   * Cookie-store id scheme: Chrome uses "0" (default) / "1" (incognito);
   * Firefox uses "firefox-default" / "firefox-private" /
   * "firefox-container-<n>".
   */
  storeIdScheme: "chrome" | "firefox";
}

export const CAPABILITIES: Record<BrowserTarget, BrowserCapabilities> = {
  chrome: {
    browsingDataScoping: "origins",
    cacheHostScopable: true,
    supportsFirstPartyDomain: false,
    supportsContextualIdentities: false,
    storeIdScheme: "chrome",
  },
  firefox: {
    browsingDataScoping: "hostnames",
    cacheHostScopable: false,
    supportsFirstPartyDomain: true,
    supportsContextualIdentities: true,
    storeIdScheme: "firefox",
  },
};

/** The browser this artifact was built for. */
export const CURRENT_BROWSER: BrowserTarget = __BROWSER__;

/** The capability map of the browser this artifact was built for. */
export const browserCapabilities: BrowserCapabilities =
  CAPABILITIES[CURRENT_BROWSER];
