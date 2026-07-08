/**
 * @jest-environment jsdom
 */
import * as React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore } from "redux";
import { initialState } from "@/redux/state";
import { collectSiteData } from "@/services/site-data-service";
import SiteDataPanel, {
  formatBytes,
} from "@/ui/popup/components/SiteDataPanel";

vi.mock("@/services/site-data-service", () => ({
  collectSiteData: vi.fn(),
}));

const tabFixture = {
  active: true,
  highlighted: false,
  id: 1,
  incognito: false,
  index: 0,
  pinned: false,
  url: "https://example.com/",
  windowId: 1,
} as browser.tabs.Tab;

const fullInventory: SiteDataInventory = {
  available: true,
  hostname: "example.com",
  cookies: [
    {
      name: "sid",
      sizeBytes: 40,
      session: true,
      secure: true,
      httpOnly: true,
    },
    {
      name: "theme",
      sizeBytes: 12,
      session: false,
      expirationDate: 1893456000,
      secure: false,
      httpOnly: false,
    },
  ],
  page: {
    localStorage: [
      { key: "cart", sizeBytes: 512 },
      { key: "prefs", sizeBytes: 64 },
    ],
    sessionStorage: [],
    indexedDB: [{ name: "appdb", version: 4 }],
    cacheStorage: ["v1-assets"],
    serviceWorkers: null,
    usage: 2048,
    quota: 1073741824,
    usageDetails: { indexedDB: 1024, caches: 512 },
  },
};

const emptyInventory: SiteDataInventory = {
  available: true,
  hostname: "example.com",
  cookies: [],
  page: {
    localStorage: [],
    sessionStorage: [],
    indexedDB: [],
    cacheStorage: [],
    serviceWorkers: [],
    usage: 0,
    quota: 1073741824,
    usageDetails: null,
  },
};

describe("SiteDataPanel", () => {
  beforeEach(() => {
    global.browser.i18n.getMessage.mockImplementation(
      (key: string, subs?: string[]) =>
        subs && subs.length ? `${key}:${subs.join(",")}` : key
    );
  });

  const renderPanel = (dataVersion = 0) => {
    const store = createStore(() => initialState);
    const view = render(
      <Provider store={store}>
        <SiteDataPanel dataVersion={dataVersion} tab={tabFixture} />
      </Provider>
    );
    const rerenderWith = (version: number) =>
      view.rerender(
        <Provider store={store}>
          <SiteDataPanel dataVersion={version} tab={tabFixture} />
        </Provider>
      );
    return { ...view, rerenderWith };
  };

  it("shows the loading state while the collector runs", () => {
    vi.mocked(collectSiteData).mockReturnValue(new Promise(() => {}));
    const { getByText } = renderPanel();
    getByText("siteDataLoadingText");
  });

  it("shows the not-available state for restricted pages", async () => {
    vi.mocked(collectSiteData).mockResolvedValue({ available: false });
    const { getByText } = renderPanel();
    await waitFor(() => {
      getByText("siteDataNotAvailableText");
    });
  });

  it("shows the empty state when every category is empty", async () => {
    vi.mocked(collectSiteData).mockResolvedValue(emptyInventory);
    const { getByText, queryByText } = renderPanel();
    await waitFor(() => {
      getByText("siteDataEmptyText");
    });
    expect(queryByText("cookiesText")).toBeNull();
  });

  it("renders all six category rows with counts, sizes, and details", async () => {
    vi.mocked(collectSiteData).mockResolvedValue(fullInventory);
    const { getByText, getAllByText, container } = renderPanel();
    await waitFor(() => {
      getByText("cookiesText");
    });
    // All six category labels.
    [
      "cookiesText",
      "localStorageText",
      "sessionStorageText",
      "indexedDBText",
      "cacheText",
      "serviceWorkersText",
    ].forEach((label) => getByText(label));
    // Counts: cookies 2, localStorage 2, sessionStorage 0, indexedDB 1,
    // cacheStorage 1; serviceWorkers is null -> "unknown" badge.
    expect(getAllByText("2")).toHaveLength(2);
    getByText("siteDataUnknownText");
    // Cookie details carry session/expiry markers and sizes.
    getByText(/sid — 40 B · siteDataSessionCookieText/);
    getByText(/theme — 12 B · siteDataExpiresText:/);
    // Storage keys with sizes; database name with version; cache name.
    getByText("cart — 512 B");
    getByText("appdb (v4)");
    getByText("v1-assets");
    // Category bytes from usageDetails where per-item sizes are unknown.
    getByText("1.0 kB");
    // Overall usage line from storage.estimate().
    getByText("siteDataUsageText:2.0 kB,1.0 GB");
    // Six per-category disclosure rows inside the panel body.
    expect(container.querySelectorAll("#siteDataPanel details")).toHaveLength(
      6
    );
  });

  it("re-collects when the refresh button is pressed", async () => {
    vi.mocked(collectSiteData).mockResolvedValue(emptyInventory);
    const { getByTitle, getByText } = renderPanel();
    await waitFor(() => {
      getByText("siteDataEmptyText");
    });
    expect(vi.mocked(collectSiteData)).toHaveBeenCalledTimes(1);
    fireEvent.click(getByTitle("siteDataRefreshTitle"));
    await waitFor(() => {
      expect(vi.mocked(collectSiteData)).toHaveBeenCalledTimes(2);
    });
  });

  it("re-collects when dataVersion bumps after a clean", async () => {
    vi.mocked(collectSiteData).mockResolvedValue(fullInventory);
    const { getByText, rerenderWith } = renderPanel(0);
    await waitFor(() => {
      getByText("cookiesText");
    });
    vi.mocked(collectSiteData).mockResolvedValue(emptyInventory);
    rerenderWith(1);
    await waitFor(() => {
      getByText("siteDataEmptyText");
    });
    expect(vi.mocked(collectSiteData)).toHaveBeenCalledTimes(2);
  });

  it("never wedges in loading when the collector rejects unexpectedly", async () => {
    vi.mocked(collectSiteData).mockRejectedValue(new Error("boom"));
    const { getByText } = renderPanel();
    await waitFor(() => {
      getByText("siteDataNotAvailableText");
    });
    expect(console.error).not.toHaveBeenCalled();
  });
});

describe("formatBytes()", () => {
  it("formats across unit boundaries", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1023)).toBe("1023 B");
    expect(formatBytes(1536)).toBe("1.5 kB");
    expect(formatBytes(1048576)).toBe("1.0 MB");
    expect(formatBytes(3221225472)).toBe("3.0 GB");
  });
});
