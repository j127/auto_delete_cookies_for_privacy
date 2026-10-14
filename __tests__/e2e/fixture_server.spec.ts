/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * Guards the Firefox e2e fixture's cross-site frame pages (#504) without a
 * browser: the server answers a proxy request (Firefox reaches the
 * port-less EMBED_HOSTS through proxyPrefs) like a direct one, and the
 * pages keep the shape embedded_frame_site_data.e2e.ts relies on: the
 * embedding page's cookie on its own site, a port-less cross-site frame,
 * and a frame that writes storage and sets no cookie.
 */

import { request } from "http";
import {
  EMBED_HOSTS,
  FixtureServer,
  proxyPrefs,
  startFixtureServer,
} from "../../e2e/helpers/fixture_server";

interface Reply {
  status: number;
  cookie: string[];
  body: string;
}

let fixture: FixtureServer;

/** GET an absolute url through the fixture, as a browser's proxy request. */
const viaProxy = (url: string): Promise<Reply> =>
  new Promise((resolve, reject) => {
    const req = request(
      {
        host: "127.0.0.1",
        port: fixture.port,
        path: url,
        headers: { host: new URL(url).host },
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () =>
          resolve({
            status: res.statusCode ?? 0,
            cookie: res.headers["set-cookie"] ?? [],
            body,
          })
        );
      }
    );
    req.on("error", reject);
    req.end();
  });

beforeAll(async () => {
  fixture = await startFixtureServer();
});

afterAll(async () => {
  await fixture.stop();
});

describe("Firefox fixture: cross-site frame pages", () => {
  it("names three hosts on three different sites, without ports", () => {
    const hosts = Object.values(EMBED_HOSTS);
    const sites = hosts.map((host) => host.split(".").slice(-2).join("."));
    expect(new Set(sites).size).toBe(3);
    expect(hosts.every((host) => !host.includes(":"))).toBe(true);
  });

  it("sends plain http through the server and leaves the driver's own hosts direct", () => {
    expect(proxyPrefs(4321)).toMatchObject({
      "network.proxy.type": 1,
      "network.proxy.http": "127.0.0.1",
      "network.proxy.http_port": 4321,
      "network.proxy.no_proxies_on": "localhost, 127.0.0.1",
    });
  });

  it("serves the embedding page with its site's cookie and the port-less frame", async () => {
    for (const host of [EMBED_HOSTS.page, EMBED_HOSTS.otherPage]) {
      const reply = await viaProxy(`http://${host}/embedder`);
      expect(reply.status).toBe(200);
      expect(reply.cookie).toEqual([
        `e2e_site=1; Domain=${host.replace(/^www\./, "")}; Path=/; Max-Age=3600`,
      ]);
      expect(reply.body).toContain(
        `<iframe src="http://${EMBED_HOSTS.frame}/embedded-storage">`
      );
    }
  });

  it("serves a frame that writes storage, reports what it found, and sets no cookie", async () => {
    const reply = await viaProxy(
      `http://${EMBED_HOSTS.frame}/embedded-storage`
    );
    expect(reply.status).toBe(200);
    expect(reply.cookie).toEqual([]);
    expect(reply.body).toContain("document.body.dataset.had");
    expect(reply.body).toContain('localStorage.setItem("e2e_embedded_ls"');
    expect(reply.body).not.toContain("document.cookie");
  });
});
