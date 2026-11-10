/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * Keep-list sync (#587) in a real browser. The browsers' account transport
 * (Chrome Sync, Firefox Sync) needs a signed-in profile, which a test run
 * can't have, so "another device" is played by writing a snapshot into the
 * real storage.sync exactly as a second device's extension would: same
 * chunking, same checksum. Everything else — the real API, its quotas, its
 * change events, the background applying them — is the browser's own.
 *
 * The key names are repeated here rather than imported from
 * sync-service.ts, which can't load outside an extension build.
 */
import {
  checksum,
  serializeSnapshot,
  splitIntoChunks,
  type CompactRule,
  type SyncSnapshot,
} from "@/services/sync-snapshot";

export const SYNC_META_KEY = "syncMeta";
export const chunkKey = (index: number): string => `syncChunk${index}`;
export const OTHER_DEVICE = "e2e-other-device";

export const snapshot = (
  rules: CompactRule[],
  settings: SyncSnapshot["settings"] = {}
): SyncSnapshot => ({ v: 1, lists: { default: rules }, settings });

/** The storage.sync items a second device would write for snapshot. */
export const otherDeviceItems = (
  snap: SyncSnapshot,
  at: number
): Record<string, unknown> => {
  const text = serializeSnapshot(snap);
  const chunks = splitIntoChunks(text, 8000, chunkKey);
  const items: Record<string, unknown> = {
    [SYNC_META_KEY]: {
      v: 1,
      n: chunks.length,
      sum: checksum(text),
      at,
      dev: OTHER_DEVICE,
    },
  };
  chunks.forEach((chunk, i) => {
    items[chunkKey(i)] = chunk;
  });
  return items;
};

export type SyncMetaSeen = { n: number; dev: string; at: number; v: number };

/** The rule expressions in the storage.sync items, or undefined. */
export const syncedRules = (
  items: Record<string, unknown>
): string[] | undefined => {
  const meta = items[SYNC_META_KEY] as SyncMetaSeen | undefined;
  if (!meta) return undefined;
  const parts: unknown[] = Array.from(
    { length: meta.n },
    (_, i) => items[chunkKey(i)]
  );
  if (parts.some((part) => typeof part !== "string")) return undefined;
  try {
    return (JSON.parse(parts.join("")) as SyncSnapshot).lists.default.map(
      (rule) => rule.e
    );
  } catch {
    return undefined;
  }
};

/**
 * Hosts for a list long enough to need several chunks, with non-ASCII
 * characters so the browsers' byte counting is tested, not only ours.
 */
export const longListHosts = (count: number): string[] =>
  Array.from({ length: count }, (_, i) => {
    const n = String(i).padStart(4, "0");
    if (i % 3 === 0) return `bücher-${n}.example`;
    if (i % 3 === 1) return `例え-${n}.test`;
    return `site-${n}.example.com`;
  });

/** Hosts that together go over the 100 kB sync quota. */
export const overQuotaHosts = (count = 600): string[] =>
  Array.from(
    { length: count },
    (_, i) => `${"x".repeat(180)}-${String(i).padStart(4, "0")}.test`
  );
