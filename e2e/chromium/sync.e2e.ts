/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * Keep-list sync (#587) in a real Chrome: the real storage.sync API, its
 * quotas and its change events. Chrome Sync, which carries the data between
 * devices, needs a signed-in profile, so another device is played by
 * writing a snapshot into storage.sync as its extension would
 * (e2e/helpers/sync_fixture.ts).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  dispatch,
  sleep,
  storeState,
  updateSettings,
  waitFor,
} from "../helpers/chrome_cdp";
import { ChromiumRun, startChromiumRun } from "../helpers/chromium_scenario";
import { SYNCED_SETTINGS } from "@/services/sync-snapshot";
import {
  longListHosts,
  OTHER_DEVICE,
  otherDeviceItems,
  overQuotaHosts,
  snapshot,
  SYNC_META_KEY,
  syncedRules,
  type SyncMetaSeen,
} from "../helpers/sync_fixture";

let run: ChromiumRun | undefined;

const syncItems = () =>
  run!.session.probeEval<Record<string, unknown>>(
    `chrome.storage.sync.get(null)`
  );

const syncStatus = () =>
  run!.session.probeEval<{ state: string } | null>(
    `chrome.storage.local.get("syncStatus").then((r) => r.syncStatus ?? null)`
  );

const storeRules = async (): Promise<string[]> =>
  (
    (
      await storeState<{ lists: Record<string, { expression: string }[]> }>(
        run!.session
      )
    ).lists.default ?? []
  ).map((rule) => rule.expression);

/**
 * The rules the background last persisted, read from storage.local: unlike
 * the store bridge, reading it doesn't wake a stopped service worker.
 */
const persistedRules = () =>
  run!.session.probeEval<string[]>(
    `chrome.storage.local.get("state").then((r) => {
       const lists = r.state ? JSON.parse(r.state).lists : {};
       return (lists.default ?? []).map((rule) => rule.expression);
     })`
  );

const writeAsOtherDevice = async (items: Record<string, unknown>) => {
  await run!.session.probeEval(
    `chrome.storage.sync.set(${JSON.stringify(items)}).then(() => true)`
  );
};

const addRules = (hosts: string[]) =>
  dispatch(run!.session, {
    type: "ADD_EXPRESSIONS",
    payload: hosts.map((expression) => ({
      expression,
      listType: "WHITE",
      storeId: "default",
    })),
  });

const sameSet = (a: string[] | undefined, b: string[]) =>
  a !== undefined && [...a].sort().join("\n") === [...b].sort().join("\n");

const serviceWorkerRunning = async (): Promise<boolean> => {
  const { targetInfos } = await run!.session.cdp.send<{
    targetInfos: { type: string; url: string }[];
  }>("Target.getTargets");
  return targetInfos.some(
    (t) =>
      t.type === "service_worker" &&
      t.url.startsWith(`chrome-extension://${run!.session.extensionId}/`)
  );
};

beforeAll(async () => {
  run = await startChromiumRun();
}, 180000);

afterAll(async () => {
  await run?.stop();
});

describe("keep-list sync (#587)", () => {
  it("uploads the keep list when sync is turned on", async () => {
    await addRules(["kept-here.test"]);
    await updateSettings(run!.session, { syncEnabled: true });
    const uploaded = await waitFor(
      async () => sameSet(syncedRules(await syncItems()), ["kept-here.test"]),
      15000
    );
    expect(uploaded).toBeTruthy();
    expect((await syncStatus())?.state).toBe("ok");
  });

  it("applies another device's snapshot, settings included, without echoing it", async () => {
    // A real second device sends every synced setting; this one changed
    // the grace period.
    const current = await storeState<{
      settings: Record<string, { value: boolean | number | string }>;
    }>(run!.session);
    const settings = Object.fromEntries(
      SYNCED_SETTINGS.map((name) => [name, current.settings[name].value])
    );
    await writeAsOtherDevice(
      otherDeviceItems(
        snapshot(
          [
            { e: "kept-here.test", t: "W" },
            { e: "from-elsewhere.test", t: "G" },
          ],
          { ...settings, delayBeforeClean: 7 }
        ),
        Date.now() + 1000
      )
    );
    const applied = await waitFor(
      async () =>
        sameSet(await storeRules(), ["kept-here.test", "from-elsewhere.test"]),
      15000
    );
    expect(applied).toBeTruthy();
    const state = await storeState<{
      settings: Record<string, { value: unknown }>;
    }>(run!.session);
    expect(state.settings.delayBeforeClean.value).toBe(7);
    // Device-local settings didn't travel.
    expect(state.settings.activeMode.value).toBe(true);
    expect(state.settings.syncEnabled.value).toBe(true);

    // No write-back: the sync storage still holds the other device's write.
    await sleep(3000);
    const meta = (await syncItems())[SYNC_META_KEY] as SyncMetaSeen;
    expect(meta.dev).toBe(OTHER_DEVICE);
  });

  it("wakes a stopped service worker for another device's change", async () => {
    await run!.session.cdp.send(
      "ServiceWorker.enable",
      {},
      run!.session.probe.sessionId
    );
    await run!.session.cdp.send(
      "ServiceWorker.stopAllWorkers",
      {},
      run!.session.probe.sessionId
    );
    const stopped = await waitFor(
      async () => !(await serviceWorkerRunning()),
      10000
    );
    expect(stopped, "the service worker stopped").toBeTruthy();

    await writeAsOtherDevice(
      otherDeviceItems(
        snapshot([{ e: "while-asleep.test", t: "W" }]),
        Date.now() + 2000
      )
    );
    // Read storage.local only, so nothing but the storage event can wake it.
    const applied = await waitFor(
      async () => sameSet(await persistedRules(), ["while-asleep.test"]),
      20000,
      500
    );
    expect(applied).toBeTruthy();
  }, 60000);

  it("writes a long list within Chrome's real per-item quota", async () => {
    const hosts = longListHosts(450);
    await addRules(hosts);
    const written = await waitFor(async () => {
      const items = await syncItems();
      const rules = syncedRules(items);
      return rules !== undefined && rules.length === hosts.length + 1
        ? (items[SYNC_META_KEY] as SyncMetaSeen)
        : undefined;
    }, 30000);
    expect(written, "the long list reached storage.sync").toBeTruthy();
    expect(written!.n).toBeGreaterThan(1);
    // Chrome accepted every chunk: no quota error was recorded.
    expect((await syncStatus())?.state).toBe("ok");
  }, 60000);

  it("pauses with a status, writing nothing, when the list is over the quota", async () => {
    const before = (await syncItems())[SYNC_META_KEY] as SyncMetaSeen;
    await addRules(overQuotaHosts());
    const paused = await waitFor(
      async () => (await syncStatus())?.state === "tooLarge",
      30000
    );
    expect(paused).toBeTruthy();
    const after = (await syncItems())[SYNC_META_KEY] as SyncMetaSeen;
    expect(after.at).toBe(before.at);
  }, 60000);

  it("stops when turned off and leaves the account's copy", async () => {
    await updateSettings(run!.session, { syncEnabled: false });
    expect(
      await waitFor(async () => (await syncStatus()) === null, 10000)
    ).toBeTruthy();
    const before = (await syncItems())[SYNC_META_KEY] as SyncMetaSeen;
    await addRules(["after-off.test"]);
    await sleep(3000);
    const after = (await syncItems())[SYNC_META_KEY] as SyncMetaSeen;
    expect(after.at).toBe(before.at);
  });
});
