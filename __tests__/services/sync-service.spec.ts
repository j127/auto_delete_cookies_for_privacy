/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * Keep-list sync through the browser account (#587): the engine that writes
 * this device's snapshot and applies the ones other devices write. The sync
 * storage is an in-memory fake that enforces the real quotas; "another
 * device" writes into it with the same snapshot functions.
 */
import { ListType, SettingID } from "@/typings/enums";
import { ReduxConstants } from "@/typings/redux-constants";
import { addExpression, updateSetting } from "@/redux/actions";
import { initialState } from "@/redux/state";
// tslint:disable-next-line: import-name
import createStore, { type AppStore } from "@/redux/store";
import SettingService from "@/services/setting-service";
import StoreUser from "@/services/store-user";
import SyncService, {
  chunkKey,
  QUOTA_BYTES,
  QUOTA_BYTES_PER_ITEM,
  SYNC_BOOKKEEPING_KEY,
  SYNC_META_KEY,
  type SyncMeta,
  type SyncStorageArea,
} from "@/services/sync-service";
import {
  checksum,
  itemBytes,
  serializeSnapshot,
  splitIntoChunks,
  SYNC_STATUS_KEY,
  type CompactRule,
  type SyncSnapshot,
} from "@/services/sync-snapshot";

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** A storage area in memory, with the browsers' sync quotas when asked. */
class FakeArea implements SyncStorageArea {
  public data: Record<string, unknown> = {};
  constructor(private readonly quotas = false) {}

  public async get(keys?: null | string | string[]) {
    if (keys === null || keys === undefined) return copy(this.data);
    const out: Record<string, unknown> = {};
    for (const key of typeof keys === "string" ? [keys] : keys) {
      if (key in this.data) out[key] = copy(this.data[key]);
    }
    return out;
  }

  public async set(items: Record<string, unknown>) {
    const next = { ...this.data, ...copy(items) };
    if (this.quotas) {
      for (const [key, value] of Object.entries(items)) {
        if (itemBytes(key, value) > QUOTA_BYTES_PER_ITEM) {
          throw new Error("QUOTA_BYTES_PER_ITEM quota exceeded");
        }
      }
      const total = Object.entries(next).reduce(
        (sum, [key, value]) => sum + itemBytes(key, value),
        0
      );
      if (total > QUOTA_BYTES) throw new Error("QUOTA_BYTES quota exceeded");
    }
    this.data = next;
  }

  public async remove(keys: string | string[]) {
    for (const key of typeof keys === "string" ? [keys] : keys) {
      delete this.data[key];
    }
  }
}

let store: AppStore;
let sync: FakeArea;
let local: FakeArea;
let clock: number;

const snap = (
  rules: CompactRule[],
  settings: SyncSnapshot["settings"] = {}
): SyncSnapshot => ({ v: 1, lists: { default: rules }, settings });

/** Writes a snapshot the way another device would. */
const writeAsOtherDevice = async (
  snapshot: SyncSnapshot,
  at: number,
  { dev = "other-device", leaveOut }: { dev?: string; leaveOut?: number } = {}
): Promise<void> => {
  const text = serializeSnapshot(snapshot);
  const chunks = splitIntoChunks(text, 8000, chunkKey);
  const meta: SyncMeta = {
    v: 1,
    n: chunks.length,
    sum: checksum(text),
    at,
    dev,
  };
  const items: Record<string, unknown> = { [SYNC_META_KEY]: meta };
  chunks.forEach((chunk, i) => {
    if (i !== leaveOut) items[chunkKey(i)] = chunk;
  });
  await sync.set(items);
};

const notifyChange = () =>
  SyncService.onStorageChanged({ [SYNC_META_KEY]: {} }, "sync");

const enableSync = async () => {
  store.dispatch(updateSetting({ name: SettingID.SYNC_ENABLED, value: true }));
  await SyncService.flush();
};

const keep = (expression: string, listType = ListType.WHITE) =>
  store.dispatch(
    addExpression({ expression, listType, storeId: "default" }) as never
  );

/**
 * Loads a long default list as a local change, in one dispatch (adding
 * hundreds of rules one by one re-sorts the list each time).
 */
const loadLongList = (hosts: string[]) =>
  store.dispatch({
    payload: {
      lists: {
        default: hosts.map((expression) => ({
          expression,
          listType: ListType.WHITE,
          storeId: "default",
        })),
      },
      settings: [],
    },
    type: ReduxConstants.APPLY_SYNCED_DATA,
  });

const expressions = () =>
  (store.getState().lists.default ?? []).map((e) => e.expression);

const status = () => local.data[SYNC_STATUS_KEY] as Record<string, unknown>;

const bookkeeping = () =>
  local.data[SYNC_BOOKKEEPING_KEY] as Record<string, unknown> | undefined;

/** The snapshot currently in the fake sync storage, read back. */
const remoteText = () => {
  const meta = sync.data[SYNC_META_KEY] as SyncMeta;
  return Array.from({ length: meta.n }, (_, i) => sync.data[chunkKey(i)]).join(
    ""
  );
};
const remoteRules = () =>
  (JSON.parse(remoteText()) as SyncSnapshot).lists.default.map((r) => r.e);

const restartWorker = async () => {
  SyncService.resetMemory();
  await SyncService.start();
};

beforeEach(() => {
  // adcpLog stamps the extension version on every line it prints.
  vi.mocked(browser.runtime.getManifest).mockReturnValue({
    version: "0.0.0",
  } as ReturnType<typeof browser.runtime.getManifest>);
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  clock = 1_000_000;
  SyncService.now = () => clock;
  sync = new FakeArea(true);
  local = new FakeArea();
  SyncService.setStorageAreas({ local, sync });
  SyncService.resetMemory();
  store = createStore(initialState);
  StoreUser.init(store);
  store.subscribe(SyncService.onStoreChange);
});

afterEach(() => {
  vi.restoreAllMocks();
  SyncService.setStorageAreas(undefined);
  SyncService.now = () => Date.now();
  vi.useRealTimers();
});

describe("while sync is off", () => {
  it("start() reads and writes nothing", async () => {
    const get = vi.spyOn(sync, "get");
    await SyncService.start();
    keep("a.com");
    await SyncService.flush();
    expect(get).not.toHaveBeenCalled();
    expect(sync.data).toEqual({});
  });

  it("ignores changes in the sync storage", async () => {
    await SyncService.start();
    await writeAsOtherDevice(snap([{ e: "remote.com", t: "W" }]), clock + 10);
    await notifyChange();
    expect(expressions()).toEqual([]);
  });

  it("is off when the browser has no sync storage", () => {
    const original = browser.storage.sync;
    (browser.storage as { sync?: unknown }).sync = undefined;
    try {
      store.dispatch(
        updateSetting({ name: SettingID.SYNC_ENABLED, value: true })
      );
      expect(SyncService.isEnabled(store.getState())).toBe(false);
    } finally {
      (browser.storage as { sync?: unknown }).sync = original;
    }
  });
});

describe("turning sync on", () => {
  beforeEach(async () => {
    await SyncService.start();
  });

  it("uploads this device's list when the account has nothing yet", async () => {
    keep("a.com");
    keep("b.com", ListType.GREY);
    await enableSync();
    expect(remoteRules()).toEqual(["a.com", "b.com"]);
    expect(status()).toEqual({ state: "ok", at: clock });
    expect(bookkeeping()).toMatchObject({ writtenSum: checksum(remoteText()) });
    expect(typeof bookkeeping()?.deviceId).toBe("string");
  });

  it("merges with what the account already holds, losing nothing", async () => {
    keep("local.com");
    store.dispatch(updateSetting({ name: SettingID.CLEAN_DELAY, value: 5 }));
    await writeAsOtherDevice(
      snap([{ e: "remote.com", t: "G" }], { [SettingID.CLEAN_DELAY]: 60 }),
      clock - 5000
    );
    await enableSync();
    expect(expressions()).toEqual(["local.com", "remote.com"]);
    expect(store.getState().settings[SettingID.CLEAN_DELAY].value).toBe(60);
    expect(remoteRules()).toEqual(["local.com", "remote.com"]);
  });

  it("waits when the account's snapshot hasn't fully arrived", async () => {
    await writeAsOtherDevice(snap([{ e: "remote.com", t: "W" }]), clock, {
      leaveOut: 0,
    });
    const set = vi.spyOn(sync, "set");
    await enableSync();
    expect(set).not.toHaveBeenCalled();
    expect(expressions()).toEqual([]);
  });

  it("repairs an unreadable snapshot with this device's", async () => {
    keep("a.com");
    await sync.set({ [SYNC_META_KEY]: { garbage: true } });
    await enableSync();
    expect(remoteRules()).toEqual(["a.com"]);
  });

  it("never overwrites a newer format and says so", async () => {
    keep("a.com");
    await sync.set({
      [SYNC_META_KEY]: { v: 99, n: 1, sum: "x", at: clock, dev: "new" },
    });
    await enableSync();
    expect((sync.data[SYNC_META_KEY] as SyncMeta).v).toBe(99);
    expect(status()).toEqual({ state: "newerVersion" });
  });
});

describe("local changes", () => {
  beforeEach(async () => {
    await SyncService.start();
    await enableSync();
  });

  it("are written after the debounce", async () => {
    vi.useFakeTimers();
    keep("a.com");
    expect(sync.data[SYNC_META_KEY]).toMatchObject({ n: 1 });
    expect(remoteRules()).toEqual([]);
    await vi.advanceTimersByTimeAsync(1000);
    await SyncService.flush();
    expect(remoteRules()).toEqual(["a.com"]);
  });

  it("send a burst of edits as one write", async () => {
    vi.useFakeTimers();
    const set = vi.spyOn(sync, "set");
    keep("a.com");
    keep("b.com");
    keep("c.com");
    await vi.advanceTimersByTimeAsync(1000);
    await SyncService.flush();
    expect(set).toHaveBeenCalledTimes(1);
    expect(remoteRules()).toEqual(["a.com", "b.com", "c.com"]);
  });

  it("include synced settings but not device-local ones", async () => {
    const set = vi.spyOn(sync, "set");
    store.dispatch(updateSetting({ name: SettingID.ACTIVE_MODE, value: true }));
    store.dispatch(updateSetting({ name: SettingID.DEBUG_MODE, value: true }));
    await SyncService.flush();
    expect(set).not.toHaveBeenCalled();
    store.dispatch(updateSetting({ name: SettingID.CLEAN_DELAY, value: 42 }));
    await SyncService.flush();
    expect(set).toHaveBeenCalledTimes(1);
    expect(
      (JSON.parse(remoteText()) as SyncSnapshot).settings[SettingID.CLEAN_DELAY]
    ).toBe(42);
  });

  it("ignore changes outside the synced lists and settings", async () => {
    const set = vi.spyOn(sync, "set");
    store.dispatch(
      addExpression({
        expression: "private.com",
        listType: ListType.WHITE,
        storeId: "private",
      }) as never
    );
    store.dispatch({ type: ReduxConstants.INCREMENT_COOKIE_DELETED_COUNTER });
    await SyncService.flush();
    expect(set).not.toHaveBeenCalled();
  });

  it("rewrite only the chunks that changed and drop leftovers", async () => {
    loadLongList(
      Array.from(
        { length: 400 },
        (_, i) => `site-${String(i).padStart(3, "0")}.example.com`
      )
    );
    await SyncService.flush();
    const before = (sync.data[SYNC_META_KEY] as SyncMeta).n;
    expect(before).toBeGreaterThan(1);

    const set = vi.spyOn(sync, "set");
    keep("zzz-last.example.com");
    await SyncService.flush();
    const written = Object.keys(set.mock.calls[0][0]);
    expect(written).toContain(SYNC_META_KEY);
    expect(written.length).toBeLessThan(before + 1);

    // Shrink to one rule: the extra chunks go.
    store.dispatch({ type: ReduxConstants.CLEAR_EXPRESSIONS, payload: {} });
    keep("only.com");
    await SyncService.flush();
    expect((sync.data[SYNC_META_KEY] as SyncMeta).n).toBe(1);
    expect(
      Object.keys(sync.data).filter((k) => k.startsWith("syncChunk"))
    ).toEqual([chunkKey(0)]);
    expect(remoteRules()).toEqual(["only.com"]);
  });

  it("pause sync with a clear status when the list is too large", async () => {
    const set = vi.spyOn(sync, "set");
    loadLongList(
      Array.from(
        { length: 3000 },
        (_, i) => `a-rather-long-host-name-number-${i}.example.com`
      )
    );
    await SyncService.flush();
    expect(set).not.toHaveBeenCalled();
    expect(status()).toMatchObject({ state: "tooLarge", quota: QUOTA_BYTES });
    expect(status().bytes as number).toBeGreaterThan(QUOTA_BYTES);
  });

  it("report a write the browser refuses", async () => {
    vi.spyOn(sync, "set").mockRejectedValueOnce(
      new Error("MAX_WRITE_OPERATIONS_PER_MINUTE quota exceeded")
    );
    keep("a.com");
    await SyncService.flush();
    expect(status()).toEqual({
      state: "error",
      message: "MAX_WRITE_OPERATIONS_PER_MINUTE quota exceeded",
    });
    // The next change goes through and clears it.
    keep("b.com");
    await SyncService.flush();
    expect(status()).toMatchObject({ state: "ok" });
    expect(remoteRules()).toEqual(["a.com", "b.com"]);
  });

  it("order each write after the last snapshot seen, whatever the clock says", async () => {
    await writeAsOtherDevice(
      snap([{ e: "remote.com", t: "W" }]),
      clock + 50_000
    );
    await notifyChange();
    clock -= 10_000; // this device's clock runs behind
    keep("mine.com");
    await SyncService.flush();
    expect((sync.data[SYNC_META_KEY] as SyncMeta).at).toBe(
      clock + 10_000 + 50_001
    );
  });
});

describe("changes from another device", () => {
  beforeEach(async () => {
    keep("old.com");
    await SyncService.start();
    await enableSync();
  });

  it("replace the list and synced settings in one step", async () => {
    const states: State[] = [];
    const unsubscribe = store.subscribe(() => states.push(store.getState()));
    clock += 100;
    await writeAsOtherDevice(
      snap([{ e: "new.com", t: "G" }], { [SettingID.NOTIFY_AUTO]: false }),
      clock
    );
    await notifyChange();
    unsubscribe();
    expect(expressions()).toEqual(["new.com"]);
    expect(store.getState().lists.default[0].listType).toBe(ListType.GREY);
    expect(store.getState().settings[SettingID.NOTIFY_AUTO].value).toBe(false);
    // Nobody ever saw the list empty or half-replaced.
    for (const state of states) {
      expect(state.lists.default?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it("don't echo back as a write", async () => {
    const set = vi.spyOn(sync, "set");
    clock += 100;
    await writeAsOtherDevice(snap([{ e: "new.com", t: "W" }]), clock);
    set.mockClear();
    await notifyChange();
    await SyncService.flush();
    expect(set).not.toHaveBeenCalled();
  });

  it("are applied with the site-data wipe guard up", async () => {
    const seen: boolean[] = [];
    const unsubscribe = store.subscribe(() =>
      seen.push(SettingService.applyingSyncedChange)
    );
    clock += 100;
    await writeAsOtherDevice(snap([{ e: "new.com", t: "W" }]), clock);
    await notifyChange();
    unsubscribe();
    expect(seen).toContain(true);
    expect(SettingService.applyingSyncedChange).toBe(false);
  });

  it("leave the private list alone", async () => {
    store.dispatch(
      addExpression({
        expression: "private.com",
        listType: ListType.WHITE,
        storeId: "private",
      }) as never
    );
    clock += 100;
    await writeAsOtherDevice(snap([{ e: "new.com", t: "W" }]), clock);
    await notifyChange();
    expect(store.getState().lists.private.map((e) => e.expression)).toEqual([
      "private.com",
    ]);
  });

  it("empty the list when the other device removed every rule", async () => {
    clock += 100;
    await writeAsOtherDevice(snap([]), clock);
    await notifyChange();
    expect(store.getState().lists.default).toBeUndefined();
  });

  it("wait for every chunk before applying", async () => {
    const rules = Array.from({ length: 600 }, (_, i) => ({
      e: `remote-${i}.example.com`,
      t: "W" as const,
    }));
    clock += 100;
    await writeAsOtherDevice(snap(rules), clock, { leaveOut: 1 });
    await notifyChange();
    expect(expressions()).toEqual(["old.com"]);
    await writeAsOtherDevice(snap(rules), clock);
    await notifyChange();
    expect(expressions()).toHaveLength(600);
  });

  it("lose to a newer local change, which is written again", async () => {
    vi.useFakeTimers();
    keep("local-newer.com"); // pending, not yet written
    await writeAsOtherDevice(
      snap([{ e: "remote-older.com", t: "W" }]),
      clock - 1
    );
    await notifyChange();
    expect(expressions()).toContain("local-newer.com");
    expect(expressions()).not.toContain("remote-older.com");
    expect(remoteRules()).toEqual(["local-newer.com", "old.com"]);
  });

  it("win over an older pending local change", async () => {
    vi.useFakeTimers();
    keep("local-older.com");
    clock += 5000;
    await writeAsOtherDevice(snap([{ e: "remote-newer.com", t: "W" }]), clock);
    await notifyChange();
    expect(expressions()).toEqual(["remote-newer.com"]);
    await vi.advanceTimersByTimeAsync(2000);
    await SyncService.flush();
    expect(remoteRules()).toEqual(["remote-newer.com"]);
  });

  it("include this device's own writes, which change nothing", async () => {
    const set = vi.spyOn(sync, "set");
    await notifyChange();
    expect(set).not.toHaveBeenCalled();
    expect(expressions()).toEqual(["old.com"]);
  });

  it("put this device's snapshot back when the account was cleared", async () => {
    await sync.remove(Object.keys(sync.data));
    await notifyChange();
    expect(remoteRules()).toEqual(["old.com"]);
  });

  it("stop at a newer format", async () => {
    await sync.set({
      [SYNC_META_KEY]: { v: 2, n: 1, sum: "x", at: clock + 1, dev: "new" },
    });
    await notifyChange();
    expect(status()).toEqual({ state: "newerVersion" });
    expect(expressions()).toEqual(["old.com"]);
  });

  it("ignore other storage areas and other keys", async () => {
    const get = vi.spyOn(sync, "get");
    await SyncService.onStorageChanged({ [SYNC_META_KEY]: {} }, "local");
    await SyncService.onStorageChanged({ theme: {} }, "sync");
    expect(get).not.toHaveBeenCalled();
  });
});

describe("a worker restart", () => {
  beforeEach(async () => {
    keep("start.com");
    await SyncService.start();
    await enableSync();
  });

  it("takes the account's newer snapshot when nothing changed here", async () => {
    clock += 100;
    await writeAsOtherDevice(snap([{ e: "remote.com", t: "W" }]), clock);
    await restartWorker();
    expect(expressions()).toEqual(["remote.com"]);
  });

  it("writes a change made here that never went out", async () => {
    SyncService.resetMemory(); // the worker stopped inside the debounce
    keep("unsent.com");
    await restartWorker();
    expect(remoteRules()).toEqual(["start.com", "unsent.com"]);
  });

  it("merges when both sides changed while it was down", async () => {
    SyncService.resetMemory();
    keep("here.com");
    clock += 100;
    await writeAsOtherDevice(
      snap([
        { e: "start.com", t: "W" },
        { e: "there.com", t: "W" },
      ]),
      clock
    );
    await restartWorker();
    expect(expressions()).toEqual(["here.com", "start.com", "there.com"]);
    expect(remoteRules()).toEqual(["here.com", "start.com", "there.com"]);
  });

  it("does nothing when both sides still match", async () => {
    const set = vi.spyOn(sync, "set");
    await restartWorker();
    expect(set).not.toHaveBeenCalled();
  });
});

describe("turning sync off", () => {
  beforeEach(async () => {
    keep("a.com");
    await SyncService.start();
    await enableSync();
  });

  it("stops writing and forgets the sync state, keeping the device id", async () => {
    const deviceId = bookkeeping()?.deviceId;
    store.dispatch(
      updateSetting({ name: SettingID.SYNC_ENABLED, value: false })
    );
    await SyncService.flush();
    expect(bookkeeping()).toEqual({ deviceId });
    expect(local.data[SYNC_STATUS_KEY]).toBeUndefined();
    const set = vi.spyOn(sync, "set");
    keep("b.com");
    await SyncService.flush();
    expect(set).not.toHaveBeenCalled();
    // The account keeps its copy for the other devices.
    expect(remoteRules()).toEqual(["a.com"]);
  });

  it("merges again when turned back on", async () => {
    store.dispatch(
      updateSetting({ name: SettingID.SYNC_ENABLED, value: false })
    );
    await SyncService.flush();
    keep("offline.com");
    clock += 100;
    await writeAsOtherDevice(
      snap([
        { e: "a.com", t: "W" },
        { e: "elsewhere.com", t: "W" },
      ]),
      clock
    );
    await enableSync();
    expect(expressions()).toEqual(["a.com", "elsewhere.com", "offline.com"]);
  });

  it("happens on a settings reset, which never reaches other devices", async () => {
    const set = vi.spyOn(sync, "set");
    store.dispatch({ type: ReduxConstants.RESET_SETTINGS });
    await SyncService.flush();
    expect(SyncService.isEnabled(store.getState())).toBe(false);
    expect(set).not.toHaveBeenCalled();
  });
});

describe("bookkeeping", () => {
  it("makes a device id once and keeps it", async () => {
    await SyncService.start();
    await enableSync();
    const id = bookkeeping()?.deviceId;
    await restartWorker();
    expect(bookkeeping()?.deviceId).toBe(id);
    expect((sync.data[SYNC_META_KEY] as SyncMeta).dev).toBe(id);
  });

  it("keeps going after a task fails even its error handling", async () => {
    await SyncService.start();
    await enableSync();
    vi.mocked(browser.runtime.getManifest).mockImplementation(() => {
      throw new Error("no manifest");
    });
    vi.spyOn(sync, "set").mockRejectedValueOnce(new Error("boom"));
    keep("a.com");
    await SyncService.flush();
    vi.mocked(browser.runtime.getManifest).mockReturnValue({
      version: "0.0.0",
    } as ReturnType<typeof browser.runtime.getManifest>);
    keep("b.com");
    await SyncService.flush();
    expect(remoteRules()).toEqual(["a.com", "b.com"]);
  });

  it("survives a status write failing too", async () => {
    await SyncService.start();
    await enableSync();
    vi.spyOn(sync, "set").mockRejectedValueOnce(new Error("boom"));
    vi.spyOn(local, "set").mockRejectedValue(new Error("local broken"));
    keep("a.com");
    await expect(SyncService.flush()).resolves.toBeUndefined();
  });
});
