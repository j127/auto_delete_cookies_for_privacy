/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * Issue #603, on Firefox. Keep rules treat www.example.com and example.com
 * as one site, and a rule for example.com leaves mail.example.com out. Two
 * things in the site-data cleanup did not follow that:
 *
 * - Firefox clears storage by exact hostname, so a wipe for a host also
 *   names the registrable domain and its www host (prepareCleanupHostnames).
 *   Only the cleaned host's own rule was checked, so an exact rule for
 *   youtube.com lost YouTube's storage whenever m.youtube.com was cleaned.
 * - The guard for wipes that reach every container matched the raw host.
 *   A youtube.com rule in one container did not stop a wipe of
 *   www.youtube.com's service workers started from another container.
 *
 * These specs run cleanup against the Gecko-semantics cookie jar.
 */
import { when } from "jest-when";
import { installGeckoCookieMock } from "../gecko-flavor";

vi.stubGlobal("__BROWSER__", "firefox");
vi.resetModules();
const { initialState } = await import("@/redux/state");
const { cleanCookiesOperation, isDomainProtectedInStore } =
  await import("@/services/cleanup-service");
const { ADCPCOOKIENAME } = await import("@/services/libs");
const { ListType, SiteDataType } = await import("@/typings/enums");

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

/** The marker cookie a visit to host leaves (TabEvents). */
const marker = (host: string, storeId = "firefox-default") =>
  fxCookie({
    domain: host,
    name: ADCPCOOKIENAME,
    path: `/${host}`,
    storeId,
    value: ADCPCOOKIENAME,
  });

const keep = (
  expression: string,
  extra: Partial<Expression> = {},
  storeId = "default"
): Expression => ({
  expression,
  id: expression,
  listType: ListType.WHITE,
  storeId,
  ...extra,
});

const withRules = (lists: State["lists"], containers = false): State => ({
  ...initialState,
  lists,
  settings: {
    ...initialState.settings,
    contextualIdentities: { name: "contextualIdentities", value: containers },
  },
});

const run = (state: State) =>
  cleanCookiesOperation(state, { greyCleanup: false, ignoreOpenTabs: false });

/** Each removal of this run as "type@store: hostnames". */
const removals = (): string[] =>
  global.browser.browsingData.remove.mock.calls.map((call: unknown[]) => {
    const [scope, types] = call as [
      { hostnames?: string[]; cookieStoreId?: string },
      Record<string, boolean>,
    ];
    return `${Object.keys(types).join("+")}@${scope.cookieStoreId ?? "every store"}: ${(scope.hostnames ?? []).join(" ")}`;
  });

describe("keep rules and www. hosts in Firefox site-data cleanup (#603)", () => {
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

  describe("a wipe for a subdomain no rule covers", () => {
    it("leaves out the site's own hosts when an exact rule keeps them", async () => {
      const jar = installGeckoCookieMock();
      jar.seed(
        fxCookie({ domain: ".youtube.com", hostOnly: false, name: "SID" }),
        marker("www.youtube.com"),
        marker("m.youtube.com")
      );
      await run(withRules({ default: [keep("youtube.com")] }));
      // The kept site keeps its session cookie and its storage.
      expect(jar.cookies.map((c) => `${c.domain} ${c.name}`)).toEqual([
        ".youtube.com SID",
      ]);
      expect(removals()).toEqual([
        "indexedDB@firefox-default: m.youtube.com",
        "localStorage@firefox-default: m.youtube.com",
        "pluginData@every store: m.youtube.com",
        "serviceWorkers@every store: m.youtube.com",
      ]);
    });

    it("still names the site's own hosts when no rule keeps them", async () => {
      const jar = installGeckoCookieMock();
      jar.seed(marker("m.youtube.com"));
      await run(withRules({ default: [] }));
      expect(removals()).toContain(
        "localStorage@firefox-default: m.youtube.com youtube.com www.youtube.com"
      );
    });

    it("names them for the types the rule marks for cleaning", async () => {
      const jar = installGeckoCookieMock();
      jar.seed(marker("m.youtube.com"));
      await run(
        withRules({
          default: [
            keep("youtube.com", { cleanSiteData: [SiteDataType.LOCALSTORAGE] }),
          ],
        })
      );
      expect(removals()).toEqual([
        "indexedDB@firefox-default: m.youtube.com",
        "localStorage@firefox-default: m.youtube.com youtube.com www.youtube.com",
        "pluginData@every store: m.youtube.com",
        "serviceWorkers@every store: m.youtube.com",
      ]);
    });

    it("leaves them out when the rule was typed with www.", async () => {
      const jar = installGeckoCookieMock();
      jar.seed(marker("m.youtube.com"));
      await run(withRules({ default: [keep("www.youtube.com")] }));
      expect(removals()).toContain(
        "localStorage@firefox-default: m.youtube.com"
      );
    });
  });

  describe("a container's rule for the bare domain", () => {
    beforeEach(() => {
      when(global.browser.contextualIdentities.query)
        .calledWith(expect.any(Object))
        .mockResolvedValue([
          { cookieStoreId: "firefox-container-9", name: "Video" },
        ] as never);
    });

    it("keeps www storage that no container can be singled out for", async () => {
      const jar = installGeckoCookieMock();
      // www.youtube.com was used outside the container that keeps YouTube.
      jar.seed(marker("www.youtube.com"));
      await run(
        withRules(
          {
            "firefox-container-9": [
              keep("youtube.com", {}, "firefox-container-9"),
            ],
          },
          true
        )
      );
      // localStorage and IndexedDB can be limited to the default store, so
      // they go there; service workers and plugin data reach every
      // container, so the container's rule keeps them.
      expect(removals()).toEqual([
        "indexedDB@firefox-default: www.youtube.com youtube.com",
        "localStorage@firefox-default: www.youtube.com youtube.com",
      ]);
    });
  });

  describe("isDomainProtectedInStore()", () => {
    it("protects the www host with a rule for the bare domain", () => {
      const state = withRules({ default: [keep("youtube.com")] });
      for (const host of ["www.youtube.com", ".www.youtube.com"]) {
        expect(
          isDomainProtectedInStore(
            state,
            "firefox-default",
            {},
            host,
            SiteDataType.INDEXEDDB
          )
        ).toBe(true);
      }
      expect(
        isDomainProtectedInStore(
          state,
          "firefox-default",
          {},
          "m.youtube.com",
          SiteDataType.INDEXEDDB
        )
      ).toBe(false);
    });
  });
});
