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
 *
 * The one exception is ./system-details.ts, which reads getBrowserInfo,
 * userAgentData and the user-agent string only to DISPLAY the browser and
 * OS on the Support page for bug reports. Nothing branches on those values.
 */

import { SiteDataType } from "@/typings/enums";

export type BrowserTarget = "chrome" | "firefox";

/** browsingData types that only ride along with a site-data setting. */
export type ExtraRemovalType = "cacheStorage" | "fileSystems";

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
  /**
   * Extra browsingData types removed together with one of the extension's
   * site-data types. Chrome keeps Cache API data (`cacheStorage`) and File
   * System / origin private file system data (`fileSystems`) under keys of
   * their own that no setting named, so no cleanup ever removed them
   * (issue #464). They ride along with service workers, the Cache API's
   * main user, and with IndexedDB, as the other place sites keep
   * databases. Firefox has no per-site equivalent and must never receive
   * these keys.
   */
  extraRemovalTypes: Partial<Record<SiteDataType, ExtraRemovalType[]>>;
  /**
   * Whether cookies.remove tells a miss from a removal. Firefox resolves
   * null when no cookie matched the details. Chrome resolves with the
   * details it was given whether or not a cookie was deleted, so a silent
   * miss (a scheme-bound cookie removed through the other scheme's URL,
   * #464) looks like a removal there; cleanup re-reads the store to see
   * which cookies are really gone.
   */
  cookieRemoveReportsMisses: boolean;
  /**
   * Whether a browsingData storage removal only reaches the storage of the
   * hosts it names, whatever partition that storage sits in. Firefox's
   * `hostnames` match a storage's own host: naming the top-level site
   * leaves the storage of its cross-site frames alone (it is kept under
   * the frame's host, partitioned under the site), and naming a frame's
   * host clears that host's storage in every partition and as a site of
   * its own (issue #504). So on Firefox each cross-site frame host gets a
   * marker cookie of its own, and cleanup has to check where else that
   * host is in use before it wipes it.
   */
  storageRemovalIgnoresPartitions: boolean;
  /**
   * The site-data types whose browsingData removal can be limited to one
   * cookie store (a container, or no container) with `cookieStoreId`.
   * Firefox honors it for localStorage and IndexedDB and rejects it for
   * the others ("Firefox does not support clearing serviceWorkers with
   * 'cookieStoreId'"), checked on Firefox 158 (#504). Chrome has no
   * per-store scoping. See siteDataWipeStore for the private store.
   */
  storeScopedSiteDataTypes: ReadonlyArray<SiteDataType>;
}

export const CAPABILITIES: Record<BrowserTarget, BrowserCapabilities> = {
  chrome: {
    browsingDataScoping: "origins",
    cacheHostScopable: true,
    supportsFirstPartyDomain: false,
    supportsContextualIdentities: false,
    storeIdScheme: "chrome",
    extraRemovalTypes: {
      [SiteDataType.SERVICEWORKERS]: ["cacheStorage"],
      [SiteDataType.INDEXEDDB]: ["fileSystems"],
    },
    cookieRemoveReportsMisses: false,
    storageRemovalIgnoresPartitions: false,
    storeScopedSiteDataTypes: [],
  },
  firefox: {
    browsingDataScoping: "hostnames",
    cacheHostScopable: false,
    supportsFirstPartyDomain: true,
    supportsContextualIdentities: true,
    storeIdScheme: "firefox",
    extraRemovalTypes: {},
    cookieRemoveReportsMisses: true,
    storageRemovalIgnoresPartitions: true,
    storeScopedSiteDataTypes: [
      SiteDataType.LOCALSTORAGE,
      SiteDataType.INDEXEDDB,
    ],
  },
};

/** The browser this artifact was built for. */
export const CURRENT_BROWSER: BrowserTarget = __BROWSER__;

/** The capability map of the browser this artifact was built for. */
export const browserCapabilities: BrowserCapabilities =
  CAPABILITIES[CURRENT_BROWSER];

/*
 * Runtime API presence: the one place shared code checks whether an API
 * exists instead of reading the build-time map above. The Firefox artifact
 * is a single package for Firefox desktop and Firefox for Android (#534),
 * and Android lacks APIs desktop has: contextualIdentities is undefined
 * from Firefox for Android 138 on (and did nothing before), and there are
 * no context menus and no windows API. The map says what the build is for;
 * these say whether the browser running it has the API at all.
 */

/**
 * Whether container tabs can be used here: a build with container support
 * running in a browser that has the contextualIdentities API.
 */
export const hasContainerApi = (): boolean =>
  browserCapabilities.supportsContextualIdentities &&
  browser.contextualIdentities !== undefined;

/** Whether the browser has context menus (Firefox for Android does not). */
export const hasContextMenuApi = (): boolean =>
  browser.contextMenus !== undefined;
