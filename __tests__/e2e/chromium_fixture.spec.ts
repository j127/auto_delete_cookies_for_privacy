/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * Guards the Chromium e2e fixture (#473) without a browser: the server
 * answers by Host header the way Chrome reaches it through
 * --host-resolver-rules, and its pages keep the shape the specs rely on
 * (the parent-domain cookie, the port-less same-site frame, the three
 * storage writes, the plain-text page).
 */

import { request } from "http";
import {
  ChromiumFixture,
  fixtureHostResolverRules,
  fixtureOrigins,
  LATE_COOKIE,
  OTHER_SITE_HOSTS,
  SITE_COOKIE,
  SITE_HOSTS,
  startChromiumFixture,
  STORAGE_NAMES,
} from "../../e2e/helpers/chromium_fixture";

interface Reply {
  status: number;
  type: string;
  cookie: string[];
  body: string;
}

let fixture: ChromiumFixture;

/** GET path from the fixture as the browser would for host. */
const get = (host: string, path: string): Promise<Reply> =>
  new Promise((resolve, reject) => {
    const req = request(
      {
        host: "127.0.0.1",
        port: fixture.port,
        path,
        headers: { host },
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () =>
          resolve({
            status: res.statusCode ?? 0,
            type: String(res.headers["content-type"] ?? ""),
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
  fixture = await startChromiumFixture();
});

afterAll(async () => {
  await fixture.stop();
});

describe("Chromium fixture", () => {
  it("maps both sites to the server, without a port in the origins", () => {
    expect(fixtureHostResolverRules(4321)).toBe(
      "MAP *.adcp.test 127.0.0.1:4321,MAP *.unkept.test 127.0.0.1:4321"
    );
    expect(fixtureOrigins()).toEqual([
      "http://www.adcp.test",
      "http://devicebind.adcp.test",
      "http://signin.adcp.test",
      "http://www.unkept.test",
      "http://devicebind.unkept.test",
    ]);
  });

  it("sets the site cookie on the parent domain and frames the same-site host", async () => {
    const page = await get(SITE_HOSTS.page, "/site");
    expect(page.status).toBe(200);
    expect(page.cookie).toEqual([
      `${SITE_COOKIE}=1; Domain=adcp.test; Path=/; Max-Age=86400`,
    ]);
    expect(page.body).toContain(
      `<iframe src="http://${SITE_HOSTS.frame}/frame"></iframe>`
    );
  });

  it("frames the other site's own devicebind. host", async () => {
    const page = await get(OTHER_SITE_HOSTS.page, "/site");
    expect(page.cookie[0]).toContain("Domain=unkept.test;");
    expect(page.body).toContain(`src="http://${OTHER_SITE_HOSTS.frame}/frame"`);
  });

  it.each(["/site", "/frame", "/tab"])(
    "writes all three kinds of storage on %s",
    async (path) => {
      const { body } = await get(SITE_HOSTS.page, path);
      for (const name of Object.values(STORAGE_NAMES)) {
        expect(body).toContain(JSON.stringify(name));
      }
      expect(body).toContain("localStorage.setItem");
      expect(body).toContain("indexedDB.open");
      expect(body).toContain("caches.open");
    }
  );

  it("sets no cookie on the frame or the separate tab", async () => {
    expect((await get(SITE_HOSTS.frame, "/frame")).cookie).toEqual([]);
    expect((await get(SITE_HOSTS.tab, "/tab")).cookie).toEqual([]);
  });

  it("serves a plain-text page that writes nothing", async () => {
    const plain = await get(SITE_HOSTS.tab, "/plain");
    expect(plain.type).toMatch(/^text\/plain/);
    expect(plain.body).toBe(`${SITE_HOSTS.tab}\n`);
    expect(plain.cookie).toEqual([]);
  });

  it("serves a page that sets the site cookie and sends a keepalive request to /held", async () => {
    const page = await get(SITE_HOSTS.page, "/late");
    expect(page.cookie).toEqual([
      `${SITE_COOKIE}=1; Domain=adcp.test; Path=/; Max-Age=86400`,
    ]);
    expect(page.body).toContain(
      `fetch("/held", { method: "POST", keepalive: true })`
    );
    expect(page.body).toContain(`document.title = "ready"`);
  });

  it("holds /held until releaseHeld(), then sets the late cookie on the parent domain", async () => {
    let answered = false;
    const reply = get(SITE_HOSTS.page, "/held").then((r) => {
      answered = true;
      return r;
    });
    while (fixture.heldCount() === 0) {
      await new Promise((done) => setTimeout(done, 10));
    }
    await new Promise((done) => setTimeout(done, 50));
    expect(answered).toBe(false);
    fixture.releaseHeld();
    const held = await reply;
    expect(fixture.heldCount()).toBe(0);
    expect(held.status).toBe(204);
    expect(held.cookie).toEqual([
      `${LATE_COOKIE}=1; Domain=adcp.test; Path=/; Max-Age=86400`,
    ]);
  });

  it("answers 404 elsewhere", async () => {
    expect((await get(SITE_HOSTS.page, "/nope")).status).toBe(404);
  });
});
