/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2017-2022 Kenny Do and CAD Team; fork changes (c) 2026 j127.
 * Licensed under MIT (see LICENSE).
 */

/**
 * Site data inspector collector (#113): answers "what does this site
 * currently store?" per category. UI-independent — the popup panel (#114)
 * renders the SiteDataInventory this returns.
 *
 * Cookies are enumerated extension-side through the same helper the popup
 * count uses; everything else has to be read in page context, because an
 * extension cannot enumerate another origin's localStorage/IndexedDB/caches
 * directly. The page half follows the clearTabStorages pattern in
 * cleanup-service.ts: one self-contained function injected with
 * browser.scripting.executeScript.
 */

import {
  ADCPCOOKIENAME,
  cookieStillStored,
  getAllCookiesForDomain,
  getHostname,
  prepareCookieDomain,
  removeCookieAtEveryScheme,
} from "./libs";

const utf8Length = (s: string): number => new TextEncoder().encode(s).length;

/**
 * Injected into the inspected tab. Serialized by chrome.scripting, so it
 * must stay fully self-contained (no closure references, no imports) and
 * its return value must be JSON-serializable: null, never undefined, marks
 * an unavailable category. Every category is feature-guarded so a missing
 * or throwing API degrades to null instead of failing the whole call.
 *
 * Exported for direct unit testing (it never runs in the extension
 * context — only inside the inspected page).
 */
export async function collectPageStorage(): Promise<SiteDataPageInventory> {
  const utf8 = (s: string): number => new TextEncoder().encode(s).length;
  const readStorage = (
    storage: Storage
  ): { key: string; sizeBytes: number }[] => {
    const entries: { key: string; sizeBytes: number }[] = [];
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (key === null) continue;
      entries.push({
        key,
        sizeBytes: utf8(key) + utf8(storage.getItem(key) ?? ""),
      });
    }
    return entries;
  };

  let localStorageEntries: SiteDataStorageEntry[] | null = null;
  let sessionStorageEntries: SiteDataStorageEntry[] | null = null;
  let indexedDBEntries: SiteDataDatabaseEntry[] | null = null;
  let cacheNames: string[] | null = null;
  let serviceWorkerScopes: string[] | null = null;
  let usage: number | null = null;
  let quota: number | null = null;
  let usageDetails: { [category: string]: number } | null = null;

  try {
    localStorageEntries = readStorage(window.localStorage);
  } catch {
    // Storage access can throw (e.g. blocked third-party context).
  }
  try {
    sessionStorageEntries = readStorage(window.sessionStorage);
  } catch {
    // See above.
  }
  try {
    // indexedDB.databases() is Chromium-only; guard for absence.
    if (window.indexedDB && "databases" in window.indexedDB) {
      indexedDBEntries = (await window.indexedDB.databases()).map((db) => ({
        name: db.name ?? "",
        version: db.version ?? null,
      }));
    }
  } catch {
    // Unavailable stays null.
  }
  try {
    if ("caches" in window) {
      cacheNames = await window.caches.keys();
    }
  } catch {
    // Unavailable stays null.
  }
  try {
    if (navigator.serviceWorker) {
      serviceWorkerScopes = (
        await navigator.serviceWorker.getRegistrations()
      ).map((registration) => registration.scope);
    }
  } catch {
    // Unavailable stays null.
  }
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      usage = estimate.usage ?? null;
      quota = estimate.quota ?? null;
      // usageDetails is a Chromium extension to StorageEstimate.
      usageDetails =
        (estimate as { usageDetails?: { [category: string]: number } })
          .usageDetails ?? null;
    }
  } catch {
    // Unavailable stays null.
  }

  return {
    localStorage: localStorageEntries,
    sessionStorage: sessionStorageEntries,
    indexedDB: indexedDBEntries,
    cacheStorage: cacheNames,
    serviceWorkers: serviceWorkerScopes,
    usage,
    quota,
    usageDetails,
  };
}

/**
 * Collects the per-category site data inventory for a tab. Restricted pages
 * (chrome://, about:, no URL, and anything that rejects script injection —
 * Web Store, extension pages, discarded tabs) resolve to
 * `{ available: false }` rather than throwing.
 */
export const collectSiteData = async (
  state: State,
  tab: browser.tabs.Tab
): Promise<SiteDataInventory> => {
  const hostname = getHostname(tab.url);
  if (
    !tab.url ||
    tab.url.startsWith("about:") ||
    tab.url.startsWith("chrome:") ||
    hostname === "" ||
    tab.id === undefined
  ) {
    return { available: false };
  }

  const rawCookies = (await getAllCookiesForDomain(state, tab)) ?? [];
  const cookies = rawCookies
    .filter((cookie) => cookie.name !== ADCPCOOKIENAME)
    .map((cookie) => ({
      name: cookie.name,
      sizeBytes: utf8Length(cookie.name) + utf8Length(cookie.value),
      session: cookie.session,
      ...(cookie.session ? {} : { expirationDate: cookie.expirationDate }),
      secure: cookie.secure,
      httpOnly: cookie.httpOnly,
      domain: cookie.domain,
      path: cookie.path,
      hostOnly: cookie.hostOnly,
      storeId: cookie.storeId,
      ...(cookie.partitionKey?.topLevelSite !== undefined && {
        partitionKey: cookie.partitionKey,
      }),
      ...(cookie.firstPartyDomain !== undefined && {
        firstPartyDomain: cookie.firstPartyDomain,
      }),
    }));

  let results: Awaited<ReturnType<typeof browser.scripting.executeScript>>;
  try {
    results = await browser.scripting.executeScript({
      target: { tabId: tab.id },
      func: collectPageStorage,
    });
  } catch {
    // Injection rejected: restricted page or unreachable tab.
    return { available: false };
  }

  const page =
    (results?.[0]?.result as SiteDataPageInventory | undefined) ?? null;

  return { available: true, hostname, cookies, page };
};

/**
 * Deletes one cookie from the popup's cookie list (#592): exactly that
 * cookie, with its store, partition and first-party domain, through the
 * same removal the cleanup uses. Chrome's cookies.remove matches by url and
 * name, so a same-name cookie on a parent domain that the url would be
 * sent can go with it; that is the API's limit, as during a cleanup.
 * Resolves true once the cookie is no longer stored: Chrome resolves even
 * when nothing was removed, so the store is read again to be sure.
 */
export const removeSiteCookie = async (
  cookie: SiteDataCookieEntry
): Promise<boolean> => {
  const details = {
    name: cookie.name,
    storeId: cookie.storeId,
    url: prepareCookieDomain(cookie as unknown as browser.cookies.Cookie),
    ...(cookie.firstPartyDomain !== undefined && {
      firstPartyDomain: cookie.firstPartyDomain,
    }),
    ...(cookie.partitionKey !== undefined && {
      partitionKey: cookie.partitionKey,
    }),
  };
  try {
    await removeCookieAtEveryScheme(details, cookie);
  } catch {
    return false;
  }
  return !(await cookieStillStored(details, cookie));
};
