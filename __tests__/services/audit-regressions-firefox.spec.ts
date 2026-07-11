/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2017-2022 Kenny Do and CAD Team; fork changes (c) 2026 j127.
 * Licensed under MIT (see LICENSE).
 */

/**
 * Pinned regressions for the Firefox audit findings, each run through the
 * REAL cleanup pipeline against the Gecko-semantics jar — written so the
 * pre-fix logic demonstrably fails them:
 *
 * - bug 1: without firstPartyDomain: null, the jar's getAll REJECTS under
 *   FPI and pre-fix code swallowed that per store → zero cleaned.
 * - bug 3: with FPI off, an omitted firstPartyDomain hides leftover
 *   isolated cookies → pre-fix never saw them.
 * - bug 2: without partitionKey: {}, TCP-partitioned cookies are
 *   filtered out by the jar → pre-fix could not see or delete them.
 * - bug 4: pre-fix keyed private-window expressions and private cookies
 *   to different list keys → the whitelist protected nothing.
 * - bug 5: pre-fix sent origins to browsingData → the jar rejects it.
 * - bug 6a: pre-fix skipped container stores entirely → their cookies
 *   were never enumerated.
 * - bug 9: pre-fix collapsed user.github.io to github.io → an open tab
 *   protected the whole platform suffix.
 */
import { when } from "jest-when";
import { ListType, SettingID, SiteDataType } from "@/typings/enums";
import { installGeckoCookieMock } from "../gecko-flavor";

vi.stubGlobal("__BROWSER__", "firefox");
vi.resetModules();
const { initialState } = await import("@/redux/state");
const { cleanCookiesOperation, cleanSiteData } =
  await import("@/services/cleanup-service");
const { OpenTabStatus, ReasonClean } = await import("@/typings/enums");

const fxCookie = (
  overrides: Partial<browser.cookies.Cookie> & { domain: string }
): browser.cookies.Cookie => ({
  firstPartyDomain: "",
  hostOnly: true,
  httpOnly: false,
  name: "c",
  path: "/",
  sameSite: "no_restriction",
  secure: true,
  session: false,
  storeId: "firefox-default",
  value: "v",
  ...overrides,
});

const runCleanup = (state: State = initialState) =>
  cleanCookiesOperation(state, { greyCleanup: false, ignoreOpenTabs: false });

describe("audit regressions on the Gecko-semantics jar", () => {
  beforeEach(() => {
    when(global.browser.tabs.query)
      .calledWith(expect.any(Object))
      .mockResolvedValue([] as never);
    when(global.browser.extension.isAllowedIncognitoAccess)
      .calledWith()
      .mockResolvedValue(false as never);
    when(global.browser.cookies.getAllCookieStores)
      .calledWith()
      .mockResolvedValue([{ id: "firefox-default" }] as never);
    when(global.browser.contextualIdentities.query)
      .calledWith(expect.any(Object))
      .mockResolvedValue([] as never);
  });

  it("bug 1: cleans under First-Party Isolation instead of silently no-oping", async () => {
    const jar = installGeckoCookieMock({ firstPartyIsolate: true });
    jar.seed(
      fxCookie({ domain: "tracker.example", firstPartyDomain: "site.example" })
    );
    const result = await runCleanup();
    // Pre-fix: the FPD-less getAll rejected, the rejection was swallowed
    // per store, and recentlyCleaned stayed 0 — for five years.
    expect(result.cachedResults.recentlyCleaned).toBe(1);
    expect(jar.cookies).toHaveLength(0);
  });

  it("bug 3: reaches leftover FPI cookies after isolation is switched off", async () => {
    const jar = installGeckoCookieMock({ firstPartyIsolate: false });
    jar.seed(
      fxCookie({ domain: "old.example", firstPartyDomain: "old.example" })
    );
    const result = await runCleanup();
    // Pre-fix: an omitted firstPartyDomain only matched non-isolated
    // cookies, so the leftover was invisible forever.
    expect(result.cachedResults.recentlyCleaned).toBe(1);
    expect(jar.cookies).toHaveLength(0);
  });

  it("bug 2: sees and deletes TCP-partitioned third-party cookies", async () => {
    const jar = installGeckoCookieMock();
    jar.seed(
      fxCookie({
        domain: "tracker.example",
        name: "tcp",
        partitionKey: { topLevelSite: "https://shop.example" },
      })
    );
    const result = await runCleanup();
    // Pre-fix: no partitionKey on getAll → the jar returns unpartitioned
    // cookies only → the tracker cookie was invisible and undeletable.
    expect(result.cachedResults.recentlyCleaned).toBe(1);
    expect(jar.cookies).toHaveLength(0);
  });

  it("bug 4: a private-window whitelist actually protects private cookies", async () => {
    const jar = installGeckoCookieMock();
    when(global.browser.extension.isAllowedIncognitoAccess)
      .calledWith()
      .mockResolvedValue(true as never);
    jar.seed(
      fxCookie({
        domain: "keep.example",
        storeId: "firefox-private",
      })
    );
    const state: State = {
      ...initialState,
      lists: {
        // What the popup write path produces in a Firefox private window
        // since the storeId unification: the unified "private" key.
        private: [
          {
            expression: "keep.example",
            listType: ListType.WHITE,
            storeId: "private",
          },
        ],
      },
    };
    await runCleanup(state);
    // Pre-fix: cleanup matched private cookies against a separate
    // firefox-private key nothing ever wrote to → always cleaned.
    expect(jar.cookies).toHaveLength(1);
  });

  it("bug 5: site-data removal survives Gecko's origins rejection", async () => {
    installGeckoCookieMock();
    const cleaned = await cleanSiteData(
      initialState,
      SiteDataType.LOCALSTORAGE,
      [
        {
          cached: false,
          cleanCookie: true,
          cookie: {
            ...fxCookie({ domain: "sub.x.example" }),
            hostname: "sub.x.example",
            mainDomain: "x.example",
            preparedCookieDomain: "https://sub.x.example/",
          },
          openTabStatus: OpenTabStatus.TabsWasNotIgnored,
          reason: ReasonClean.NoMatchedExpression,
        },
      ],
      false
    );
    // Pre-fix: the hardcoded { origins } call rejected on Firefox and
    // site-data cleanup was hard-broken there.
    expect(cleaned).toEqual(["sub.x.example"]);
  });

  it("bug 6a: cleans cookies of a container store that has no open tab", async () => {
    const jar = installGeckoCookieMock();
    when(global.browser.contextualIdentities.query)
      .calledWith(expect.any(Object))
      .mockResolvedValue([
        { cookieStoreId: "firefox-container-3", color: "red", name: "X" },
      ] as never);
    jar.seed(
      fxCookie({ domain: "leak.example", storeId: "firefox-container-3" })
    );
    const result = await runCleanup();
    // Pre-fix: container stores were skipped wholesale while the
    // container setting was off — their cookies leaked forever.
    expect(result.cachedResults.recentlyCleaned).toBe(1);
    expect(jar.cookies).toHaveLength(0);
  });

  it("bug 9: an open user site does not protect the whole platform suffix", async () => {
    const jar = installGeckoCookieMock();
    when(global.browser.tabs.query)
      .calledWith(expect.any(Object))
      .mockResolvedValue([
        {
          cookieStoreId: "firefox-default",
          incognito: false,
          url: "https://alice.github.io/blog",
        },
      ] as never);
    jar.seed(
      fxCookie({ domain: "alice.github.io", name: "keepme" }),
      fxCookie({ domain: "mallory.github.io", name: "cleanme" })
    );
    await runCleanup();
    // Pre-fix: extractMainDomain said github.io for both, so the open
    // alice tab protected every *.github.io site's cookies.
    expect(jar.cookies.map((c) => c.name)).toEqual(["keepme"]);
  });
});
