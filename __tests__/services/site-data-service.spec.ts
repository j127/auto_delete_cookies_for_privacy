/**
 * @jest-environment jsdom
 */
import { initialState } from "@/redux/state";
import {
  collectPageStorage,
  collectSiteData,
} from "@/services/site-data-service";

// jsdom on purpose (unlike the other services specs): collectPageStorage
// runs against real window.localStorage/sessionStorage here, and the APIs
// jsdom does NOT implement (indexedDB.databases, caches, serviceWorker,
// storage.estimate) exercise the feature guards' null paths for free.

const baseTab: browser.tabs.Tab = {
  active: true,
  cookieStoreId: "default",
  hidden: false,
  highlighted: false,
  incognito: false,
  id: 1,
  index: 0,
  isArticle: false,
  isInReaderMode: false,
  lastAccessed: 12345678,
  pinned: false,
  url: "https://domain.com",
  windowId: 1,
};

const cookieFor = (
  over: Partial<{
    name: string;
    value: string;
    session: boolean;
    expirationDate: number;
    secure: boolean;
    httpOnly: boolean;
  }>
) => ({
  domain: "domain.com",
  hostOnly: true,
  httpOnly: false,
  name: "aCookie",
  path: "/",
  sameSite: "lax",
  secure: false,
  session: true,
  storeId: "default",
  value: "1",
  ...over,
});

const pagePayload: SiteDataPageInventory = {
  localStorage: [{ key: "k", sizeBytes: 2 }],
  sessionStorage: [],
  indexedDB: [{ name: "db", version: 1 }],
  cacheStorage: ["v1-cache"],
  serviceWorkers: ["https://domain.com/"],
  usage: 4096,
  quota: 120000,
  usageDetails: { indexedDB: 4000 },
};

describe("collectSiteData()", () => {
  it("resolves { available: false } for restricted or URL-less tabs without injecting", async () => {
    const restricted = [
      { ...baseTab, url: "chrome://extensions" },
      { ...baseTab, url: "about:blank" },
      { ...baseTab, url: "" },
      { ...baseTab, url: undefined },
      { ...baseTab, id: undefined },
    ];
    for (const tab of restricted) {
      expect(await collectSiteData(initialState, tab)).toEqual({
        available: false,
      });
    }
    expect(global.browser.scripting.executeScript).not.toHaveBeenCalled();
  });

  it("resolves { available: false } when script injection is rejected", async () => {
    global.browser.cookies.getAll.mockResolvedValue([cookieFor({})] as never);
    global.browser.scripting.executeScript.mockRejectedValue(
      new Error("Cannot access contents of the page.")
    );
    expect(await collectSiteData(initialState, baseTab)).toEqual({
      available: false,
    });
  });

  it("returns the inventory with the marker cookie excluded and UTF-8 sizes", async () => {
    global.browser.cookies.getAll.mockResolvedValue([
      cookieFor({ name: "ADCPBrowsingDataCleanup", value: "1" }),
      cookieFor({ name: "id", value: "é" }),
      cookieFor({
        name: "keep",
        value: "x",
        session: false,
        expirationDate: 1893456000,
        secure: true,
        httpOnly: true,
      }),
    ] as never);
    global.browser.scripting.executeScript.mockResolvedValue([
      { frameId: 0, result: pagePayload },
    ] as never);

    const inventory = await collectSiteData(initialState, baseTab);

    expect(global.browser.scripting.executeScript).toHaveBeenCalledWith({
      target: { tabId: 1 },
      func: expect.any(Function),
    });
    expect(inventory.available).toBe(true);
    expect(inventory.hostname).toBe("domain.com");
    // "id" (2) + "é" (2 bytes in UTF-8) = 4.
    expect(inventory.cookies).toEqual([
      {
        name: "id",
        sizeBytes: 4,
        session: true,
        secure: false,
        httpOnly: false,
      },
      {
        name: "keep",
        sizeBytes: 5,
        session: false,
        expirationDate: 1893456000,
        secure: true,
        httpOnly: true,
      },
    ]);
    expect(inventory.page).toEqual(pagePayload);
  });

  it("returns a null page when the injection produced no result", async () => {
    global.browser.cookies.getAll.mockResolvedValue([] as never);
    global.browser.scripting.executeScript.mockResolvedValue([] as never);
    const inventory = await collectSiteData(initialState, baseTab);
    expect(inventory).toEqual({
      available: true,
      hostname: "domain.com",
      cookies: [],
      page: null,
    });
  });
});

describe("collectPageStorage()", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("lists storage keys with UTF-8 sizes and nulls the APIs jsdom lacks", async () => {
    window.localStorage.setItem("a", "1");
    window.localStorage.setItem("ké", "vé");
    window.sessionStorage.setItem("s", "xyz");

    const payload = await collectPageStorage();

    expect(payload.localStorage).toEqual([
      { key: "a", sizeBytes: 2 },
      // "ké" (3 bytes) + "vé" (3 bytes).
      { key: "ké", sizeBytes: 6 },
    ]);
    expect(payload.sessionStorage).toEqual([{ key: "s", sizeBytes: 4 }]);
    // jsdom implements none of these; the guards must null them, not throw.
    expect(payload.indexedDB).toBeNull();
    expect(payload.cacheStorage).toBeNull();
    expect(payload.serviceWorkers).toBeNull();
    expect(payload.usage).toBeNull();
    expect(payload.quota).toBeNull();
    expect(payload.usageDetails).toBeNull();
  });

  it("collects every category when the page APIs exist", async () => {
    Object.defineProperty(window, "indexedDB", {
      configurable: true,
      value: {
        databases: async () => [
          { name: "appdb", version: 3 },
          { name: undefined, version: undefined },
        ],
      },
    });
    Object.defineProperty(window, "caches", {
      configurable: true,
      value: { keys: async () => ["v1", "v2"] },
    });
    Object.defineProperty(window.navigator, "serviceWorker", {
      configurable: true,
      value: {
        getRegistrations: async () => [{ scope: "https://domain.com/app/" }],
      },
    });
    Object.defineProperty(window.navigator, "storage", {
      configurable: true,
      value: {
        estimate: async () => ({
          usage: 1234,
          quota: 999999,
          usageDetails: { indexedDB: 1000, caches: 200 },
        }),
      },
    });
    try {
      const payload = await collectPageStorage();
      expect(payload.indexedDB).toEqual([
        { name: "appdb", version: 3 },
        { name: "", version: null },
      ]);
      expect(payload.cacheStorage).toEqual(["v1", "v2"]);
      expect(payload.serviceWorkers).toEqual(["https://domain.com/app/"]);
      expect(payload.usage).toBe(1234);
      expect(payload.quota).toBe(999999);
      expect(payload.usageDetails).toEqual({ indexedDB: 1000, caches: 200 });
    } finally {
      // Remove the stubs so the null-path spec stays accurate on re-runs.
      delete (window as any).indexedDB;
      delete (window as any).caches;
      delete (window.navigator as any).serviceWorker;
      delete (window.navigator as any).storage;
    }
  });

  it("nulls a category whose API throws instead of failing the collection", async () => {
    Object.defineProperty(window, "indexedDB", {
      configurable: true,
      value: {
        databases: async () => {
          throw new Error("blocked");
        },
      },
    });
    try {
      const payload = await collectPageStorage();
      expect(payload.indexedDB).toBeNull();
      expect(payload.localStorage).toEqual([]);
    } finally {
      delete (window as any).indexedDB;
    }
  });
});
