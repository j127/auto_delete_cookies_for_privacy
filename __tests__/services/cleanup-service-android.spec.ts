/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * Firefox for Android (#534) through the real cleanup pipeline on the
 * Gecko-semantics jar: no contextualIdentities API, tabs without a
 * cookieStoreId, and a tabs.query that lists only the tabs Firefox has
 * loaded since it started.
 */
import { when } from "jest-when";
import { installAndroidFlavor, stubAndroidPlatform } from "../android-flavor";
import { installGeckoCookieMock } from "../gecko-flavor";

vi.stubGlobal("__BROWSER__", "firefox");
vi.resetModules();
installAndroidFlavor();
const { initialState } = await import("@/redux/state");
const { cleanCookiesOperation } = await import("@/services/cleanup-service");
const { default: CarriedOpenTabs } =
  await import("@/services/carried-open-tabs");
const { default: ContextualIdentityEvents } =
  await import("@/services/contextual-identity-events");

const fxCookie = (domain: string): browser.cookies.Cookie => ({
  domain,
  firstPartyDomain: "",
  hostOnly: true,
  httpOnly: false,
  name: "session",
  path: "/",
  sameSite: "no_restriction",
  secure: true,
  session: false,
  storeId: "firefox-default",
  value: "v",
});

// What Firefox for Android reports for a normal tab: no cookieStoreId.
const androidTab = (url: string) => ({ id: 1, incognito: false, url });

const runCleanup = () =>
  cleanCookiesOperation(initialState, {
    greyCleanup: false,
    ignoreOpenTabs: false,
  });

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

describe("cleanup on Firefox for Android (#534)", () => {
  beforeEach(() => {
    for (const k of Object.keys(local)) delete local[k];
    for (const k of Object.keys(session)) delete session[k];
    backArea(global.browser.storage.local, local);
    backArea(global.browser.storage.session, session);
    CarriedOpenTabs.reset();
    stubAndroidPlatform();
    when(global.browser.extension.isAllowedIncognitoAccess)
      .calledWith()
      .mockResolvedValue(false as never);
    when(global.browser.cookies.getAllCookieStores)
      .calledWith()
      .mockResolvedValue([{ id: "firefox-default" }] as never);
  });

  it("enumerates Firefox's default store without asking for containers", async () => {
    vi.mocked(global.browser.tabs.query).mockResolvedValue([]);
    const jar = installGeckoCookieMock();
    jar.seed(fxCookie("closed.example"));
    const result = await runCleanup();
    expect(result.cachedResults.recentlyCleaned).toBe(1);
    expect(jar.cookies).toHaveLength(0);
  });

  it("keeps the cookies of a site open in a tab that names no cookie store", async () => {
    vi.mocked(global.browser.tabs.query).mockResolvedValue([
      androidTab("https://open.example/inbox"),
    ] as browser.tabs.Tab[]);
    const jar = installGeckoCookieMock();
    jar.seed(fxCookie("open.example"), fxCookie("closed.example"));
    await runCleanup();
    // Keyed "0" (Chrome's id), the tab protected nothing and both went.
    expect(jar.cookies.map((c) => c.domain)).toEqual(["open.example"]);
  });

  it("keeps the cookies of a site whose tab Firefox has not restored after a restart", async () => {
    vi.mocked(global.browser.tabs.query).mockResolvedValue([
      androidTab("https://mail.example/"),
      androidTab("https://news.example/"),
    ] as browser.tabs.Tab[]);
    const jar = installGeckoCookieMock();
    await runCleanup();

    // Restart: storage.session is gone and only the tab on screen loads.
    for (const k of Object.keys(session)) delete session[k];
    CarriedOpenTabs.reset();
    stubAndroidPlatform();
    vi.mocked(global.browser.tabs.query).mockResolvedValue([
      androidTab("https://news.example/"),
    ] as browser.tabs.Tab[]);
    jar.seed(fxCookie("mail.example"), fxCookie("closed.example"));
    await runCleanup();
    expect(jar.cookies.map((c) => c.domain)).toEqual(["mail.example"]);
  });

  it("leaves the container service inert", async () => {
    expect(ContextualIdentityEvents.isSupported()).toBe(false);
    await ContextualIdentityEvents.init();
    expect(global.browser.storage.session.get).not.toHaveBeenCalledWith({
      [ContextualIdentityEvents.SESSION_KEY]: {},
    });
  });
});
