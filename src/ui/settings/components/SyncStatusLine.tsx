/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */
import * as React from "react";
import { SYNC_STATUS_KEY, type SyncStatus } from "@/services/sync-snapshot";

const kilobytes = (bytes: number): string => `${Math.ceil(bytes / 1024)} kB`;

/** The sentence and tone for a sync status (#587). */
export const describeSyncStatus = (
  status: SyncStatus | undefined
): { text: string; warning: boolean } => {
  if (status === undefined) {
    return {
      text: browser.i18n.getMessage("syncStatusWaitingText"),
      warning: false,
    };
  }
  switch (status.state) {
    case "ok":
      return {
        text: browser.i18n.getMessage("syncStatusOkText", [
          new Date(status.at).toLocaleString(),
        ]),
        warning: false,
      };
    case "tooLarge":
      return {
        text: browser.i18n.getMessage("syncStatusTooLargeText", [
          kilobytes(status.bytes),
          kilobytes(status.quota),
        ]),
        warning: true,
      };
    case "newerVersion":
      return {
        text: browser.i18n.getMessage("syncStatusNewerText"),
        warning: true,
      };
    case "error":
      return {
        text: browser.i18n.getMessage("syncStatusErrorText", [status.message]),
        warning: true,
      };
  }
};

/**
 * Shows how sync is doing, as the background last recorded it in
 * storage.local, and follows its changes while the page is open.
 */
const SyncStatusLine: React.FunctionComponent = () => {
  const [status, setStatus] = React.useState<SyncStatus | undefined>(undefined);

  React.useEffect(() => {
    let cancelled = false;
    browser.storage.local
      .get(SYNC_STATUS_KEY)
      .then((stored) => {
        if (!cancelled) {
          setStatus(stored[SYNC_STATUS_KEY] as SyncStatus | undefined);
        }
      })
      .catch(() => {
        // Unreadable: keep showing the waiting line.
      });
    const onChanged = (
      changes: { [key: string]: { newValue?: unknown } },
      areaName: string
    ) => {
      if (areaName === "local" && SYNC_STATUS_KEY in changes) {
        setStatus(changes[SYNC_STATUS_KEY].newValue as SyncStatus | undefined);
      }
    };
    browser.storage.onChanged.addListener(onChanged);
    return () => {
      cancelled = true;
      browser.storage.onChanged.removeListener(onChanged);
    };
  }, []);

  const { text, warning } = describeSyncStatus(status);
  return (
    <p
      className={`px-4 py-2.5 text-sm ${
        warning ? "text-warning" : "text-base-content/70"
      }`}
      id="syncStatus"
      role="status"
    >
      {text}
    </p>
  );
};

export default SyncStatusLine;
