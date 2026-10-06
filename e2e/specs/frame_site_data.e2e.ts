/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * Matrix row 21: storage a site keeps in a same-site frame is cleaned with
 * the site (issue #464). Sites like eBay keep their cookies on the parent
 * domain and run sign-in and device-check frames on subdomains whose
 * storage owns no cookie, so it never entered a cleanup's scope. The
 * extension now gives every same-site frame host a marker cookie as it
 * loads (webRequest), and cleanup handles that host like any other.
 *
 * The session resolves two .test hostnames to the fixture server through
 * network.dns.localDomains: www.adcp.test serves a page with a Domain
 * cookie on adcp.test, a devicebind.adcp.test frame that writes
 * localStorage, and a cross-site 127.0.0.1 frame. As in row 13, the
 * storage end state is not asserted: Gecko's hostname-scoped wipe leaves
 * port-carrying origins alone, which real sites never are. The spec checks
 * the marker cookies and the cleanup log, which records the hosts whose
 * storage the extension asked Firefox to clear.
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
import {
  FixtureServer,
  FRAME_SITE_HOSTS,
  startFixtureServer,
} from "../helpers/fixture_server";

const MARKER = "ADCPBrowsingDataCleanup";

interface ProbeCookie {
  name: string;
  domain: string;
}

let session: FirefoxSession;
let fixture: FixtureServer;

const cookiesFor = async (domain: string): Promise<ProbeCookie[]> =>
  (await probe(session, {
    kind: "getAllCookies",
    details: { firstPartyDomain: null, partitionKey: {}, domain },
  })) as ProbeCookie[];

/** Whether host holds a marker cookie of its own (not a subdomain's). */
const hasMarker = async (host: string): Promise<boolean> =>
  (await cookiesFor(host)).some(
    (c) => c.name === MARKER && c.domain.replace(/^\./, "") === host
  );

beforeAll(async () => {
  fixture = await startFixtureServer();
  session = await launchFirefox({
    "network.dns.localDomains": Object.values(FRAME_SITE_HOSTS).join(","),
    // The fixture speaks plain http on a high port; don't let HTTPS-First
    // try TLS on it first.
    "dom.security.https_first": false,
    "dom.security.https_first_schemeless": false,
  });
  const applied = (await probe(session, {
    kind: "updateSettings",
    settings: { activeMode: true, delayBeforeClean: 1, statLogging: true },
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

describe("row 21: same-site frame site data", () => {
  it("marks the same-site frame host, not the cross-site one, and cleans it after the tab closes", async () => {
    const page = `http://${FRAME_SITE_HOSTS.page}:${fixture.port}/site-frame`;
    const tab = await openTab(session, page);
    try {
      // The site's own cookie sits on the parent domain, as on eBay.
      const siteCookie = await waitUntil(
        async () =>
          (await cookiesFor("adcp.test")).some((c) => c.name === "e2e_site"),
        15000
      );
      expect(siteCookie).toBe(true);
      const frameMarked = await waitUntil(
        () => hasMarker(FRAME_SITE_HOSTS.frame),
        15000
      );
      if (!frameMarked) {
        // eslint-disable-next-line no-console
        console.log(
          "row 21 cookies:",
          JSON.stringify(await cookiesFor("adcp.test"))
        );
      }
      expect(frameMarked).toBe(true);
      // The cross-site frame's storage is partitioned under the page's
      // site; it never gets a marker of its own.
      expect(await hasMarker("127.0.0.1")).toBe(false);
    } finally {
      await closeTab(session, tab);
    }

    const markerCleaned = await waitUntil(
      async () => !(await hasMarker(FRAME_SITE_HOSTS.frame)),
      45000
    );
    expect(markerCleaned).toBe(true);

    const frameWipeLogged = await waitUntil(async () => {
      const state = (await probe(session, { kind: "getState" })) as {
        activityLog?: {
          browsingDataCleanup?: { LocalStorage?: string[] };
        }[];
      };
      return (state.activityLog ?? []).some((entry) =>
        (entry.browsingDataCleanup?.LocalStorage ?? []).includes(
          FRAME_SITE_HOSTS.frame
        )
      );
    }, 20000);
    expect(frameWipeLogged).toBe(true);
  }, 120000);
});
