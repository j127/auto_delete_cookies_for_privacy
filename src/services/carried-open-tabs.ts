/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * Open-tab protection for Firefox for Android, where tabs.query only lists
 * some of the open tabs (#534, Mozilla bug 1583281). The extension sees a
 * tab only once Firefox has loaded it, and after a restart Firefox loads
 * only the tab on screen: every other tab is still open in the tab tray,
 * but tabs.query leaves it out until the person switches to it. Cleanup
 * would take those sites for closed ones and delete their cookies, so the
 * person is logged out of sites they never closed.
 *
 * So on Android this service remembers which sites were open, in
 * storage.local, and carries them over a restart:
 *
 * - lastSeen: the sites of the tabs tabs.query listed the last time it was
 *   asked this session. returnContainersOfOpenTabDomains refreshes it on
 *   every cleanup, and src/background.ts asks again on every page load and
 *   tab close, so it is current when the browser stops.
 * - carried: sites that were open when the browser last stopped and have
 *   not been seen in a tab since. At the first call of a browser session,
 *   lastSeen moves into carried.
 *
 * Cleanup treats a carried site like an open tab. A site stops being
 * carried once a listed tab shows it (from then on that tab protects it,
 * and closing it lets cleanup run as usual), or when the person cleans
 * including open tabs, which asks for open sites to be cleaned anyway.
 *
 * The trade-off: a tab that is closed from the tab tray without ever being
 * loaded closes without the extension hearing of it, so its site keeps its
 * cookies until it is opened and closed again or the person cleans
 * including open tabs. That errs toward keeping cookies a while longer
 * rather than logging someone out of a tab they still have open.
 *
 * Private tabs never count: Firefox does not restore them, and private
 * sites must never be written to disk.
 *
 * Desktop Firefox and Chrome list every tab, so there this is a no-op.
 */

import { CURRENT_BROWSER } from "./browser-capabilities";

type StoreDomains = Record<string, string[]>;

interface CarriedData {
  carried: StoreDomains;
  lastSeen: StoreDomains;
}

/** Raw store ids (and the unified key) of private browsing. */
const PRIVATE_STORES = new Set(["1", "firefox-private", "private"]);

const withoutPrivate = (domains: StoreDomains): StoreDomains => {
  const out: StoreDomains = {};
  for (const [storeId, list] of Object.entries(domains)) {
    if (!PRIVATE_STORES.has(storeId) && list.length > 0) out[storeId] = list;
  }
  return out;
};

const union = (a: StoreDomains, b: StoreDomains): StoreDomains => {
  const out: StoreDomains = {};
  for (const storeId of new Set([...Object.keys(a), ...Object.keys(b)])) {
    out[storeId] = Array.from(
      new Set([...(a[storeId] ?? []), ...(b[storeId] ?? [])])
    );
  }
  return out;
};

const minus = (a: StoreDomains, b: StoreDomains): StoreDomains => {
  const out: StoreDomains = {};
  for (const [storeId, list] of Object.entries(a)) {
    const drop = new Set(b[storeId] ?? []);
    const kept = list.filter((d) => !drop.has(d));
    if (kept.length > 0) out[storeId] = kept;
  }
  return out;
};

export default class CarriedOpenTabs {
  /** storage.local key holding CarriedData. */
  public static readonly LOCAL_KEY = "carriedOpenTabs";

  /** storage.session key: this browser session already moved lastSeen. */
  public static readonly SESSION_KEY = "carriedOpenTabsSession";

  /**
   * Whether this browser lists only some open tabs: Firefox for Android.
   * Asked once per background start; the Chrome build never asks.
   */
  public static appliesHere(): Promise<boolean> {
    if (CURRENT_BROWSER !== "firefox") return Promise.resolve(false);
    if (!CarriedOpenTabs.platform) {
      CarriedOpenTabs.platform = Promise.resolve()
        .then(() => browser.runtime.getPlatformInfo())
        .then((info) => info.os === "android")
        .catch(() => false);
    }
    return CarriedOpenTabs.platform;
  }

  /**
   * The open-tab domains cleanup should protect: the listed tabs' domains,
   * plus on Android the sites carried over from before the restart. Also
   * records the listed tabs' sites for the next restart.
   */
  public static async protect(live: StoreDomains): Promise<StoreDomains> {
    if (!(await CarriedOpenTabs.appliesHere())) return live;
    return CarriedOpenTabs.serialize(async () => {
      const data = await CarriedOpenTabs.load();
      const listed = withoutPrivate(live);
      // Seen in a listed tab: that tab protects the site from now on.
      data.carried = minus(data.carried, listed);
      data.lastSeen = listed;
      await CarriedOpenTabs.save(data);
      return union(live, data.carried);
    }, live);
  }

  /** The person cleaned including open tabs: nothing is carried any more. */
  public static async forget(): Promise<void> {
    if (!(await CarriedOpenTabs.appliesHere())) return;
    await CarriedOpenTabs.serialize(async () => {
      const data = await CarriedOpenTabs.load();
      data.carried = {};
      await CarriedOpenTabs.save(data);
    }, undefined);
  }

  /**
   * Reads the stored data. At the first read of a browser session, the
   * sites seen last session become carried ones.
   */
  protected static async load(): Promise<CarriedData> {
    const key = CarriedOpenTabs.LOCAL_KEY;
    const stored = (await browser.storage.local.get({ [key]: {} }))[key] as
      Partial<CarriedData> | undefined;
    const data: CarriedData = {
      carried: withoutPrivate(stored?.carried ?? {}),
      lastSeen: withoutPrivate(stored?.lastSeen ?? {}),
    };
    if (!(await CarriedOpenTabs.sessionStarted())) {
      data.carried = union(data.carried, data.lastSeen);
      data.lastSeen = {};
      await CarriedOpenTabs.markSessionStarted();
    }
    return data;
  }

  protected static async save(data: CarriedData): Promise<void> {
    await browser.storage.local.set({ [CarriedOpenTabs.LOCAL_KEY]: data });
  }

  protected static async sessionStarted(): Promise<boolean> {
    if (!browser.storage.session) return CarriedOpenTabs.sessionInMemory;
    const key = CarriedOpenTabs.SESSION_KEY;
    const data = await browser.storage.session.get({ [key]: false });
    return data[key] === true;
  }

  protected static async markSessionStarted(): Promise<void> {
    CarriedOpenTabs.sessionInMemory = true;
    if (!browser.storage.session) return;
    await browser.storage.session.set({ [CarriedOpenTabs.SESSION_KEY]: true });
  }

  /**
   * Runs read-modify-write tasks one at a time. A storage failure falls
   * back to `onError` and never breaks cleanup or the chain.
   */
  protected static serialize<T>(
    task: () => Promise<T>,
    onError: T
  ): Promise<T> {
    const run = CarriedOpenTabs.queue.then(task).catch(() => onError);
    CarriedOpenTabs.queue = run.then(() => undefined);
    return run;
  }

  /** For specs: forget the cached platform answer and in-memory flags. */
  public static reset(): void {
    CarriedOpenTabs.platform = undefined;
    CarriedOpenTabs.sessionInMemory = false;
    CarriedOpenTabs.queue = Promise.resolve();
  }

  protected static platform: Promise<boolean> | undefined;

  protected static queue: Promise<void> = Promise.resolve();

  // Fallback for a browser without storage.session; lost on a background
  // restart, which then counts as a new browser session. Carrying the
  // sites once more is harmless: listed tabs drop them again.
  protected static sessionInMemory = false;
}
