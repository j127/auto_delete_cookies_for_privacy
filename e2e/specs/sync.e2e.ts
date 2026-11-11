/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * Matrix row 23, keep-list sync (#587), in a real Firefox: the real
 * storage.sync API, its quotas and its change events. Firefox Sync, which
 * carries the data between devices, needs a signed-in Mozilla account, so
 * another device is played by writing a snapshot into storage.sync as its
 * extension would (e2e/helpers/sync_fixture.ts).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  FirefoxSession,
  inChrome,
  inProbe,
  launchFirefox,
  probe,
  stopGeckodriver,
  waitUntil,
} from "../helpers/firefox_driver";
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
import { SYNCED_SETTINGS } from "@/services/sync-snapshot";
import { FIREFOX_ADDON_ID } from "../../scripts/firefox_manifest";

let session: FirefoxSession;

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

const syncItems = async () =>
  (await inProbe(session, `return browser.storage.sync.get(null);`)) as Record<
    string,
    unknown
  >;

const syncStatus = async () =>
  (await inProbe(
    session,
    `const r = await browser.storage.local.get("syncStatus");
     return r.syncStatus ?? null;`
  )) as { state: string } | null;

type PersistedState = {
  lists?: Record<string, { expression: string }[]>;
  settings?: Record<string, { value: boolean | number | string }>;
};

/** The persisted state; reading it doesn't wake a stopped background. */
const persisted = async () =>
  (await probe(session, { kind: "getState" })) as PersistedState;

const persistedRules = async () =>
  ((await persisted()).lists?.default ?? []).map((rule) => rule.expression);

const writeAsOtherDevice = async (items: Record<string, unknown>) => {
  await inProbe(
    session,
    `await browser.storage.sync.set(args[0]); return true;`,
    items
  );
};

const addRules = (hosts: string[]) =>
  probe(session, {
    kind: "dispatch",
    action: {
      type: "ADD_EXPRESSIONS",
      payload: hosts.map((expression) => ({
        expression,
        listType: "WHITE",
        storeId: "default",
      })),
    },
  });

const setSettings = async (settings: Record<string, unknown>) => {
  const applied = (await probe(session, {
    kind: "updateSettings",
    settings,
  })) as Record<string, unknown>;
  for (const [name, value] of Object.entries(settings)) {
    if (applied[name] !== value) {
      throw new Error(`settings not applied: ${JSON.stringify(applied)}`);
    }
  }
};

const sameSet = (a: string[] | undefined, b: string[]) =>
  a !== undefined && [...a].sort().join("\n") === [...b].sort().join("\n");

beforeAll(async () => {
  session = await launchFirefox();
  await setSettings({ activeMode: true });
}, 120000);

afterAll(async () => {
  await session?.quit();
  stopGeckodriver();
});

describe("keep-list sync (#587, row 23)", () => {
  it("uploads the keep list when sync is turned on", async () => {
    await addRules(["kept-here.test"]);
    await setSettings({ syncEnabled: true });
    const uploaded = await waitUntil(
      async () => sameSet(syncedRules(await syncItems()), ["kept-here.test"]),
      15000
    );
    expect(uploaded).toBe(true);
    expect((await syncStatus())?.state).toBe("ok");
  });

  it("applies another device's snapshot, settings included, without echoing it", async () => {
    // A real second device sends every synced setting; this one changed
    // the grace period.
    const current = (await persisted()).settings ?? {};
    const settings = Object.fromEntries(
      SYNCED_SETTINGS.map((name) => [name, current[name].value])
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
    const applied = await waitUntil(
      async () =>
        sameSet(await persistedRules(), [
          "kept-here.test",
          "from-elsewhere.test",
        ]),
      15000
    );
    expect(applied).toBe(true);
    const state = await persisted();
    expect(state.settings?.delayBeforeClean.value).toBe(7);
    // Device-local settings didn't travel.
    expect(state.settings?.activeMode.value).toBe(true);
    expect(state.settings?.syncEnabled.value).toBe(true);

    // No write-back: the sync storage still holds the other device's write.
    await sleep(3000);
    const meta = (await syncItems())[SYNC_META_KEY] as SyncMetaSeen;
    expect(meta.dev).toBe(OTHER_DEVICE);
  });

  it("wakes a stopped background for another device's change", async () => {
    // Stopped the way about:debugging's "Terminate background script" does.
    const stopped = await inChrome(
      session,
      `const extension = WebExtensionPolicy.getByID(args[0]).extension;
       await extension.terminateBackground();
       return extension.backgroundState;`,
      FIREFOX_ADDON_ID
    );
    expect(stopped).toBe("stopped");

    await writeAsOtherDevice(
      otherDeviceItems(
        snapshot([{ e: "while-asleep.test", t: "W" }]),
        Date.now() + 2000
      )
    );
    // Read storage.local only, so nothing but the storage event can wake it.
    const applied = await waitUntil(
      async () => sameSet(await persistedRules(), ["while-asleep.test"]),
      20000
    );
    expect(applied).toBe(true);
  }, 60000);

  it("writes a long list within Firefox's real per-item quota", async () => {
    const hosts = longListHosts(450);
    await addRules(hosts);
    let meta: SyncMetaSeen | undefined;
    const written = await waitUntil(async () => {
      const items = await syncItems();
      const rules = syncedRules(items);
      meta = items[SYNC_META_KEY] as SyncMetaSeen;
      return rules !== undefined && rules.length === hosts.length + 1;
    }, 30000);
    expect(written, "the long list reached storage.sync").toBe(true);
    expect(meta!.n).toBeGreaterThan(1);
    // Firefox accepted every chunk: no quota error was recorded.
    expect((await syncStatus())?.state).toBe("ok");
  }, 60000);

  it("pauses with a status, writing nothing, when the list is over the quota", async () => {
    const before = (await syncItems())[SYNC_META_KEY] as SyncMetaSeen;
    await addRules(overQuotaHosts());
    const paused = await waitUntil(
      async () => (await syncStatus())?.state === "tooLarge",
      30000
    );
    expect(paused).toBe(true);
    const after = (await syncItems())[SYNC_META_KEY] as SyncMetaSeen;
    expect(after.at).toBe(before.at);
  }, 60000);

  it("stops when turned off and leaves the account's copy", async () => {
    await setSettings({ syncEnabled: false });
    expect(
      await waitUntil(async () => (await syncStatus()) === null, 10000)
    ).toBe(true);
    const before = (await syncItems())[SYNC_META_KEY] as SyncMetaSeen;
    await addRules(["after-off.test"]);
    await sleep(3000);
    const after = (await syncItems())[SYNC_META_KEY] as SyncMetaSeen;
    expect(after.at).toBe(before.at);
  });
});
