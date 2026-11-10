/**
 * @jest-environment jsdom
 */
import * as React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore } from "redux";
import { initialState } from "@/redux/state";
import {
  collectSiteData,
  removeSiteCookie,
} from "@/services/site-data-service";
import SiteDataPanel, {
  COOKIE_FILTER_THRESHOLD,
  formatBytes,
  matchesCookieFilter,
  normalizeForFilter,
} from "@/ui/popup/components/SiteDataPanel";

vi.mock("@/services/site-data-service", () => ({
  collectSiteData: vi.fn(),
  removeSiteCookie: vi.fn(),
}));

/** Where a fixture cookie lives (#592). */
const where = {
  domain: "example.com",
  path: "/",
  hostOnly: true,
  storeId: "0",
};

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
      ...where,
    },
    {
      name: "theme",
      sizeBytes: 12,
      session: false,
      expirationDate: 1893456000,
      secure: false,
      httpOnly: false,
      ...where,
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

  const renderPanel = (dataVersion = 0, canDelete = false) => {
    const store = createStore(() => initialState);
    const view = render(
      <Provider store={store}>
        <SiteDataPanel
          canDelete={canDelete}
          dataVersion={dataVersion}
          tab={tabFixture}
        />
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

describe("SiteDataPanel cookie list (#592)", () => {
  const cookie = (
    name: string,
    over: Partial<SiteDataCookieEntry> = {}
  ): SiteDataCookieEntry => ({
    name,
    sizeBytes: 10,
    session: true,
    secure: true,
    httpOnly: false,
    ...where,
    ...over,
  });

  const inventoryWith = (
    cookies: SiteDataCookieEntry[]
  ): SiteDataInventory => ({ ...fullInventory, cookies });

  const manyCookies = (): SiteDataCookieEntry[] => [
    cookie("session_id"),
    cookie("_ga", { domain: ".tracker-example.com" }),
    ...Array.from({ length: COOKIE_FILTER_THRESHOLD - 2 }, (_, i) =>
      cookie(`pref_${i}`)
    ),
  ];

  const renderList = async (
    cookies: SiteDataCookieEntry[],
    canDelete = false
  ) => {
    vi.mocked(collectSiteData).mockResolvedValue(inventoryWith(cookies));
    const store = createStore(() => initialState);
    const view = render(
      <Provider store={store}>
        <SiteDataPanel canDelete={canDelete} dataVersion={0} tab={tabFixture} />
      </Provider>
    );
    await waitFor(() => {
      view.getByText("cookiesText");
    });
    const items = () =>
      [...view.container.querySelectorAll("#cookieList li")].map(
        (li) => (li.querySelector("span") as HTMLElement).textContent ?? ""
      );
    return { ...view, items };
  };

  beforeEach(() => {
    global.browser.i18n.getMessage.mockImplementation(
      (key: string, subs?: string[]) =>
        subs && subs.length ? `${key}:${subs.join(",")}` : key
    );
    vi.mocked(collectSiteData).mockReset();
    vi.mocked(removeSiteCookie).mockReset();
  });

  it("has no filter box on a short list", async () => {
    const { container } = await renderList([cookie("a"), cookie("b")]);
    expect(container.querySelector("#cookieFilter")).toBeNull();
  });

  it("filters a long list by name, ignoring case and separators", async () => {
    const { container, items } = await renderList(manyCookies());
    const filter = container.querySelector("#cookieFilter") as HTMLInputElement;
    expect(filter).not.toBeNull();
    expect(filter.placeholder).toBe("siteDataFilterCookiesText");
    expect(items()).toHaveLength(COOKIE_FILTER_THRESHOLD);

    fireEvent.change(filter, { target: { value: "SESSION-ID" } });
    expect(items()).toEqual([expect.stringMatching(/^session_id /)]);
  });

  it("filters by the cookie's domain too", async () => {
    const { container, items } = await renderList(manyCookies());
    fireEvent.change(container.querySelector("#cookieFilter") as Element, {
      target: { value: "tracker" },
    });
    expect(items()).toEqual([expect.stringMatching(/^_ga /)]);
  });

  it("says so when nothing matches", async () => {
    const { container, getByText } = await renderList(manyCookies());
    fireEvent.change(container.querySelector("#cookieFilter") as Element, {
      target: { value: "nothing-like-this" },
    });
    getByText("siteDataNoMatchingCookiesText");
    expect(container.querySelectorAll("#cookieList li")).toHaveLength(0);
  });

  it("shows each cookie's domain and path in its tooltip", async () => {
    const { container } = await renderList([
      cookie("sid"),
      cookie("sid", {
        partitionKey: { topLevelSite: "https://top.example" },
      }),
    ]);
    const titles = [...container.querySelectorAll("#cookieList li")].map((li) =>
      li.getAttribute("title")
    );
    expect(titles).toEqual([
      "example.com/",
      "example.com/ (https://top.example)",
    ]);
  });

  it("offers no delete buttons outside advanced mode", async () => {
    const { container } = await renderList([cookie("sid")]);
    expect(container.querySelectorAll("#cookieList li button")).toHaveLength(0);
  });

  it("deletes exactly the clicked cookie in advanced mode, then re-collects", async () => {
    const partitioned = cookie("sid", {
      partitionKey: { topLevelSite: "https://top.example" },
    });
    const { getAllByLabelText } = await renderList(
      [cookie("sid"), partitioned],
      true
    );
    vi.mocked(removeSiteCookie).mockResolvedValue(true);
    const buttons = getAllByLabelText("siteDataDeleteCookieTitle:sid");
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[1]);
    await waitFor(() => {
      expect(vi.mocked(collectSiteData)).toHaveBeenCalledTimes(2);
    });
    expect(vi.mocked(removeSiteCookie)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(removeSiteCookie)).toHaveBeenCalledWith(partitioned);
  });

  it("keeps an open row and the filter through a re-collect", async () => {
    const cookies = manyCookies();
    vi.mocked(collectSiteData).mockResolvedValue(inventoryWith(cookies));
    const store = createStore(() => initialState);
    const panel = (version: number) => (
      <Provider store={store}>
        <SiteDataPanel
          canDelete={true}
          dataVersion={version}
          tab={tabFixture}
        />
      </Provider>
    );
    const view = render(panel(0));
    await waitFor(() => {
      view.getByText("cookiesText");
    });
    const cookieRow = () =>
      view.container
        .querySelector("#cookieList")
        ?.closest("details") as HTMLDetailsElement;
    cookieRow().open = true;
    fireEvent.change(view.container.querySelector("#cookieFilter") as Element, {
      target: { value: "pref" },
    });

    // A cookie went away (deleted, or the site removed it): re-collect.
    vi.mocked(collectSiteData).mockResolvedValue(
      inventoryWith(cookies.filter((c) => c.name !== "pref_0"))
    );
    view.rerender(panel(1));
    await waitFor(() => {
      expect(vi.mocked(collectSiteData)).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(view.container.querySelectorAll("#cookieList li")).toHaveLength(
        COOKIE_FILTER_THRESHOLD - 3
      );
    });
    expect(view.queryByText("siteDataLoadingText")).toBeNull();
    expect(cookieRow().open).toBe(true);
    expect(
      (view.container.querySelector("#cookieFilter") as HTMLInputElement).value
    ).toBe("pref");
  });

  it("marks a cookie the browser didn't delete", async () => {
    const { getByLabelText, getByText } = await renderList(
      [cookie("stubborn")],
      true
    );
    vi.mocked(removeSiteCookie).mockResolvedValue(false);
    fireEvent.click(getByLabelText("siteDataDeleteCookieTitle:stubborn"));
    await waitFor(() => {
      getByText("siteDataDeleteFailedText");
    });
    expect(vi.mocked(collectSiteData)).toHaveBeenCalledTimes(1);
  });
});

describe("cookie filter matching (#592)", () => {
  const entry = (name: string, domain = "example.com") =>
    ({ name, domain }) as SiteDataCookieEntry;

  it("normalizes case, spaces, dots, underscores and hyphens away", () => {
    expect(normalizeForFilter(" Session_ID-x.y ")).toBe("sessionidxy");
  });

  it("matches everything for an empty or separator-only query", () => {
    expect(matchesCookieFilter(entry("a"), "")).toBe(true);
    expect(matchesCookieFilter(entry("a"), " _-. ")).toBe(true);
  });

  it("matches names and domains as substrings, not as fuzzy guesses", () => {
    expect(matchesCookieFilter(entry("__Secure-3PSID"), "3psid")).toBe(true);
    expect(
      matchesCookieFilter(entry("x", "accounts.google.com"), "google")
    ).toBe(true);
    // A fuzzy subsequence would match these; a substring does not.
    expect(matchesCookieFilter(entry("session"), "ssn")).toBe(false);
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
