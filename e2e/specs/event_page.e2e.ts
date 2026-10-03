/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * Matrix row 16: the event page restarting mid-session. Firefox stops an
 * idle event page after about 30 seconds and starts it again on the next
 * event; everything the background keeps in memory is gone by then, so
 * pending cleanups, the tab-to-domain map and the container names live in
 * storage.session and are read back on every start. Each case stops the
 * background the way about:debugging's "Terminate background script"
 * does (Extension.terminateBackground in chrome context), checks that a
 * new background document took over, and then uses the extension again.
 * Waiting out the real idle timeout stays a manual variant of the row.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  closeTab,
  FirefoxSession,
  inChrome,
  inProbe,
  launchFirefox,
  openTab,
  probe,
  setBoolPref,
  stopGeckodriver,
  waitUntil,
} from "../helpers/firefox_driver";
import { FixtureServer, startFixtureServer } from "../helpers/fixture_server";
import { FIREFOX_ADDON_ID } from "../../scripts/firefox_manifest";

interface ProbeCookie {
  name: string;
}

let session: FirefoxSession;
let fixture: FixtureServer;

const cookieNames = async (domain: string): Promise<string[]> =>
  (
    (await probe(session, {
      kind: "getAllCookies",
      details: { firstPartyDomain: null, partitionKey: {}, domain },
    })) as ProbeCookie[]
  ).map((c) => c.name);

const hasFixtureCookies = async (domain: string): Promise<boolean> => {
  const names = await cookieNames(domain);
  return names.includes("e2e_header") && names.includes("e2e_js");
};

const hasNoFixtureCookies = async (domain: string): Promise<boolean> =>
  !(await cookieNames(domain)).some((n) => n.startsWith("e2e_"));

const applySettings = async (
  settings: Record<string, unknown>
): Promise<void> => {
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

const sessionStorage = async (): Promise<Record<string, unknown>> =>
  (await probe(session, { kind: "getSessionStorage" })) as Record<
    string,
    unknown
  >;

/**
 * Identifies the running background document. Asking for it also wakes a
 * stopped background, like any other use of the extension.
 */
const backgroundOrigin = async (): Promise<number> =>
  (await inProbe(
    session,
    `const bg = await browser.runtime.getBackgroundPage();
     return bg.performance.timeOrigin;`
  )) as number;

/**
 * Stops the background as about:debugging does and returns once a new
 * background document is running. Fails if the stop did not take.
 */
const restartBackground = async (): Promise<void> => {
  const before = await backgroundOrigin();
  const stateAfterStop = await inChrome(
    session,
    `const extension = WebExtensionPolicy.getByID(args[0]).extension;
     await extension.terminateBackground();
     return extension.backgroundState;`,
    FIREFOX_ADDON_ID
  );
  expect(stateAfterStop).toBe("stopped");
  let after = before;
  const restarted = await waitUntil(async () => {
    after = await backgroundOrigin();
    return after !== before;
  }, 15000);
  expect(restarted, "a new background document started").toBe(true);
};

/**
 * The container names the background keeps for the popup's site card, by
 * cookie store id.
 */
const cachedContainerNames = async (): Promise<Record<string, string>> => {
  const cache = ((await sessionStorage()).containerCache ?? {}) as Record<
    string,
    { name?: string }
  >;
  return Object.fromEntries(
    Object.entries(cache).map(([id, info]) => [id, info.name ?? ""])
  );
};

beforeAll(async () => {
  fixture = await startFixtureServer();
  session = await launchFirefox();
  await applySettings({ activeMode: true, delayBeforeClean: 1 });
}, 120000);

afterAll(async () => {
  await session?.quit();
  stopGeckodriver();
  await fixture?.stop();
});

describe("row 16: event page restart", () => {
  it("runs a cleanup that was pending when the background stopped", async () => {
    // Long enough to stop the background before the cleanup is due.
    await applySettings({ delayBeforeClean: 8 });
    try {
      const tab = await openTab(session, `${fixture.primary}/cookies`);
      try {
        expect(
          await waitUntil(() => hasFixtureCookies("localhost"), 15000)
        ).toBe(true);
      } finally {
        await closeTab(session, tab);
      }
      const scheduled = await waitUntil(
        async () => (await sessionStorage()).pendingCleanup !== undefined,
        10000
      );
      expect(scheduled).toBe(true);

      // The in-memory timer dies with the background; only the stored
      // pending cleanup can bring the cleanup back.
      await restartBackground();
      expect(await hasFixtureCookies("localhost")).toBe(true);

      const cleaned = await waitUntil(
        () => hasNoFixtureCookies("localhost"),
        45000
      );
      if (!cleaned) {
        console.log(
          "row16 pending diagnostics:",
          JSON.stringify(await probe(session, { kind: "diagnostics" }))
        );
      }
      expect(cleaned).toBe(true);
    } finally {
      await applySettings({ delayBeforeClean: 1 });
    }
  }, 120000);

  it("keeps tracking a tab's domain across the restart", async () => {
    await applySettings({ domainChangeCleanup: true });
    const tab = await openTab(session, `${fixture.primary}/cookies`);
    try {
      expect(await waitUntil(() => hasFixtureCookies("localhost"), 15000)).toBe(
        true
      );
      const tracked = await waitUntil(async () => {
        const map = ((await sessionStorage()).tabToDomain ?? {}) as Record<
          string,
          string
        >;
        return Object.values(map).some((domain) => domain === "localhost");
      }, 10000);
      expect(tracked).toBe(true);

      await restartBackground();

      // The same tab moves to another site. Only a background that still
      // knows the tab was on localhost sees a domain change and cleans.
      const { driver } = session;
      await driver.switchTo().window(tab);
      await driver.get(`${fixture.thirdParty}/`);
      const cleaned = await waitUntil(
        () => hasNoFixtureCookies("localhost"),
        45000
      );
      if (!cleaned) {
        console.log(
          "row16 tab diagnostics:",
          JSON.stringify({
            session: await sessionStorage(),
            diag: await probe(session, { kind: "diagnostics" }),
          })
        );
      }
      expect(cleaned).toBe(true);
    } finally {
      await closeTab(session, tab);
      await applySettings({ domainChangeCleanup: false });
    }
  }, 120000);

  it("keeps the container names when containers cannot be queried after the restart", async () => {
    // The names the background holds before the restart: Firefox's stock
    // containers (Personal, Work, Banking, Shopping) in a fresh profile.
    const known = await cachedContainerNames();
    expect(Object.keys(known).length).toBeGreaterThan(0);

    // With containers switched off the restarted background's live query
    // rejects, so the names it holds can only come from storage.session.
    await setBoolPref(session, "privacy.userContext.enabled", false);
    try {
      await restartBackground();
      const query = (await probe(session, { kind: "queryContainers" })) as {
        error?: string;
      };
      expect(query.error).toBeDefined();
    } finally {
      await setBoolPref(session, "privacy.userContext.enabled", true);
    }

    // A new container makes the background write its whole in-memory name
    // cache back to storage.session, so the stored copy now shows what the
    // restarted background really held. (Switching containers back on can
    // make Firefox reuse a store id, so the new container's id is left out
    // of the comparison.)
    const name = "ADCP e2e after restart";
    const created = (await probe(session, {
      kind: "createContainer",
      name,
    })) as { cookieStoreId?: string; error?: string };
    if (!created.cookieStoreId) {
      throw new Error(`container not created: ${created.error}`);
    }
    const newId = created.cookieStoreId;
    const expected = Object.fromEntries(
      Object.entries(known).filter(([id]) => id !== newId)
    );
    expect(Object.keys(expected).length).toBeGreaterThan(0);
    let names: Record<string, string> = {};
    const kept = await waitUntil(async () => {
      names = await cachedContainerNames();
      return (
        names[newId] === name &&
        Object.entries(expected).every(([id, n]) => names[id] === n)
      );
    }, 10000);
    if (!kept) {
      console.log(
        "row16 container names:",
        JSON.stringify({ known, newId, names })
      );
    }
    expect(kept).toBe(true);
  }, 120000);
});
