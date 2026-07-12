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
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  closeTab,
  FirefoxSession,
  launchFirefox,
  openTab,
  probe,
  stopGeckodriver,
  waitUntil,
} from "../helpers/firefox_driver";
import { FixtureServer, startFixtureServer } from "../helpers/fixture_server";

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
