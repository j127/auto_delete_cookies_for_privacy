/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */
import * as React from "react";
import { useStore } from "react-redux";
import { collectSiteData } from "@/services/site-data-service";

interface OwnProps {
  tab: browser.tabs.Tab;
  /**
   * Bumped by the popup whenever the cookie-count port reports a change
   * (every clean sets the marker cookie, so cleans land here too) — the
   * panel re-collects so deletions are immediately visible.
   */
  dataVersion: number;
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

/**
 * The read-only counterpart of the popup's clean buttons (#112): what the
 * visited site currently stores, per category. Collapsed by default so the
 * popup stays compact; the inventory is collected on mount and re-collected
 * whenever dataVersion bumps or the refresh button is pressed.
 */
const SiteDataPanel: React.FunctionComponent<OwnProps> = ({
  tab,
  dataVersion,
}) => {
  const store = useStore();
  // undefined = collecting (loading state).
  const [inventory, setInventory] = React.useState<
    SiteDataInventory | undefined
  >(undefined);
  const [manualRefresh, setManualRefresh] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    setInventory(undefined);
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
            {row.details.length > 0 && (
              <ul className="max-h-40 overflow-auto px-3 pb-2 font-mono text-xs">
                {row.details.map((line, i) => (
                  <li key={`${row.key}-${i}`} className="truncate py-0.5">
                    {line}
                  </li>
                ))}
              </ul>
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
