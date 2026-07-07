/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2017-2022 Kenny Do and CAD Team; fork changes (c) 2026 j127.
 * Licensed under MIT (see LICENSE).
 */

/**
 * Shapes for the popup's site data inspector (#112): what a site currently
 * stores, per category. Produced by src/services/site-data-service.ts.
 *
 * Page-context categories are `null` when the page API is unavailable
 * (the injected collector is JSON-serialized by chrome.scripting, which
 * drops `undefined` — null is the explicit "unknown" marker).
 */

type SiteDataCookieEntry = Readonly<{
  name: string;
  /** Approximate: UTF-8 byte length of name + value. */
  sizeBytes: number;
  session: boolean;
  /** Seconds since epoch; only present when session is false. */
  expirationDate?: number;
  secure: boolean;
  httpOnly: boolean;
}>;

type SiteDataStorageEntry = Readonly<{
  key: string;
  /** Approximate: UTF-8 byte length of key + value. */
  sizeBytes: number;
}>;

type SiteDataDatabaseEntry = Readonly<{
  name: string;
  version: number | null;
}>;

type SiteDataPageInventory = Readonly<{
  localStorage: ReadonlyArray<SiteDataStorageEntry> | null;
  sessionStorage: ReadonlyArray<SiteDataStorageEntry> | null;
  indexedDB: ReadonlyArray<SiteDataDatabaseEntry> | null;
  /** Cache Storage cache names. */
  cacheStorage: ReadonlyArray<string> | null;
  /** Service worker registration scopes. */
  serviceWorkers: ReadonlyArray<string> | null;
  /** navigator.storage.estimate() for the origin. */
  usage: number | null;
  quota: number | null;
  /** Chromium's per-category byte breakdown from estimate().usageDetails. */
  usageDetails: Readonly<{ [category: string]: number }> | null;
}>;

type SiteDataInventory = Readonly<{
  /** false: restricted page (chrome://, Web Store, no URL) or injection rejected. */
  available: boolean;
  hostname?: string;
  cookies?: ReadonlyArray<SiteDataCookieEntry>;
  /** null when the page returned nothing despite a successful injection. */
  page?: SiteDataPageInventory | null;
}>;
