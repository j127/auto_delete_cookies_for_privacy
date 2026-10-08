/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * Local two-site fixture server for the Firefox E2E suite. One node http
 * server bound to 0.0.0.0 answers as TWO distinct sites —
 * http://localhost:PORT and http://127.0.0.1:PORT. Different hosts means
 * different registrable "sites" to Gecko, so a 127.0.0.1 iframe inside a
 * localhost page is a genuine cross-site embed and Total Cookie
 * Protection partitions its cookies under the localhost top-level site.
 * No external network. (Plain node http, not Bun.serve: the e2e specs run
 * under vitest's node runtime.)
 *
 * Routes:
 * - /            landing, sets nothing
 * - /cookies     sets a first-party header cookie + a JS cookie
 * - /embed       page embedding an iframe from the OTHER host
 * - /iframe-set  iframe body; sets a JS cookie in the third-party context
 * - /storage     writes localStorage + a cookie (site-data row)
 * - /busy        a "busy site" for the popup-fit row: BUSY_COOKIE_COUNT
 *                header cookies and as many localStorage entries, all
 *                with long names
 * - /site-frame  a page embedding a SAME-site frame from the
 *                devicebind. host of its own site (www. dropped) plus the
 *                cross-site /iframe-set. Needs hostnames that resolve to
 *                this server (FRAME_SITE_HOSTS, see frame_site_data.e2e.ts)
 * - /frame-storage  frame body; writes localStorage and sets no cookie,
 *                like a device-check frame whose site keeps its cookies on
 *                the parent domain
 * - /shop        an ordinary-looking site for the store screenshots
 *                (#486): SHOP_COOKIE_COUNT cookies, two localStorage
 *                entries, an IndexedDB database and, where the page is a
 *                secure context, a cache. The title turns to "ready" once
 *                all of it is written
 */

/** Hostnames /site-frame expects to resolve to this server. */
export const FRAME_SITE_HOSTS = {
  page: "www.adcp.test",
  frame: "devicebind.adcp.test",
};

import { createServer, IncomingMessage, ServerResponse } from "http";
import { AddressInfo } from "net";

export interface FixtureServer {
  port: number;
  primary: string; // http://localhost:PORT — the "site the user visits"
  thirdParty: string; // http://127.0.0.1:PORT — the embedded tracker
  stop: () => Promise<void>;
}

const html = (
  res: ServerResponse,
  body: string,
  extraHeaders: Record<string, string | string[]> = {}
): void => {
  res.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    ...extraHeaders,
  });
  res.end(`<!doctype html><body>${body}</body>`);
};

/** How many cookies /shop sets: three header cookies and one from script. */
export const SHOP_COOKIE_COUNT = 4;

/** How many cookies (and localStorage entries) /busy sets. */
export const BUSY_COOKIE_COUNT = 60;

/**
 * A long, unbroken name: the popup must truncate it or scroll it inside
 * its own list, never widen the page.
 */
const busyName = (prefix: string, i: number): string =>
  `${prefix}_${String(i).padStart(2, "0")}_${"tracking_identifier".repeat(4)}`;

const handle = (req: IncomingMessage, res: ServerResponse): void => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const otherHost = url.hostname === "localhost" ? "127.0.0.1" : "localhost";
  switch (url.pathname) {
    case "/cookies":
      html(
        res,
        `<h1>first-party cookies</h1>
         <script>document.cookie = "e2e_js=1; path=/";</script>`,
        { "set-cookie": "e2e_header=1; Path=/; Max-Age=3600" }
      );
      return;
    case "/embed":
      html(
        res,
        `<h1>embedder</h1>
         <iframe src="http://${otherHost}:${url.port}/iframe-set"></iframe>`
      );
      return;
    case "/iframe-set":
      // A JS cookie set in a cross-site iframe: Firefox accepts it (no
      // lax-by-default) and TCP partitions it under the embedding
      // top-level site.
      html(res, `<script>document.cookie = "e2e_tracker=1; path=/";</script>`);
      return;
    case "/storage":
      html(
        res,
        `<script>
           localStorage.setItem("e2e_ls", "1");
           document.cookie = "e2e_storage_marker=1; path=/";
         </script>`
      );
      return;
    case "/busy": {
      const indexes = [...Array(BUSY_COOKIE_COUNT).keys()];
      html(
        res,
        `<h1>busy site</h1>
         <script>
           ${indexes
             .map(
               (i) =>
                 `localStorage.setItem(${JSON.stringify(busyName("e2e_ls", i))}, "${"v".repeat(64)}");`
             )
             .join("\n")}
         </script>`,
        {
          "set-cookie": indexes.map(
            (i) =>
              `${busyName("e2e_busy", i)}=${"v".repeat(64)}; Path=/; Max-Age=3600`
          ),
        }
      );
      return;
    }
    case "/site-frame": {
      const site = url.hostname.replace(/^www\./, "");
      html(
        res,
        `<h1>site with a same-site frame</h1>
         <iframe src="http://devicebind.${site}:${url.port}/frame-storage"></iframe>
         <iframe src="http://127.0.0.1:${url.port}/iframe-set"></iframe>`,
        { "set-cookie": `e2e_site=1; Domain=${site}; Path=/; Max-Age=3600` }
      );
      return;
    }
    case "/shop":
      // Each storage write is awaited before the title changes, so a
      // caller polling the tab title knows the inventory is complete.
      // caches exists only in a secure context, hence the guard.
      html(
        res,
        `<h1>Example shop</h1>
         <script>
           document.cookie = "cart_items=2; path=/; max-age=3600";
           localStorage.setItem("recently_viewed", JSON.stringify(["lamp", "desk", "chair"]));
           localStorage.setItem("currency", "EUR");
           const database = new Promise((done) => {
             const open = indexedDB.open("shop-offline", 1);
             open.onupgradeneeded = () => open.result.createObjectStore("products");
             open.onsuccess = () => { open.result.close(); done(); };
             open.onerror = () => done();
           });
           const cache = "caches" in window
             ? caches.open("assets-v1")
                 .then((c) => c.put("/shop/app.css", new Response("body {}")))
                 .catch(() => undefined)
             : Promise.resolve();
           Promise.all([database, cache]).then(() => { document.title = "ready"; });
         </script>`,
        {
          "set-cookie": [
            "session_id=4f9c2a7e1b; Path=/; Max-Age=3600; HttpOnly",
            "lang=en; Path=/; Max-Age=3600",
            "consent=essential; Path=/; Max-Age=3600",
          ],
        }
      );
      return;
    case "/frame-storage":
      html(res, `<script>localStorage.setItem("e2e_frame_ls", "1");</script>`);
      return;
    default:
      html(res, "<h1>fixture landing</h1>");
  }
};

export const startFixtureServer = (): Promise<FixtureServer> =>
  new Promise((resolve) => {
    const server = createServer(handle);
    server.listen(0, "0.0.0.0", () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        port,
        primary: `http://localhost:${port}`,
        thirdParty: `http://127.0.0.1:${port}`,
        stop: () =>
          new Promise<void>((done) => {
            server.close(() => done());
            // Keep-alive sockets would otherwise hold close() open.
            server.closeAllConnections?.();
          }),
      });
    });
  });
