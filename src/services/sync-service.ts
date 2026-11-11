/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * Keep-list sync through the browser account (#587). The browser's sync
 * storage carries a snapshot (see sync-snapshot.ts) between the devices
 * signed in to one account; this service writes this device's snapshot
 * there and applies the ones other devices write.
 *
 * - Off by default; each device turns it on for itself (SYNC_ENABLED).
 * - The first sync on a device merges: rules from both sides are kept.
 *   After that the newest change wins.
 * - Local edits are written after a short debounce, and only the chunks that
 *   changed are written, to stay far below the browsers' write limits.
 * - A change from another device is applied in one store action, never
 *   echoes back as a write, and never starts a cleanup or a site-data wipe.
 * - Everything runs one task at a time (enqueue), because the storage
 *   events and the debounced writes interleave across awaits.
 *
 * The service worker can stop at any idle moment: nothing here relies on
 * memory surviving that. What must survive (this device's id, the last
 * write, the last applied snapshot) lives in storage.local.
 */
import { SettingID } from "@/typings/enums";
import { ReduxConstants } from "@/typings/redux-constants";
import { hasSyncStorageApi } from "./browser-capabilities";
import { adcpLog, uid } from "./libs";
import SettingService from "./setting-service";
import StoreUser from "./store-user";
import {
  buildSnapshot,
  checksum,
  itemBytes,
  mergeSnapshots,
  parseSnapshot,
  serializeSnapshot,
  snapshotToSyncedData,
  splitIntoChunks,
  SYNC_FORMAT_VERSION,
  SYNC_STATUS_KEY,
  SYNCED_LISTS,
  type SyncSnapshot,
  type SyncStatus,
} from "./sync-snapshot";

/** Sync storage: the meta item describing the current snapshot. */
export const SYNC_META_KEY = "syncMeta";
/** Sync storage: the snapshot's chunks are syncChunk0, syncChunk1, ... */
export const SYNC_CHUNK_PREFIX = "syncChunk";
/** storage.local: this device's sync bookkeeping. */
export const SYNC_BOOKKEEPING_KEY = "syncBookkeeping";

/** Total sync quota, the same on Chrome and Firefox. */
export const QUOTA_BYTES = 102400;
/** Per-item sync quota (key plus JSON value, UTF-8 bytes), on both. */
export const QUOTA_BYTES_PER_ITEM = 8192;
/** Chunks stay this far under the per-item quota, as a safety margin. */
const ITEM_MARGIN = 192;
/** One write per burst of local edits. */
export const WRITE_DELAY_MS = 1000;

export const chunkKey = (index: number): string =>
  `${SYNC_CHUNK_PREFIX}${index}`;

export type SyncMeta = {
  /** Snapshot format version. */
  v: number;
  /** Number of chunks. */
  n: number;
  /** Checksum of the joined chunks. */
  sum: string;
  /** When it was written (ordered after every snapshot the writer had seen). */
  at: number;
  /** Random id of the device that wrote it. */
  dev: string;
};

type Bookkeeping = {
  deviceId: string;
  /** Checksum and time of this device's last write. */
  writtenSum?: string;
  writtenAt?: number;
  /** Checksum and time of the last snapshot this device took in. */
  appliedSum?: string;
  appliedAt?: number;
};

/** The slice of a storage area this service uses. */
export interface SyncStorageArea {
  get(keys?: null | string | string[]): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
}

type RemoteRead =
  | { kind: "empty" | "incomplete" | "invalid" | "newer" }
  | { kind: "ok"; meta: SyncMeta; snapshot: SyncSnapshot; sum: string };

type Observed = {
  enabled: boolean;
  lists: ReadonlyArray<unknown>;
  settings: MapToSettingObject;
};

const isMeta = (value: unknown): value is SyncMeta => {
  if (typeof value !== "object" || value === null) return false;
  const meta = value as Record<string, unknown>;
  return (
    typeof meta.v === "number" &&
    typeof meta.n === "number" &&
    Number.isInteger(meta.n) &&
    meta.n >= 1 &&
    typeof meta.sum === "string" &&
    typeof meta.at === "number" &&
    typeof meta.dev === "string"
  );
};

const errorMessage = (e: unknown): string =>
  e instanceof Error ? e.message : String(e);

export default class SyncService extends StoreUser {
  /**
   * Starts watching on a worker start, once the store is ready, and brings
   * this device in step with the sync storage if sync is on. The caller
   * subscribes onStoreChange to the store.
   */
  public static start(): Promise<void> {
    const state = StoreUser.store.getState();
    SyncService.seen = SyncService.observe(state);
    if (!SyncService.isEnabled(state)) return Promise.resolve();
    return SyncService.enqueue(() => SyncService.reconcile());
  }

  public static isEnabled(state: State): boolean {
    return (
      hasSyncStorageApi() &&
      state.settings[SettingID.SYNC_ENABLED]?.value === true
    );
  }

  /**
   * Store subscriber: notices the sync switch, and local changes to what
   * syncs. Synchronous and cheap, since it runs on every store change.
   */
  public static onStoreChange(): void {
    const previous = SyncService.seen;
    const next = SyncService.observe(StoreUser.store.getState());
    SyncService.seen = next;
    if (previous === undefined) return;
    if (!previous.enabled && next.enabled) {
      void SyncService.enqueue(() => SyncService.reconcile());
      return;
    }
    if (previous.enabled && !next.enabled) {
      void SyncService.enqueue(() => SyncService.stop());
      return;
    }
    if (!next.enabled || SyncService.applying) return;
    const changed =
      previous.settings !== next.settings ||
      previous.lists.some((list, i) => list !== next.lists[i]);
    if (!changed) return;
    SyncService.pendingChangeAt = SyncService.now();
    SyncService.scheduleWrite();
  }

  /** storage.onChanged listener: a write from another device (or our own). */
  public static async onStorageChanged(
    changes: Record<string, unknown>,
    areaName: string
  ): Promise<void> {
    if (areaName !== "sync") return;
    const ours = Object.keys(changes).some(
      (key) => key === SYNC_META_KEY || key.startsWith(SYNC_CHUNK_PREFIX)
    );
    if (!ours || !SyncService.isEnabled(StoreUser.store.getState())) return;
    await SyncService.enqueue(() => SyncService.pull());
  }

  /** Writes a pending local change now instead of after the debounce. */
  public static flush(): Promise<void> {
    if (SyncService.timer !== undefined) {
      SyncService.cancelWrite();
      void SyncService.enqueue(() => SyncService.push(false));
    }
    return SyncService.queue;
  }

  /** Swaps the storage areas (tests); undefined restores the browser's. */
  public static setStorageAreas(
    areas: { local: SyncStorageArea; sync: SyncStorageArea } | undefined
  ): void {
    SyncService.areas = areas;
  }

  /** Forgets everything held in memory, as a worker restart would (tests). */
  public static resetMemory(): void {
    SyncService.cancelWrite();
    SyncService.seen = undefined;
    SyncService.pendingChangeAt = 0;
    SyncService.applying = false;
    SyncService.queue = Promise.resolve();
  }

  public static now: () => number = () => Date.now();

  // --- Tasks (run through enqueue) -----------------------------------------

  /**
   * Brings this device in step: on a worker start, and when sync is turned
   * on. Never synced (or turned off since): merge both sides. Otherwise take
   * whichever side changed since the last sync, and merge if both did.
   */
  protected static async reconcile(): Promise<void> {
    const state = StoreUser.store.getState();
    if (!SyncService.isEnabled(state)) return;
    const remote = await SyncService.readRemote();
    if (remote.kind === "incomplete") return; // the rest arrives as a change
    if (remote.kind === "newer") {
      await SyncService.setStatus({ state: "newerVersion" });
      return;
    }
    if (remote.kind !== "ok") {
      await SyncService.push(true);
      return;
    }
    const local = SyncService.localSnapshot(state);
    const book = await SyncService.loadBookkeeping();
    if (remote.sum === local.sum) {
      await SyncService.markInStep(book, remote);
      return;
    }
    const known = (sum: string) =>
      sum === book.writtenSum || sum === book.appliedSum;
    const neverSynced =
      book.writtenSum === undefined && book.appliedSum === undefined;
    const localChanged = !known(local.sum);
    const remoteChanged = !known(remote.sum);
    if (neverSynced || (localChanged && remoteChanged)) {
      const merged = mergeSnapshots(local.snapshot, remote.snapshot);
      await SyncService.apply(merged, book, remote);
      await SyncService.push(true);
    } else if (remoteChanged) {
      await SyncService.apply(remote.snapshot, book, remote);
    } else {
      await SyncService.push(true);
    }
  }

  /** Reacts to a change in the sync storage. Newest change wins. */
  protected static async pull(): Promise<void> {
    const state = StoreUser.store.getState();
    if (!SyncService.isEnabled(state)) return;
    const remote = await SyncService.readRemote();
    if (remote.kind === "incomplete") return;
    if (remote.kind === "newer") {
      await SyncService.setStatus({ state: "newerVersion" });
      return;
    }
    if (remote.kind !== "ok") {
      // Cleared or unreadable: put this device's snapshot back.
      await SyncService.push(true);
      return;
    }
    const local = SyncService.localSnapshot(state);
    const book = await SyncService.loadBookkeeping();
    if (remote.sum === local.sum) {
      await SyncService.markInStep(book, remote);
      return;
    }
    // Our own write, with a newer local change already on its way.
    if (remote.meta.dev === book.deviceId && remote.sum === book.writtenSum) {
      return;
    }
    const localAt = Math.max(book.writtenAt ?? 0, SyncService.pendingChangeAt);
    if (remote.meta.at <= localAt) {
      // This device changed later: its snapshot wins, so write it again.
      await SyncService.push(true);
      return;
    }
    await SyncService.apply(remote.snapshot, book, remote);
  }

  /** Writes this device's snapshot, unless the sync storage already has it. */
  protected static async push(force: boolean): Promise<void> {
    const state = StoreUser.store.getState();
    if (!SyncService.isEnabled(state)) return;
    const changeAt = SyncService.pendingChangeAt;
    const { text, sum } = SyncService.localSnapshot(state);
    const book = await SyncService.loadBookkeeping();
    if (!force && (sum === book.writtenSum || sum === book.appliedSum)) {
      SyncService.clearPending(changeAt);
      return;
    }
    const current = await SyncService.sync().get(null);
    const currentMeta = current[SYNC_META_KEY];
    if (isMeta(currentMeta) && currentMeta.v > SYNC_FORMAT_VERSION) {
      // Never overwrite a format this version can't read.
      await SyncService.setStatus({ state: "newerVersion" });
      return;
    }
    const chunks = splitIntoChunks(
      text,
      QUOTA_BYTES_PER_ITEM - ITEM_MARGIN,
      chunkKey
    );
    // Ordered after every snapshot this device has seen, so a device whose
    // clock runs behind can't lose a newer change to an older one.
    const at = Math.max(
      SyncService.now(),
      (book.appliedAt ?? 0) + 1,
      (book.writtenAt ?? 0) + 1
    );
    const meta: SyncMeta = {
      v: SYNC_FORMAT_VERSION,
      n: chunks.length,
      sum: checksum(text),
      at,
      dev: book.deviceId,
    };
    const bytes = chunks.reduce(
      (total, chunk, i) => total + itemBytes(chunkKey(i), chunk),
      itemBytes(SYNC_META_KEY, meta)
    );
    if (bytes > QUOTA_BYTES) {
      await SyncService.setStatus({
        state: "tooLarge",
        bytes,
        quota: QUOTA_BYTES,
      });
      return;
    }
    const items: Record<string, unknown> = {};
    chunks.forEach((chunk, i) => {
      if (current[chunkKey(i)] !== chunk) items[chunkKey(i)] = chunk;
    });
    items[SYNC_META_KEY] = meta;
    const stale = Object.keys(current).filter(
      (key) =>
        key.startsWith(SYNC_CHUNK_PREFIX) &&
        Number(key.slice(SYNC_CHUNK_PREFIX.length)) >= chunks.length
    );
    // Chunks and meta in one set; leftover chunks go after, since readers
    // only read the first n.
    await SyncService.sync().set(items);
    if (stale.length > 0) await SyncService.sync().remove(stale);
    await SyncService.saveBookkeeping({
      ...book,
      writtenSum: sum,
      writtenAt: at,
    });
    SyncService.clearPending(changeAt);
    await SyncService.setStatus({ state: "ok", at: SyncService.now() });
    SyncService.log(`wrote ${chunks.length} chunk(s), ${bytes} bytes`);
  }

  /** Turned off: forget the sync state, so turning it on again merges. */
  protected static async stop(): Promise<void> {
    SyncService.cancelWrite();
    SyncService.pendingChangeAt = 0;
    const book = await SyncService.loadBookkeeping();
    await SyncService.saveBookkeeping({ deviceId: book.deviceId });
    await SyncService.local().remove(SYNC_STATUS_KEY);
  }

  // --- Helpers -------------------------------------------------------------

  protected static async apply(
    snapshot: SyncSnapshot,
    book: Bookkeeping,
    remote: { sum: string; meta: SyncMeta }
  ): Promise<void> {
    SyncService.cancelWrite();
    SyncService.applying = true;
    SettingService.applyingSyncedChange = true;
    try {
      StoreUser.store.dispatch({
        payload: snapshotToSyncedData(snapshot),
        type: ReduxConstants.APPLY_SYNCED_DATA,
      });
    } finally {
      SettingService.applyingSyncedChange = false;
      SyncService.applying = false;
    }
    SyncService.pendingChangeAt = 0;
    await SyncService.saveBookkeeping({
      ...book,
      appliedSum: remote.sum,
      appliedAt: remote.meta.at,
    });
    await SyncService.setStatus({ state: "ok", at: SyncService.now() });
    SyncService.log("applied a snapshot from the sync storage");
  }

  protected static async markInStep(
    book: Bookkeeping,
    remote: { sum: string; meta: SyncMeta }
  ): Promise<void> {
    await SyncService.saveBookkeeping({
      ...book,
      appliedSum: remote.sum,
      appliedAt: remote.meta.at,
    });
    await SyncService.setStatus({ state: "ok", at: SyncService.now() });
  }

  protected static async readRemote(): Promise<RemoteRead> {
    const items = await SyncService.sync().get(null);
    const meta = items[SYNC_META_KEY];
    if (meta === undefined) return { kind: "empty" };
    if (!isMeta(meta)) return { kind: "invalid" };
    if (meta.v > SYNC_FORMAT_VERSION) return { kind: "newer" };
    const parts: string[] = [];
    for (let i = 0; i < meta.n; i++) {
      const part = items[chunkKey(i)];
      if (typeof part !== "string") return { kind: "incomplete" };
      parts.push(part);
    }
    const text = parts.join("");
    // A write whose chunks haven't all arrived yet.
    if (checksum(text) !== meta.sum) return { kind: "incomplete" };
    const parsed = parseSnapshot(text);
    if (!parsed.ok) return { kind: parsed.reason };
    return {
      kind: "ok",
      meta,
      snapshot: parsed.snapshot,
      // Compared in canonical form, so a snapshot this version reads
      // differently (say, a setting it doesn't know) still compares fairly.
      sum: checksum(serializeSnapshot(parsed.snapshot)),
    };
  }

  protected static localSnapshot(state: State): {
    snapshot: SyncSnapshot;
    text: string;
    sum: string;
  } {
    const snapshot = buildSnapshot(state);
    const text = serializeSnapshot(snapshot);
    return { snapshot, text, sum: checksum(text) };
  }

  protected static async loadBookkeeping(): Promise<Bookkeeping> {
    const stored = (await SyncService.local().get(SYNC_BOOKKEEPING_KEY))[
      SYNC_BOOKKEEPING_KEY
    ] as Bookkeeping | undefined;
    if (stored && typeof stored.deviceId === "string") return stored;
    const fresh: Bookkeeping = { deviceId: uid() };
    await SyncService.saveBookkeeping(fresh);
    return fresh;
  }

  protected static saveBookkeeping(book: Bookkeeping): Promise<void> {
    return SyncService.local().set({ [SYNC_BOOKKEEPING_KEY]: book });
  }

  protected static setStatus(status: SyncStatus): Promise<void> {
    return SyncService.local().set({ [SYNC_STATUS_KEY]: status });
  }

  protected static observe(state: State): Observed {
    return {
      enabled: SyncService.isEnabled(state),
      lists: SYNCED_LISTS.map((key) => state.lists[key]),
      settings: state.settings,
    };
  }

  protected static enqueue(task: () => Promise<void>): Promise<void> {
    // A failed task must never break the chain: every later task would be
    // skipped and sync would stop without a word. So the handler can't
    // throw, and the chain carries on from a settled promise either way.
    const run = SyncService.queue.then(task).catch(async (e: unknown) => {
      try {
        SyncService.log(`failed: ${errorMessage(e)}`, "error");
        await SyncService.setStatus({
          state: "error",
          message: errorMessage(e),
        });
      } catch {
        // Logging or storage.local itself failed; nothing more to report to.
      }
    });
    SyncService.queue = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  protected static scheduleWrite(): void {
    SyncService.cancelWrite();
    // Safe in MV3 for the same reason as background.ts' saveToStorage: it
    // runs within a second of the event that woke the worker.
    SyncService.timer = setTimeout(() => {
      SyncService.timer = undefined;
      void SyncService.enqueue(() => SyncService.push(false));
    }, WRITE_DELAY_MS);
  }

  protected static cancelWrite(): void {
    if (SyncService.timer !== undefined) {
      clearTimeout(SyncService.timer);
      SyncService.timer = undefined;
    }
  }

  /** Clears the pending-change mark unless a newer change came in meanwhile. */
  protected static clearPending(changeAt: number): void {
    if (SyncService.pendingChangeAt <= changeAt)
      SyncService.pendingChangeAt = 0;
  }

  protected static sync(): SyncStorageArea {
    return (
      SyncService.areas?.sync ??
      (browser.storage.sync as unknown as SyncStorageArea)
    );
  }

  protected static local(): SyncStorageArea {
    return (
      SyncService.areas?.local ??
      (browser.storage.local as unknown as SyncStorageArea)
    );
  }

  protected static log(msg: string, type: "info" | "error" = "info"): void {
    const state = StoreUser.store.getState();
    adcpLog(
      { msg: `SyncService: ${msg}`, type },
      type === "error" || state.settings[SettingID.DEBUG_MODE]?.value === true
    );
  }

  protected static areas?: { local: SyncStorageArea; sync: SyncStorageArea };
  protected static seen?: Observed;
  protected static pendingChangeAt = 0;
  protected static applying = false;
  protected static timer?: ReturnType<typeof setTimeout>;
  protected static queue: Promise<void> = Promise.resolve();
}
