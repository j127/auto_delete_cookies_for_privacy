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
 */

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
