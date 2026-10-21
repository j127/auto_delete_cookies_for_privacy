/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */
import { installAndroidFlavor, stubAndroidPlatform } from "../android-flavor";

vi.stubGlobal("__BROWSER__", "firefox");
vi.resetModules();
const { default: CarriedOpenTabs } =
  await import("@/services/carried-open-tabs");
const { returnContainersOfOpenTabDomains } =
  await import("@/services/cleanup-service");

/** Stateful storage.local / storage.session backed by plain objects. */
const local: Record<string, unknown> = {};
const session: Record<string, unknown> = {};
const backArea = (
  area: typeof global.browser.storage.local,
  store: Record<string, unknown>
) => {
  vi.mocked(area.get).mockImplementation(async (defaults) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(defaults as object)) {
      out[k] = k in store ? structuredClone(store[k]) : v;
    }
    return out;
  });
  vi.mocked(area.set).mockImplementation(async (items) => {
    Object.assign(store, structuredClone(items));
  });
};

/** A browser restart: storage.session and the background's memory go. */
const restart = () => {
  for (const k of Object.keys(session)) delete session[k];
  CarriedOpenTabs.reset();
  stubAndroidPlatform();
};

const tab = (url: string, incognito = false): Partial<browser.tabs.Tab> => ({
  id: Math.floor(Math.random() * 1e6),
  incognito,
  url,
});

const listTabs = (...tabs: Partial<browser.tabs.Tab>[]) => {
  vi.mocked(global.browser.tabs.query).mockResolvedValue(
    tabs as browser.tabs.Tab[]
  );
};

describe("CarriedOpenTabs on Firefox for Android (#534)", () => {
  beforeAll(() => installAndroidFlavor());

  beforeEach(() => {
    for (const k of Object.keys(local)) delete local[k];
    backArea(global.browser.storage.local, local);
    backArea(global.browser.storage.session, session);
    restart();
  });

  it("applies on Android only", async () => {
    expect(await CarriedOpenTabs.appliesHere()).toBe(true);
    CarriedOpenTabs.reset();
    vi.mocked(global.browser.runtime.getPlatformInfo).mockResolvedValue({
      arch: "x86-64",
      os: "linux",
    } as never);
    expect(await CarriedOpenTabs.appliesHere()).toBe(false);
  });

  it("does not apply when the platform cannot be read", async () => {
    CarriedOpenTabs.reset();
    vi.mocked(global.browser.runtime.getPlatformInfo).mockRejectedValue(
      new Error("nope")
    );
    expect(await CarriedOpenTabs.appliesHere()).toBe(false);
  });

  it("keeps protecting a site whose tab Firefox has not restored after a restart", async () => {
    listTabs(tab("https://mail.example.com/inbox"), tab("https://news.org/"));
    expect(await returnContainersOfOpenTabDomains(false, false)).toEqual({
      "firefox-default": ["example.com", "news.org"],
    });

    restart();
    // Only the tab on screen is listed after the restart.
    listTabs(tab("https://news.org/"));
    const protectedDomains = await returnContainersOfOpenTabDomains(
      false,
      false
    );
    expect(protectedDomains["firefox-default"]).toEqual(
      expect.arrayContaining(["example.com", "news.org"])
    );
  });

  it("stops carrying a site once a listed tab shows it, so closing that tab lets cleanup run", async () => {
    listTabs(tab("https://example.com/"));
    await returnContainersOfOpenTabDomains(false, false);
    restart();

    listTabs(tab("https://example.com/"));
    await returnContainersOfOpenTabDomains(false, false);
    // The tab closed: nothing protects the site any more.
    listTabs();
    expect(await returnContainersOfOpenTabDomains(false, false)).toEqual({});
  });

  it("carries an unrestored site over more than one restart", async () => {
    listTabs(tab("https://example.com/"), tab("https://news.org/"));
    await returnContainersOfOpenTabDomains(false, false);
    restart();
    listTabs(tab("https://news.org/"));
    await returnContainersOfOpenTabDomains(false, false);
    restart();
    listTabs(tab("https://news.org/"));
    expect(
      (await returnContainersOfOpenTabDomains(false, false))["firefox-default"]
    ).toContain("example.com");
  });

  it("forgets carried sites when the person cleans including open tabs", async () => {
    listTabs(tab("https://example.com/"));
    await returnContainersOfOpenTabDomains(false, false);
    restart();
    listTabs();
    expect(await returnContainersOfOpenTabDomains(true, false)).toEqual({});
    expect(await returnContainersOfOpenTabDomains(false, false)).toEqual({});
  });

  it("never writes private tabs' sites to disk", async () => {
    listTabs(tab("https://secret.example/", true), tab("https://news.org/"));
    const live = await returnContainersOfOpenTabDomains(false, false);
    // A private tab still protects its site while it is open...
    expect(live["firefox-private"]).toEqual(["secret.example"]);
    // ...but is never stored for a restart.
    expect(JSON.stringify(local)).not.toContain("secret.example");
    restart();
    listTabs();
    expect(await returnContainersOfOpenTabDomains(false, false)).toEqual({
      "firefox-default": ["news.org"],
    });
  });

  it("drops private stores found in stored data", async () => {
    local[CarriedOpenTabs.LOCAL_KEY] = {
      carried: { "firefox-private": ["secret.example"] },
      lastSeen: { private: ["other.example"] },
    };
    expect(await CarriedOpenTabs.protect({})).toEqual({});
  });

  it("falls back to the listed tabs when storage fails", async () => {
    vi.mocked(global.browser.storage.local.get).mockRejectedValue(
      new Error("quota")
    );
    const live = { "firefox-default": ["example.com"] };
    expect(await CarriedOpenTabs.protect(live)).toEqual(live);
  });

  it("works without storage.session, counting a background restart as a new session", async () => {
    const sessionArea = global.browser.storage.session;
    try {
      (global.browser.storage as { session?: unknown }).session = undefined;
      listTabs(tab("https://example.com/"));
      await returnContainersOfOpenTabDomains(false, false);
      restart();
      listTabs();
      expect(await returnContainersOfOpenTabDomains(false, false)).toEqual({
        "firefox-default": ["example.com"],
      });
    } finally {
      global.browser.storage.session = sessionArea;
    }
  });
});

describe("CarriedOpenTabs on desktop Firefox", () => {
  beforeEach(() => {
    CarriedOpenTabs.reset();
    vi.mocked(global.browser.runtime.getPlatformInfo).mockResolvedValue({
      arch: "x86-64",
      os: "mac",
    } as never);
  });

  it("passes the listed tabs through and touches no storage", async () => {
    const live = { "firefox-default": ["example.com"] };
    expect(await CarriedOpenTabs.protect(live)).toBe(live);
    await CarriedOpenTabs.forget();
    expect(global.browser.storage.local.get).not.toHaveBeenCalled();
    expect(global.browser.storage.local.set).not.toHaveBeenCalled();
  });
});
