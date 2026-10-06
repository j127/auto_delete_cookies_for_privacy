/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * THROWAWAY DIAGNOSTIC, never merged: a manual matrix row 13 check on a
 * real site left one cookie behind after cleanup. This visits real sites,
 * closes the tab, and prints every cookie that remains (name, domain,
 * partition, store) plus the activity log entry, so the leftover can be
 * identified. It always passes; read the DIAG lines in the job log.
 */
import { afterAll, beforeAll, describe, it } from "vitest";
import {
  closeTab,
  FirefoxSession,
  launchFirefox,
  openTab,
  probe,
  stopGeckodriver,
} from "../helpers/firefox_driver";

interface ProbeCookie {
  name: string;
  domain: string;
  path?: string;
  storeId?: string;
  partitionKey?: { topLevelSite?: string };
  firstPartyDomain?: string;
  expirationDate?: number;
  session?: boolean;
}

let session: FirefoxSession;

const cookiesFor = async (domain: string): Promise<ProbeCookie[]> =>
  (await probe(session, {
    kind: "getAllCookies",
    details: { domain, firstPartyDomain: null, partitionKey: {} },
  })) as ProbeCookie[];

const describeCookie = (c: ProbeCookie) => ({
  name: c.name,
  domain: c.domain,
  path: c.path,
  storeId: c.storeId,
  partition: c.partitionKey?.topLevelSite ?? null,
  session: c.session,
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeAll(async () => {
  session = await launchFirefox();
  await probe(session, {
    kind: "updateSettings",
    settings: { activeMode: true, delayBeforeClean: 1 },
  });
}, 120000);

afterAll(async () => {
  await session?.quit();
  stopGeckodriver();
});

describe("DIAG: real-site leftovers after cleanup", () => {
  for (const [site, domain] of [
    ["https://www.nytimes.com/", "nytimes.com"],
    ["https://www.theguardian.com/international", "theguardian.com"],
  ] as const) {
    it(`reports what stays on ${domain}`, async () => {
      const tab = await openTab(session, site);
      await sleep(12000);
      const before = await cookiesFor(domain);
      console.log(
        "DIAG",
        domain,
        "before-close",
        JSON.stringify({
          count: before.length,
          names: before.map((c) => c.name),
        })
      );
      await closeTab(session, tab);
      for (const wait of [15000, 30000, 60000]) {
        await sleep(
          wait === 15000 ? 15000 : wait - (wait === 30000 ? 15000 : 30000)
        );
        const after = await cookiesFor(domain);
        console.log(
          "DIAG",
          domain,
          `after-close+${wait / 1000}s`,
          JSON.stringify({
            count: after.length,
            cookies: after.map(describeCookie),
          })
        );
      }
      const state = (await probe(session, { kind: "getState" })) as {
        activityLog?: unknown[];
      };
      const entries = (state.activityLog ?? []).filter((e) =>
        JSON.stringify(e).includes(domain.split(".")[0])
      );
      console.log(
        "DIAG",
        domain,
        "activity",
        JSON.stringify(entries).slice(0, 4000)
      );
    }, 240000);
  }
});
