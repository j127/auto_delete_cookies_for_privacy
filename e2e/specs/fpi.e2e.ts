/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * Matrix row 5: First-Party Isolation profile. The upstream headline bug
 * (audit bugs 1/3) was cleanup silently doing nothing under FPI for
 * years; this suite runs a real Firefox with
 * privacy.firstparty.isolate=true and proves enumeration, cleanup, and
 * the FPI-aware marker cookie all work.
 *
 * Matrix row 6 (FPI leftovers) runs last in the same session: cookies
 * isolated while FPI was on must still be cleaned once it is off.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  closeTab,
  FirefoxSession,
  inProbe,
  launchFirefox,
  openTab,
  probe,
  readBoolPref,
  setBoolPref,
  stopGeckodriver,
  waitUntil,
} from "../helpers/firefox_driver";
import { FixtureServer, startFixtureServer } from "../helpers/fixture_server";

/**
 * FPI_SESSION_KEY in src/services/first-party-isolation.ts. Not imported:
 * that module pulls in browser-capabilities, which reads the build-time
 * __BROWSER__ define as soon as it loads.
 */
const FPI_SESSION_KEY = "fpiEnabled";

interface ProbeCookie {
  name: string;
  firstPartyDomain?: string;
}

let session: FirefoxSession;
let fixture: FixtureServer;

const cookiesFor = async (
  details: Record<string, unknown>
): Promise<ProbeCookie[]> =>
  (await probe(session, {
    kind: "getAllCookies",
    details: { firstPartyDomain: null, partitionKey: {}, ...details },
  })) as ProbeCookie[];

beforeAll(async () => {
  fixture = await startFixtureServer();
  session = await launchFirefox({ "privacy.firstparty.isolate": true });
  const applied = await probe(session, {
    kind: "updateSettings",
    settings: { activeMode: true, delayBeforeClean: 1 },
  });
  if ((applied as { activeMode?: unknown }).activeMode !== true) {
    throw new Error(`settings not applied: ${JSON.stringify(applied)}`);
  }
}, 180000);

afterAll(async () => {
  await session?.quit();
  stopGeckodriver();
  await fixture?.stop();
});

describe("row 5: cleanup under First-Party Isolation", () => {
  it("enumerates and cleans FPI-isolated cookies", async () => {
    const tab = await openTab(session, `${fixture.primary}/cookies`);
    let isolated: ProbeCookie | undefined;
    const appeared = await waitUntil(async () => {
      const all = await cookiesFor({ domain: "localhost" });
      isolated = all.find((c) => c.name === "e2e_header");
      return isolated !== undefined;
    }, 15000);
    expect(appeared).toBe(true);
    // Genuinely isolated: the cookie carries its first-party domain.
    expect(isolated?.firstPartyDomain).toBe("localhost");

    await closeTab(session, tab);
    const cleaned = await waitUntil(async () => {
      const all = await cookiesFor({ domain: "localhost" });
      return !all.some((c) => c.name.startsWith("e2e_"));
    }, 45000);
    if (!cleaned) {
      console.log(
        "fpi diagnostics:",
        JSON.stringify(await probe(session, { kind: "diagnostics" }))
      );
    }
    expect(cleaned).toBe(true);
  }, 90000);

  it("sets the marker cookie with an FPI first-party domain", async () => {
    // A site that sets NO cookies triggers the marker (site-data types
    // are on by default); under FPI the set must carry a firstPartyDomain
    // or Gecko rejects it.
    const tab = await openTab(session, `${fixture.primary}/`);
    let marker: ProbeCookie | undefined;
    const appeared = await waitUntil(async () => {
      const all = await cookiesFor({ domain: "localhost" });
      marker = all.find((c) => c.name === "ADCPBrowsingDataCleanup");
      return marker !== undefined;
    }, 20000);
    if (!appeared) {
      console.log(
        "marker diagnostics:",
        JSON.stringify({
          cookies: await cookiesFor({}),
          diag: await probe(session, { kind: "diagnostics" }),
          fpiCache: await probe(session, { kind: "getSessionStorage" }),
        })
      );
    }
    expect(appeared).toBe(true);
    expect(marker?.firstPartyDomain).toBe("localhost");
    await closeTab(session, tab);
  }, 60000);
});

// Last in the file: it switches FPI off for the rest of the session.
describe("row 6: FPI leftovers after FPI is switched off", () => {
  it("still cleans cookies isolated while FPI was on", async () => {
    const tab = await openTab(session, `${fixture.primary}/cookies`);
    try {
      let isolated: ProbeCookie | undefined;
      const appeared = await waitUntil(async () => {
        const all = await cookiesFor({ domain: "localhost" });
        isolated = all.find((c) => c.name === "e2e_header");
        return isolated !== undefined;
      }, 15000);
      expect(appeared).toBe(true);
      expect(isolated?.firstPartyDomain).toBe("localhost");

      // The matrix row switches FPI off and restarts. The pref switches
      // here at runtime; the restart stays manual (webdriver's profile does
      // not survive one). What the restart does for the extension is clear
      // its per-session FPI detection, so drop that cached answer too: the
      // next check then probes Firefox and finds FPI off.
      await setBoolPref(session, "privacy.firstparty.isolate", false);
      expect(await readBoolPref(session, "privacy.firstparty.isolate")).toBe(
        false
      );
      await inProbe(
        session,
        "await browser.storage.session.remove(args[0]);",
        FPI_SESSION_KEY
      );
      // Switching the pref leaves existing cookies as they were: these
      // still carry the first-party domain they were isolated under.
      const leftovers = (await cookiesFor({ domain: "localhost" })).filter(
        (c) => c.name.startsWith("e2e_")
      );
      expect(leftovers.length).toBeGreaterThan(0);
      expect(leftovers.every((c) => c.firstPartyDomain === "localhost")).toBe(
        true
      );
    } finally {
      await closeTab(session, tab);
    }

    const cleaned = await waitUntil(async () => {
      const all = await cookiesFor({ domain: "localhost" });
      return !all.some((c) => c.name.startsWith("e2e_"));
    }, 45000);
    if (!cleaned) {
      console.log(
        "row6 diagnostics:",
        JSON.stringify({
          cookies: await cookiesFor({ domain: "localhost" }),
          diag: await probe(session, { kind: "diagnostics" }),
        })
      );
    }
    expect(cleaned).toBe(true);
  }, 90000);
});
