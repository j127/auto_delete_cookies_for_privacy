/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */
import * as React from "react";
import { useStore } from "react-redux";
import {
  collectSiteData,
  removeSiteCookie,
} from "@/services/site-data-service";

interface OwnProps {
  tab: browser.tabs.Tab;
  /**
   * Bumped by the popup whenever the cookie-count port reports a change
   * (every clean sets the marker cookie, so cleans land here too) — the
   * panel re-collects so deletions are immediately visible.
   */
  dataVersion: number;
  /**
   * Advanced mode: each cookie row gets a button that deletes that one
   * cookie (#592).
   */
  canDelete?: boolean;
}

/** 1536 -> "1.5 kB"; sizes are estimates, one decimal is plenty. */
export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["kB", "MB", "GB"];
  let value = bytes;
  let unit = "B";
  for (const next of units) {
    if (value < 1024) break;
    value /= 1024;
    unit = next;
  }
  return `${value.toFixed(1)} ${unit}`;
};

const msg = (key: string, substitutions?: string[]): string =>
  browser.i18n.getMessage(key, substitutions);

type CategoryRow = {
  key: string;
  label: string;
  /** null: the page did not expose this API. */
  count: number | null;
  /** Bytes for the category where known (summed items or usageDetails). */
  bytes: number | null;
  details: string[];
  /** The cookies row's entries, rendered by CookieList. */
  cookies?: ReadonlyArray<SiteDataCookieEntry>;
};

const cookieDetail = (cookie: SiteDataCookieEntry): string => {
  const expiry = cookie.session
    ? msg("siteDataSessionCookieText")
    : msg("siteDataExpiresText", [
        cookie.expirationDate !== undefined
          ? new Date(cookie.expirationDate * 1000).toLocaleDateString()
          : "?",
      ]);
  return `${cookie.name} — ${formatBytes(cookie.sizeBytes)} · ${expiry}`;
};

const storageDetail = (entry: SiteDataStorageEntry): string =>
  `${entry.key} — ${formatBytes(entry.sizeBytes)}`;

const sumBytes = (
  entries: ReadonlyArray<{ sizeBytes: number }> | null | undefined
): number | null =>
  entries && entries.length > 0
    ? entries.reduce((total, entry) => total + entry.sizeBytes, 0)
    : entries
      ? 0
      : null;

const buildRows = (inventory: SiteDataInventory): CategoryRow[] => {
  const cookies = inventory.cookies ?? [];
  const page = inventory.page;
  const details = page?.usageDetails ?? {};
  return [
    {
      key: "cookies",
      label: msg("cookiesText"),
      count: cookies.length,
      bytes: sumBytes(cookies),
      details: cookies.map(cookieDetail),
      cookies,
    },
    {
      key: "localStorage",
      label: msg("localStorageText"),
      count: page?.localStorage ? page.localStorage.length : null,
      bytes: sumBytes(page?.localStorage),
      details: (page?.localStorage ?? []).map(storageDetail),
    },
    {
      key: "sessionStorage",
      label: msg("sessionStorageText"),
      count: page?.sessionStorage ? page.sessionStorage.length : null,
      bytes: sumBytes(page?.sessionStorage),
      details: (page?.sessionStorage ?? []).map(storageDetail),
    },
    {
      key: "indexedDB",
      label: msg("indexedDBText"),
      count: page?.indexedDB ? page.indexedDB.length : null,
      // No per-database sizes exist; Chromium's usageDetails carries the total.
      bytes: details.indexedDB ?? null,
      details: (page?.indexedDB ?? []).map((db) =>
        db.version !== null ? `${db.name} (v${db.version})` : db.name
      ),
    },
    {
      key: "cacheStorage",
      label: msg("cacheText"),
      count: page?.cacheStorage ? page.cacheStorage.length : null,
      bytes: details.caches ?? null,
      details: [...(page?.cacheStorage ?? [])],
    },
    {
      key: "serviceWorkers",
      label: msg("serviceWorkersText"),
      count: page?.serviceWorkers ? page.serviceWorkers.length : null,
      bytes: details.serviceWorkerRegistrations ?? null,
      details: [...(page?.serviceWorkers ?? [])],
    },
  ];
};

/** The cookie list shows its filter box from this many cookies on (#592). */
export const COOKIE_FILTER_THRESHOLD = 10;

/**
 * The filter's matching: case-insensitive, and blind to spaces, dots,
 * underscores and hyphens, so "sessionid" finds "session_id" and
 * "SESSION-ID". A plain "contains" rather than fuzzy matching, which
 * turns up noise among short technical cookie names.
 */
export const normalizeForFilter = (text: string): string =>
  text.toLowerCase().replace(/[\s._-]+/g, "");

export const matchesCookieFilter = (
  cookie: SiteDataCookieEntry,
  query: string
): boolean => {
  const wanted = normalizeForFilter(query);
  return (
    wanted === "" ||
    normalizeForFilter(cookie.name).includes(wanted) ||
    normalizeForFilter(cookie.domain).includes(wanted)
  );
};

/** One string per stored cookie: same-name cookies differ in the rest. */
const cookieIdentity = (cookie: SiteDataCookieEntry): string =>
  [
    cookie.storeId,
    cookie.domain,
    cookie.path,
    cookie.name,
    cookie.partitionKey?.topLevelSite ?? "",
    String(cookie.partitionKey?.hasCrossSiteAncestor ?? ""),
    cookie.firstPartyDomain ?? "",
  ].join("|");

/** Where a cookie lives, for its row's tooltip. */
const cookieWhere = (cookie: SiteDataCookieEntry): string =>
  `${cookie.domain}${cookie.path}${
    cookie.partitionKey?.topLevelSite
      ? ` (${cookie.partitionKey.topLevelSite})`
      : ""
  }`;

/**
 * The cookies row's list (#592): a filter box once the list is long, and
 * in advanced mode a button per cookie that deletes exactly that cookie.
 */
const CookieList: React.FunctionComponent<{
  cookies: ReadonlyArray<SiteDataCookieEntry>;
  canDelete: boolean;
  onDeleted: () => void;
}> = ({ cookies, canDelete, onDeleted }) => {
  const [query, setQuery] = React.useState("");
  const [busy, setBusy] = React.useState<string | undefined>(undefined);
  const [failed, setFailed] = React.useState<ReadonlySet<string>>(
    () => new Set()
  );
  const shown = cookies.filter((cookie) => matchesCookieFilter(cookie, query));

  const remove = async (cookie: SiteDataCookieEntry) => {
    const id = cookieIdentity(cookie);
    setBusy(id);
    const removed = await removeSiteCookie(cookie);
    setBusy(undefined);
    if (removed) {
      onDeleted();
    } else {
      setFailed((previous) => new Set(previous).add(id));
    }
  };

  return (
    <div className="px-3 pb-2" id="cookieList">
      {/* Stays while it holds a query, even once deletions shorten the
          list below the threshold: a hidden box would keep filtering. */}
      {(cookies.length >= COOKIE_FILTER_THRESHOLD || query !== "") && (
        <input
          aria-label={msg("siteDataFilterCookiesText")}
          className="input mb-1 w-full input-xs"
          id="cookieFilter"
          onChange={(event) => setQuery(event.target.value)}
          placeholder={msg("siteDataFilterCookiesText")}
          type="search"
          value={query}
        />
      )}
      {shown.length === 0 ? (
        <p className="py-0.5 text-xs text-base-content/60">
          {msg("siteDataNoMatchingCookiesText")}
        </p>
      ) : (
        <ul className="max-h-40 overflow-auto font-mono text-xs">
          {shown.map((cookie) => {
            const id = cookieIdentity(cookie);
            return (
              <li
                className="flex items-center gap-1 py-0.5"
                key={id}
                title={cookieWhere(cookie)}
              >
                <span className="min-w-0 flex-1 truncate">
                  {cookieDetail(cookie)}
                </span>
                {failed.has(id) && (
                  <span className="shrink-0 text-error">
                    {msg("siteDataDeleteFailedText")}
                  </span>
                )}
                {canDelete && (
                  <button
                    aria-label={msg("siteDataDeleteCookieTitle", [cookie.name])}
                    className="btn h-5 min-h-0 shrink-0 btn-ghost px-1 btn-xs"
                    disabled={busy === id}
                    onClick={() => void remove(cookie)}
                    title={msg("siteDataDeleteCookieTitle", [cookie.name])}
                    type="button"
                  >
                    ×
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

/**
 * The read-only counterpart of the popup's clean buttons (#112): what the
 * visited site currently stores, per category. Collapsed by default so the
 * popup stays compact; the inventory is collected on mount and re-collected
 * whenever dataVersion bumps or the refresh button is pressed.
 */
const SiteDataPanel: React.FunctionComponent<OwnProps> = ({
  tab,
  dataVersion,
  canDelete = false,
}) => {
  const store = useStore();
  // undefined = the first collect hasn't landed yet (loading state).
  const [inventory, setInventory] = React.useState<
    SiteDataInventory | undefined
  >(undefined);
  const [manualRefresh, setManualRefresh] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    // The loading state shows only until the first collect lands. A
    // re-collect (the refresh button, a clean, a deleted cookie) keeps the
    // current inventory on screen until the new one replaces it: going back
    // to the loading state first rebuilt every row, which closed the open
    // ones and cleared the cookie filter after each change (#592).
    collectSiteData(store.getState() as State, tab)
      // collectSiteData resolves { available: false } for everything it
      // anticipates; this catch only guards against the unexpected so the
      // panel can never wedge in the loading state.
      .catch((): SiteDataInventory => ({ available: false }))
      .then((result) => {
        if (!cancelled) setInventory(result);
      });
    return () => {
      cancelled = true;
    };
  }, [store, tab, dataVersion, manualRefresh]);

  const body = () => {
    if (inventory === undefined) {
      return (
        <p className="px-4 pb-3 text-sm text-base-content/70">
          {msg("siteDataLoadingText")}
        </p>
      );
    }
    if (!inventory.available) {
      return (
        <p className="px-4 pb-3 text-sm text-base-content/70">
          {msg("siteDataNotAvailableText")}
        </p>
      );
    }
    const rows = buildRows(inventory);
    const empty = rows.every((row) => row.count === null || row.count === 0);
    if (empty) {
      return (
        <p className="px-4 pb-3 text-sm text-base-content/70">
          {msg("siteDataEmptyText")}
        </p>
      );
    }
    return (
      <div className="flex flex-col gap-1 px-4 pb-3">
        {rows.map((row) => (
          <details key={row.key} className="rounded-field bg-base-200/50">
            <summary className="flex cursor-pointer items-center gap-2 px-2 py-1 text-sm">
              <span className="min-w-0 flex-1 truncate">{row.label}</span>
              {row.bytes !== null && row.bytes > 0 && (
                <span className="text-xs text-base-content/60">
                  {formatBytes(row.bytes)}
                </span>
              )}
              <span className="badge badge-sm">
                {row.count === null ? msg("siteDataUnknownText") : row.count}
              </span>
            </summary>
            {row.cookies && row.cookies.length > 0 ? (
              <CookieList
                canDelete={canDelete}
                cookies={row.cookies}
                onDeleted={() => setManualRefresh((n) => n + 1)}
              />
            ) : (
              row.details.length > 0 && (
                <ul className="max-h-40 overflow-auto px-3 pb-2 font-mono text-xs">
                  {row.details.map((line, i) => (
                    // Stateless read-only lines that can repeat, so the index is
                    // the only stable identity.
                    // eslint-disable-next-line @eslint-react/no-array-index-key
                    <li key={`${row.key}-${i}`} className="truncate py-0.5">
                      {line}
                    </li>
                  ))}
                </ul>
              )
            )}
          </details>
        ))}
        {inventory.page?.usage != null && inventory.page?.quota != null && (
          <p className="pt-1 text-xs text-base-content/60">
            {msg("siteDataUsageText", [
              formatBytes(inventory.page.usage),
              formatBytes(inventory.page.quota),
            ])}
          </p>
        )}
      </div>
    );
  };

  return (
    <details className="border-t border-base-300" id="siteDataPanel">
      <summary className="flex cursor-pointer items-center px-4 py-2 text-center text-sm text-base-content/70">
        <span className="flex-1">{msg("siteDataPanelTitle")}</span>
        <button
          className="btn btn-ghost btn-xs"
          title={msg("siteDataRefreshTitle")}
          onClick={(event) => {
            // Inside the <summary>: refresh must not toggle the panel.
            event.preventDefault();
            event.stopPropagation();
            setManualRefresh((n) => n + 1);
          }}
        >
          ↻
        </button>
      </summary>
      {body()}
    </details>
  );
};

export default SiteDataPanel;
