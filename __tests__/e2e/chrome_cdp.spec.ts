/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * Guards the pure parts of the Chromium e2e driver (#473): the command
 * line Chrome for Testing starts with, finding the binary, reading the
 * DevTools address and the extension id, and the CDP client's request and
 * response matching. The browser itself only runs in `just e2e_chromium`.
 */

import {
  CdpClient,
  CdpSocket,
  chromeLaunchArgs,
  devToolsUrlFromActivePort,
  extensionIdFromTargets,
  PINNED_CHROME_VERSION,
  resolveChromeBinary,
  waitFor,
} from "../../e2e/helpers/chrome_cdp";

const LAUNCH = {
  extensionDir: "/repo/extension",
  profileDir: "/tmp/profile",
  hostResolverRules: "MAP *.adcp.test 127.0.0.1:4321",
  secureOrigins: ["http://www.adcp.test", "http://devicebind.adcp.test"],
};

describe("chromeLaunchArgs", () => {
  it("loads the extension and no other", () => {
    const args = chromeLaunchArgs(LAUNCH);
    expect(args).toContain("--load-extension=/repo/extension");
    expect(args).toContain("--disable-extensions-except=/repo/extension");
  });

  it("uses the throwaway profile and lets DevTools pick its port", () => {
    const args = chromeLaunchArgs(LAUNCH);
    expect(args).toContain("--user-data-dir=/tmp/profile");
    expect(args).toContain("--remote-debugging-port=0");
  });

  it("sends the fixture hosts to the fixture server as secure origins", () => {
    const args = chromeLaunchArgs(LAUNCH);
    expect(args).toContain(
      "--host-resolver-rules=MAP *.adcp.test 127.0.0.1:4321"
    );
    expect(args).toContain(
      "--unsafely-treat-insecure-origin-as-secure=http://www.adcp.test,http://devicebind.adcp.test"
    );
  });

  it("runs headless unless asked to show the window", () => {
    expect(chromeLaunchArgs(LAUNCH)).toContain("--headless");
    expect(chromeLaunchArgs({ ...LAUNCH, headed: true })).not.toContain(
      "--headless"
    );
  });

  it("keeps Chrome's sandbox on", () => {
    // CI lifts the AppArmor restriction that would otherwise make Chrome
    // abort on Ubuntu (.github/workflows/ci.yml), so the suite tests the
    // browser as people run it.
    expect(chromeLaunchArgs(LAUNCH)).not.toContain("--no-sandbox");
  });

  it("never asks for the macOS login keychain", () => {
    const args = chromeLaunchArgs(LAUNCH);
    expect(args).toContain("--use-mock-keychain");
    expect(args).toContain("--password-store=basic");
  });

  it("opens a blank page last, after every switch", () => {
    expect(chromeLaunchArgs(LAUNCH).at(-1)).toBe("about:blank");
  });
});

describe("resolveChromeBinary", () => {
  it("pins an exact Chrome for Testing build", () => {
    expect(PINNED_CHROME_VERSION).toMatch(/^\d+\.\d+\.\d+\.\d+$/);
  });

  it("prefers CHROME_BIN", () => {
    expect(
      resolveChromeBinary({
        env: { CHROME_BIN: "/opt/chrome" },
        exists: () => false,
      })
    ).toBe("/opt/chrome");
  });

  it("treats an empty CHROME_BIN as unset", () => {
    expect(
      resolveChromeBinary({
        env: { CHROME_BIN: "" },
        home: "/home/u",
        platform: "linux-x64",
        exists: () => true,
      })
    ).toBe(
      `/home/u/.cache/puppeteer/chrome/linux-${PINNED_CHROME_VERSION}/chrome-linux64/chrome`
    );
  });

  it("finds the pinned build in the @puppeteer/browsers cache on a Mac", () => {
    expect(
      resolveChromeBinary({
        env: {},
        home: "/Users/u",
        platform: "darwin-arm64",
        exists: () => true,
      })
    ).toBe(
      `/Users/u/.cache/puppeteer/chrome/mac_arm-${PINNED_CHROME_VERSION}/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`
    );
  });

  it("says how to install the pinned build when it is missing", () => {
    expect(() =>
      resolveChromeBinary({
        env: {},
        home: "/home/u",
        platform: "linux-x64",
        exists: () => false,
      })
    ).toThrow(`install chrome@${PINNED_CHROME_VERSION}`);
  });

  it("asks for CHROME_BIN on a platform it has no layout for", () => {
    expect(() =>
      resolveChromeBinary({ env: {}, platform: "win32-x64" })
    ).toThrow("set CHROME_BIN");
  });
});

describe("devToolsUrlFromActivePort", () => {
  it("joins the port and the browser path into a websocket URL", () => {
    expect(
      devToolsUrlFromActivePort("53211\n/devtools/browser/abc-123\n")
    ).toBe("ws://127.0.0.1:53211/devtools/browser/abc-123");
  });

  it.each(["", "53211", "53211\n", "port\n/devtools/browser/x"])(
    "waits while the file is incomplete (%j)",
    (text) => {
      expect(devToolsUrlFromActivePort(text)).toBeUndefined();
    }
  );
});

describe("extensionIdFromTargets", () => {
  const worker = {
    targetId: "w",
    type: "service_worker",
    url: "chrome-extension://abcdefghijklmnop/bundles/background.js",
  };

  it("reads the id off the extension's background worker", () => {
    expect(
      extensionIdFromTargets([
        { targetId: "p", type: "page", url: "about:blank" },
        worker,
      ])
    ).toBe("abcdefghijklmnop");
  });

  it("ignores pages of the extension and other workers", () => {
    expect(
      extensionIdFromTargets([
        {
          targetId: "s",
          type: "page",
          url: "chrome-extension://abcdefghijklmnop/bundles/background.js",
        },
        {
          targetId: "o",
          type: "service_worker",
          url: "https://www.adcp.test/bundles/background.js",
        },
        {
          targetId: "x",
          type: "service_worker",
          url: "chrome-extension://zzzz/other.js",
        },
      ])
    ).toBeUndefined();
  });
});

/** A socket that records what the client sends and lets a spec answer. */
const fakeSocket = () => {
  const sent: any[] = [];
  const socket: CdpSocket & { closed: boolean } = {
    closed: false,
    onmessage: null,
    onclose: null,
    send: (data) => sent.push(JSON.parse(data)),
    close: () => {
      socket.closed = true;
    },
  };
  const reply = (message: unknown) =>
    socket.onmessage?.({ data: JSON.stringify(message) });
  return { socket, sent, reply };
};

describe("CdpClient", () => {
  it("numbers requests and resolves each with its own response", async () => {
    const { socket, sent, reply } = fakeSocket();
    const cdp = new CdpClient(socket);
    const first = cdp.send("Target.getTargets");
    const second = cdp.send("Browser.getVersion");
    expect(sent.map((m) => m.id)).toEqual([1, 2]);
    reply({ id: 2, result: { product: "Chrome/155" } });
    reply({ id: 1, result: { targetInfos: [] } });
    await expect(first).resolves.toEqual({ targetInfos: [] });
    await expect(second).resolves.toEqual({ product: "Chrome/155" });
  });

  it("addresses an attached page through its sessionId", () => {
    const { socket, sent } = fakeSocket();
    const cdp = new CdpClient(socket);
    void cdp.send("Runtime.evaluate", { expression: "1" }, "session-1");
    void cdp.send("Target.getTargets");
    expect(sent[0]).toEqual({
      id: 1,
      method: "Runtime.evaluate",
      params: { expression: "1" },
      sessionId: "session-1",
    });
    expect(sent[1]).not.toHaveProperty("sessionId");
  });

  it("rejects with the method and the protocol error", async () => {
    const { socket, reply } = fakeSocket();
    const cdp = new CdpClient(socket);
    const call = cdp.send("Storage.getUsageAndQuota");
    reply({ id: 1, error: { code: -32000, message: "no origin" } });
    await expect(call).rejects.toThrow(
      /^Storage\.getUsageAndQuota: .*no origin/
    );
  });

  it("drops events and answers to no pending request", async () => {
    const { socket, reply } = fakeSocket();
    const cdp = new CdpClient(socket);
    const call = cdp.send("Target.getTargets");
    reply({ method: "Target.targetCreated", params: {} });
    reply({ id: 99, result: {} });
    reply({ id: 1, result: { ok: true } });
    await expect(call).resolves.toEqual({ ok: true });
  });

  it("fails every pending request when the connection closes", async () => {
    const { socket } = fakeSocket();
    const cdp = new CdpClient(socket);
    const call = cdp.send("Target.createTarget");
    socket.onclose?.({});
    await expect(call).rejects.toThrow(
      "Target.createTarget: the DevTools connection closed"
    );
  });

  it("closes its socket", () => {
    const { socket } = fakeSocket();
    new CdpClient(socket).close();
    expect(socket.closed).toBe(true);
  });
});

describe("waitFor", () => {
  it("returns the first truthy value", async () => {
    let calls = 0;
    expect(await waitFor(async () => ++calls >= 3 && calls, 1000, 1)).toBe(3);
  });

  it("treats a throwing check as not ready yet", async () => {
    let calls = 0;
    const value = await waitFor(
      async () => {
        calls++;
        if (calls < 2) throw new Error("not up");
        return "up";
      },
      1000,
      1
    );
    expect(value).toBe("up");
  });

  it("returns undefined once the time runs out", async () => {
    expect(await waitFor(async () => false, 20, 5)).toBeUndefined();
  });
});
