/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * Fixture server for the Chromium e2e suite (#473). One node http server
 * on 127.0.0.1 answers for every hostname of the sites below; Chrome
 * reaches it through --host-resolver-rules, so the browser sees port-less
 * origins such as http://www.adcp.test. That matters: storage on an
 * origin with a port is not what real sites have, and Gecko's
 * hostname-scoped wipe leaves such origins alone, which is why the
 * Firefox rows 13 and 21 cannot assert the storage end state.
 *
 * Every page writes the same three kinds of storage, so a check can tell
 * which kind a cleanup missed: a localStorage entry, an IndexedDB
 * database, and a Cache Storage cache. A page whose writes fail (no
 * secure context, so no caches API) says so in its title instead of
 * passing for clean.
 *
 * Routes, on any host:
 * - /site   a site's top-level page: sets a cookie on the parent domain
 *           (as eBay does), writes storage, and embeds a same-site frame
 *           from the devicebind. host of the same site. Its title turns
 *           "ready" once its own writes and the frame's are done.
 * - /frame  the frame body: writes storage, then tells its parent.
 * - /tab    a top-level page on its own subdomain that sets no cookie,
 *           like a sign-in page: writes storage only.
 * - /plain  a plain-text page that writes nothing, for reading an
 *           origin's storage back.
 * - /late   a top-level page that sets the site cookie and, as it loads,
 *           sends a keepalive request to /held: a request still in
 *           flight when its tab closes, like eBay's.
 * - /held   answered only when the spec calls releaseHeld(), with a
 *           cookie on the parent domain: the late cookie a response sets
 *           after the cleanup that followed the tab's close.
 * (Plain node http, not Bun.serve: the e2e specs run under vitest's node
 * runtime.)
 */

import { createServer, IncomingMessage, ServerResponse } from "http";
import { AddressInfo } from "net";

/** The site whose cleanup the suite checks. */
export const SITE = "adcp.test";

/** Hostnames of SITE the suite opens. */
export const SITE_HOSTS = {
  /** The top-level page the user visits. */
  page: `www.${SITE}`,
  /** Its same-site frame (#464's device-check frame). */
  frame: `devicebind.${SITE}`,
  /** A separate subdomain opened in a tab of its own. */
  tab: `signin.${SITE}`,
};

/**
 * A second site with no keep rule, so a run that keeps SITE still has
 * something to clean and log, which shows the cleanup ran.
 */
export const OTHER_SITE = "unkept.test";

export const OTHER_SITE_HOSTS = {
  page: `www.${OTHER_SITE}`,
  frame: `devicebind.${OTHER_SITE}`,
};

/** The cookie /site sets on its parent domain. */
export const SITE_COOKIE = "adcp_site";

/** The cookie a held /held response sets once released. */
export const LATE_COOKIE = "adcp_late";

/** What each page writes; names a check can look for. */
export const STORAGE_NAMES = {
  localStorage: "adcp-probe",
  indexedDB: "adcp-probe-db",
  cacheStorage: "adcp-probe-cache",
};

/** Every origin the fixture serves pages on. */
export const fixtureOrigins = (): string[] =>
  [...Object.values(SITE_HOSTS), ...Object.values(OTHER_SITE_HOSTS)].map(
    (host) => `http://${host}`
  );

/** Chrome's --host-resolver-rules value that sends both sites to port. */
export const fixtureHostResolverRules = (port: number): string =>
  [SITE, OTHER_SITE].map((site) => `MAP *.${site} 127.0.0.1:${port}`).join(",");

export interface ChromiumFixture {
  port: number;
  /** How many /held requests wait for releaseHeld(). */
  heldCount: () => number;
  /** Answers every waiting /held request, each with LATE_COOKIE. */
  releaseHeld: () => void;
  stop: () => Promise<void>;
}

/** A /held request waiting for releaseHeld(), with the site it came for. */
interface HeldResponse {
  res: ServerResponse;
  site: string;
}

/** The registrable site of a fixture host: its first label dropped. */
const siteOf = (host: string): string => host.split(".").slice(1).join(".");

const STORE_SCRIPT = `
const store = async () => {
  localStorage.setItem(${JSON.stringify(STORAGE_NAMES.localStorage)}, "x".repeat(200));
  await new Promise((resolve, reject) => {
    const open = indexedDB.open(${JSON.stringify(STORAGE_NAMES.indexedDB)}, 1);
    open.onupgradeneeded = () => open.result.createObjectStore("s");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const tx = open.result.transaction("s", "readwrite");
      tx.objectStore("s").put("y".repeat(500), "k");
      tx.oncomplete = () => { open.result.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
  });
  if (!self.caches) throw new Error("no caches API: not a secure context");
  const cache = await caches.open(${JSON.stringify(STORAGE_NAMES.cacheStorage)});
  await cache.put("/adcp-probe", new Response("z".repeat(800)));
};`;

const html = (
  res: ServerResponse,
  body: string,
  extraHeaders: Record<string, string> = {}
): void => {
  res.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    ...extraHeaders,
  });
  res.end(`<!doctype html><meta charset="utf-8"><title>loading</title>${body}`);
};

const handle = (
  req: IncomingMessage,
  res: ServerResponse,
  held: HeldResponse[]
): void => {
  const host = (req.headers.host ?? "").replace(/:\d+$/, "");
  const { pathname } = new URL(req.url ?? "/", "http://fixture");
  switch (pathname) {
    case "/site": {
      const site = siteOf(host);
      html(
        res,
        // The listener is in place before the frame exists, so its
        // message cannot arrive unheard.
        `<h1>${host}</h1>
         <script>${STORE_SCRIPT}
           const frameDone = new Promise((resolve, reject) =>
             addEventListener("message", (e) =>
               e.data === "stored" ? resolve() : reject(new Error(e.data))));
           Promise.all([store(), frameDone]).then(
             () => { document.title = "ready"; },
             (e) => { document.title = "error: " + e; });
         </script>
         <iframe src="http://devicebind.${site}/frame"></iframe>`,
        {
          "set-cookie": `${SITE_COOKIE}=1; Domain=${site}; Path=/; Max-Age=86400`,
        }
      );
      return;
    }
    case "/frame":
      html(
        res,
        `<script>${STORE_SCRIPT}
           store().then(
             () => parent.postMessage("stored", "*"),
             (e) => parent.postMessage("frame error: " + e, "*"));
         </script>`
      );
      return;
    case "/tab":
      html(
        res,
        `<h1>${host}</h1>
         <script>${STORE_SCRIPT}
           store().then(
             () => { document.title = "ready"; },
             (e) => { document.title = "error: " + e; });
         </script>`
      );
      return;
    case "/late": {
      const site = siteOf(host);
      html(
        res,
        // keepalive lets the request outlive the page, as browsers do for
        // beacons and unload-time fetches.
        `<h1>${host}</h1>
         <script>
           fetch("/held", { method: "POST", keepalive: true }).catch(() => {});
           document.title = "ready";
         </script>`,
        {
          "set-cookie": `${SITE_COOKIE}=1; Domain=${site}; Path=/; Max-Age=86400`,
        }
      );
      return;
    }
    case "/held":
      // Drain the (empty) body so the request counts as fully received.
      req.resume();
      held.push({ res, site: siteOf(host) });
      return;
    case "/plain":
      res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
      res.end(`${host}\n`);
      return;
    default:
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("not found\n");
  }
};

export const startChromiumFixture = (): Promise<ChromiumFixture> =>
  new Promise((resolve) => {
    const held: HeldResponse[] = [];
    const server = createServer((req, res) => handle(req, res, held));
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        port,
        heldCount: () => held.length,
        releaseHeld: () => {
          for (const { res, site } of held.splice(0)) {
            res.writeHead(204, {
              "set-cookie": `${LATE_COOKIE}=1; Domain=${site}; Path=/; Max-Age=86400`,
            });
            res.end();
          }
        },
        stop: () =>
          new Promise<void>((done) => {
            server.close(() => done());
            // Keep-alive sockets would otherwise hold close() open.
            server.closeAllConnections?.();
          }),
      });
    });
  });
