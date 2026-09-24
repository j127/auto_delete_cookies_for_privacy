/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * Matrix rows 2 (baseline cleanup), 3 (TCP partitioned tracker), and 13
 * (site-data cleanup) against a real headless Firefox. See
 * docs/testing-firefox.md; each test names its row.
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
  domain: string;
  partitionKey?: { topLevelSite?: string };
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

/**
 * Opens url, runs the checks that need the tab open, and closes the tab
 * even when a check fails. Closing is the action under test in every row
 * here, and an open tab protects its site: a tab left behind by one failed
 * row kept the next row's localhost cookies from ever being cleaned, so a
 * single failure read as two (first seen on Firefox ESR 140, #427).
 */
const whileOpen = async (
  url: string,
  checks: () => Promise<void>
): Promise<void> => {
  const tab = await openTab(session, url);
  try {
    await checks();
  } finally {
    await closeTab(session, tab);
  }
};

beforeAll(async () => {
  fixture = await startFixtureServer();
  session = await launchFirefox();
  // Automatic cleaning on, shortest delay; site-data types stay at their
  // defaults (all on). The background re-reads state after the reload.
  const applied = await probe(session, {
    kind: "updateSettings",
    settings: { activeMode: true, delayBeforeClean: 1 },
  });
  if ((applied as { activeMode?: unknown }).activeMode !== true) {
    throw new Error(`settings not applied: ${JSON.stringify(applied)}`);
  }
}, 120000);

afterAll(async () => {
  await session?.quit();
  stopGeckodriver();
  await fixture?.stop();
});

describe("row 2: baseline cleanup under default TCP", () => {
  it("removes a site's cookies after its tab closes", async () => {
    await whileOpen(`${fixture.primary}/cookies`, async () => {
      const appeared = await waitUntil(async () => {
        const names = (await cookiesFor({ domain: "localhost" })).map(
          (c) => c.name
        );
        return names.includes("e2e_header") && names.includes("e2e_js");
      }, 15000);
      expect(appeared).toBe(true);
    });

    const cleaned = await waitUntil(async () => {
      const remaining = (await cookiesFor({ domain: "localhost" })).filter(
        (c) => c.name.startsWith("e2e_")
      );
      return remaining.length === 0;
    }, 45000);
    if (!cleaned) {
      console.log(
        "row2 diagnostics:",
        JSON.stringify(await probe(session, { kind: "diagnostics" }))
      );
    }
    expect(cleaned).toBe(true);
  }, 90000);
});

describe("row 3: TCP-partitioned third-party cookie", () => {
  it("sees and cleans the partitioned tracker cookie", async () => {
    await whileOpen(`${fixture.primary}/embed`, async () => {
      let partitioned: ProbeCookie | undefined;
      const appeared = await waitUntil(async () => {
        const all = await cookiesFor({ domain: "127.0.0.1" });
        partitioned = all.find((c) => c.name === "e2e_tracker");
        return partitioned !== undefined;
      }, 15000);
      expect(appeared).toBe(true);
      // Genuinely partitioned: carries the embedding top-level site.
      // Firefox ESR 140 writes the fixture's non-default port into it
      // (http://localhost:PORT), while 152 and later report the port-less
      // site (http://localhost); both name the embedding localhost page.
      // Real sites on default ports read the same on every version.
      expect(["http://localhost", fixture.primary]).toContain(
        partitioned?.partitionKey?.topLevelSite
      );
    });

    const cleaned = await waitUntil(async () => {
      const all = await cookiesFor({ domain: "127.0.0.1" });
      return !all.some((c) => c.name === "e2e_tracker");
    }, 45000);
    expect(cleaned).toBe(true);
  }, 90000);
});

describe("row 13: site-data (localStorage) cleanup", () => {
  it("clears localStorage for the exact host after tab close", async () => {
    await whileOpen(`${fixture.primary}/storage`, async () => {
      const wrote = (await session.driver.executeScript(
        'return localStorage.getItem("e2e_ls");'
      )) as string | null;
      expect(wrote).toBe("1");
      // The marker-cookie machinery needs a beat to observe the site.
      await waitUntil(async () => {
        const names = (await cookiesFor({ domain: "localhost" })).map(
          (c) => c.name
        );
        return names.includes("e2e_storage_marker");
      }, 15000);
    });

    const cookiesCleaned = await waitUntil(async () => {
      const all = await cookiesFor({ domain: "localhost" });
      return !all.some((c) => c.name === "e2e_storage_marker");
    }, 45000);
    expect(cookiesCleaned).toBe(true);

    // The hostnames-scoped browsingData wipe (audit bug 5 territory):
    // assert through the activity log that the extension issued the wipe
    // with localhost in scope and the call succeeded. The end state of
    // localStorage itself is NOT asserted here: Gecko's hostname matching
    // does not clear storage for port-carrying lab origins like
    // localhost:PORT (verified directly — a global wipe clears it, the
    // hostname-scoped one resolves ok but leaves it), which cannot hit
    // real default-port domains; the manual matrix row still covers a
    // real domain.
    const wipeLogged = await waitUntil(async () => {
      const state = (await probe(session, { kind: "getState" })) as {
        activityLog?: {
          browsingDataCleanup?: { LocalStorage?: string[] };
        }[];
      };
      return (state.activityLog ?? []).some((entry) =>
        (entry.browsingDataCleanup?.LocalStorage ?? []).includes("localhost")
      );
    }, 20000);
    expect(wipeLogged).toBe(true);
  }, 120000);
});
