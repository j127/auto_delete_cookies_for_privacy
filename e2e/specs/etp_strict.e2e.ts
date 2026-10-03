/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * Matrix row 4: Enhanced Tracking Protection set to Strict. The session
 * launches with browser.contentblocking.category=strict, the pref the
 * Strict radio button in about:preferences writes; Firefox then applies
 * the prefs that category implies at startup (tracking protection in
 * every window, fingerprinting protection, and so on), and the spec checks
 * that it did before repeating row 2.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  closeTab,
  FirefoxSession,
  launchFirefox,
  openTab,
  probe,
  readBoolPref,
  stopGeckodriver,
  waitUntil,
} from "../helpers/firefox_driver";
import { FixtureServer, startFixtureServer } from "../helpers/fixture_server";

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

beforeAll(async () => {
  fixture = await startFixtureServer();
  session = await launchFirefox({
    "browser.contentblocking.category": "strict",
  });
  // Standard leaves tracking protection to private windows; Strict turns
  // it on everywhere. If Firefox did not apply the category, this row would
  // silently rerun row 2 under Standard.
  if (
    (await readBoolPref(session, "privacy.trackingprotection.enabled")) !== true
  ) {
    throw new Error("ETP Strict was not applied at startup");
  }
  const applied = (await probe(session, {
    kind: "updateSettings",
    settings: { activeMode: true, delayBeforeClean: 1 },
  })) as { activeMode?: unknown };
  if (applied.activeMode !== true) {
    throw new Error(`settings not applied: ${JSON.stringify(applied)}`);
  }
}, 120000);

afterAll(async () => {
  await session?.quit();
  stopGeckodriver();
  await fixture?.stop();
});

describe("row 4: cleanup under ETP Strict", () => {
  it("removes a site's cookies after its tab closes", async () => {
    const tab = await openTab(session, `${fixture.primary}/cookies`);
    try {
      const appeared = await waitUntil(async () => {
        const names = await cookieNames("localhost");
        return names.includes("e2e_header") && names.includes("e2e_js");
      }, 15000);
      expect(appeared).toBe(true);
    } finally {
      await closeTab(session, tab);
    }

    const cleaned = await waitUntil(
      async () =>
        !(await cookieNames("localhost")).some((n) => n.startsWith("e2e_")),
      45000
    );
    if (!cleaned) {
      console.log(
        "row4 diagnostics:",
        JSON.stringify(await probe(session, { kind: "diagnostics" }))
      );
    }
    expect(cleaned).toBe(true);
  }, 90000);
});
