/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */
import {
  browserFromUserAgent,
  collectSystemDetails,
  formatSystemDetails,
  getSystemDetails,
  pickBrand,
  UNKNOWN_BROWSER,
  UNKNOWN_OS,
  UserAgentDataLike,
} from "@/services/system-details";

const GREASE = { brand: "Not)A;Brand", version: "99.0.0.0" };
const CHROME_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const uaData = (
  overrides: Partial<UserAgentDataLike> & {
    fullVersionList?: { brand: string; version: string }[];
    platformVersion?: string;
  } = {}
): UserAgentDataLike => {
  const { fullVersionList, platformVersion, ...rest } = overrides;
  return {
    brands: [
      GREASE,
      { brand: "Chromium", version: "130" },
      { brand: "Google Chrome", version: "130" },
    ],
    platform: "Windows",
    getHighEntropyValues: vi.fn().mockResolvedValue({
      fullVersionList: fullVersionList ?? [
        GREASE,
        { brand: "Chromium", version: "130.0.6723.92" },
        { brand: "Google Chrome", version: "130.0.6723.92" },
      ],
      platformVersion: platformVersion ?? "15.0.0",
    }),
    ...rest,
  };
};

describe("collectSystemDetails on Firefox", () => {
  it("reads the browser from getBrowserInfo and the OS from getPlatformInfo", async () => {
    await expect(
      collectSystemDetails({
        target: "firefox",
        getBrowserInfo: () =>
          Promise.resolve({ name: "Firefox", version: "140.3.0esr" }),
        getPlatformInfo: () => Promise.resolve({ os: "linux", arch: "x86-64" }),
      })
    ).resolves.toEqual({
      browser: "Firefox 140.3.0esr",
      os: "Linux (x86-64)",
    });
  });

  it("never asks for userAgentData, even if a page polyfills it", async () => {
    const data = uaData();
    const details = await collectSystemDetails({
      target: "firefox",
      getBrowserInfo: () =>
        Promise.resolve({ name: "Firefox", version: "152.0" }),
      userAgentData: data,
    });
    expect(data.getHighEntropyValues).not.toHaveBeenCalled();
    expect(details.browser).toBe("Firefox 152.0");
  });

  it("falls back to the user-agent string when getBrowserInfo rejects", async () => {
    const details = await collectSystemDetails({
      target: "firefox",
      getBrowserInfo: () => Promise.reject(new Error("nope")),
      userAgent:
        "Mozilla/5.0 (X11; Linux x86_64; rv:141.0) Gecko/20100101 Firefox/141.0",
    });
    expect(details.browser).toBe("Firefox 141.0");
  });

  it("keeps the name when getBrowserInfo has no version", async () => {
    const details = await collectSystemDetails({
      target: "firefox",
      getBrowserInfo: () => Promise.resolve({ name: "Firefox", version: "" }),
    });
    expect(details.browser).toBe("Firefox");
  });

  it("leaves both values out when every source is missing", async () => {
    await expect(collectSystemDetails({ target: "firefox" })).resolves.toEqual({
      browser: undefined,
      os: undefined,
    });
  });

  it("leaves the OS out when getPlatformInfo throws synchronously", async () => {
    const details = await collectSystemDetails({
      target: "firefox",
      getPlatformInfo: () => {
        throw new Error("not here");
      },
    });
    expect(details.os).toBeUndefined();
  });

  it("shows an unknown os key as-is, without an arch", async () => {
    const details = await collectSystemDetails({
      target: "firefox",
      getPlatformInfo: () => Promise.resolve({ os: "haiku" }),
    });
    expect(details.os).toBe("haiku");
  });
});

describe("collectSystemDetails on Chromium", () => {
  it("reports the product brand with its full version and the Windows release", async () => {
    const data = uaData();
    const details = await collectSystemDetails({
      target: "chrome",
      getPlatformInfo: () => Promise.resolve({ os: "win", arch: "x86-64" }),
      userAgentData: data,
      userAgent: CHROME_UA,
    });
    expect(data.getHighEntropyValues).toHaveBeenCalledWith([
      "fullVersionList",
      "platformVersion",
    ]);
    expect(details).toEqual({
      browser: "Google Chrome 130.0.6723.92",
      os: "Windows 11 (x86-64)",
    });
  });

  it.each([
    ["10.0.0", "Windows 10"],
    ["1.0.0", "Windows 10"],
    ["0.3.0", "Windows"],
    ["n/a", "Windows"],
  ])("maps Windows platform version %s to %s", async (version, name) => {
    const details = await collectSystemDetails({
      target: "chrome",
      getPlatformInfo: () => Promise.resolve({ os: "win" }),
      userAgentData: uaData({ platformVersion: version }),
    });
    expect(details.os).toBe(name);
  });

  it.each([
    ["mac", "14.5.0", "macOS 14.5.0 (arm64)"],
    ["cros", "16002.44.0", "ChromeOS 16002.44.0 (arm64)"],
    ["android", "14.0.0", "Android 14.0.0 (arm64)"],
    ["linux", "6.5.0", "Linux (arm64)"],
  ])(
    "adds the %s platform version where it is useful",
    async (os, version, line) => {
      const details = await collectSystemDetails({
        target: "chrome",
        getPlatformInfo: () => Promise.resolve({ os, arch: "arm64" }),
        userAgentData: uaData({ platformVersion: version }),
      });
      expect(details.os).toBe(line);
    }
  );

  it("names Edge, Brave or Opera from the brand list", async () => {
    const details = await collectSystemDetails({
      target: "chrome",
      userAgentData: uaData({
        fullVersionList: [
          { brand: "Chromium", version: "130.0.6723.92" },
          GREASE,
          { brand: "Microsoft Edge", version: "130.0.2849.68" },
        ],
      }),
    });
    expect(details.browser).toBe("Microsoft Edge 130.0.2849.68");
  });

  it("uses the low-entropy brands when getHighEntropyValues rejects", async () => {
    const details = await collectSystemDetails({
      target: "chrome",
      getPlatformInfo: () => Promise.resolve({ os: "mac", arch: "arm64" }),
      userAgentData: {
        brands: [
          GREASE,
          { brand: "Chromium", version: "130" },
          { brand: "Brave", version: "130" },
        ],
        getHighEntropyValues: () => Promise.reject(new Error("blocked")),
      },
    });
    expect(details).toEqual({ browser: "Brave 130", os: "macOS (arm64)" });
  });

  it("reports plain Chromium when it is the only real brand", async () => {
    const details = await collectSystemDetails({
      target: "chrome",
      userAgentData: {
        brands: [GREASE, { brand: "Chromium", version: "131" }],
      },
    });
    expect(details.browser).toBe("Chromium 131");
  });

  it("falls back to the user-agent string without userAgentData", async () => {
    const details = await collectSystemDetails({
      target: "chrome",
      userAgent: CHROME_UA,
    });
    expect(details.browser).toBe("Chrome 130.0.0.0");
  });

  it("falls back to userAgentData.platform without getPlatformInfo", async () => {
    const details = await collectSystemDetails({
      target: "chrome",
      userAgentData: uaData({ platform: "macOS", platformVersion: "15.1.0" }),
    });
    expect(details.os).toBe("macOS 15.1.0");
  });

  it.each([
    ["Windows", "Windows 11"],
    ["Chrome OS", "ChromeOS 15.0.0"],
    ["Android", "Android 15.0.0"],
    ["Linux", "Linux"],
    ["Plan 9", undefined],
    ["", undefined],
  ])("maps userAgentData.platform %j to %j", async (platform, line) => {
    const details = await collectSystemDetails({
      target: "chrome",
      userAgentData: uaData({ platform }),
    });
    expect(details.os).toBe(line);
  });
});

describe("pickBrand", () => {
  it("returns nothing for a missing or empty list", () => {
    expect(pickBrand(undefined)).toBeUndefined();
    expect(pickBrand([])).toBeUndefined();
    expect(pickBrand([GREASE])).toBeUndefined();
  });
});

describe("browserFromUserAgent", () => {
  it.each([
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
      "Microsoft Edge 130.0.0.0",
    ],
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 OPR/115.0.0.0",
      "Opera 115.0.0.0",
    ],
    [
      "Mozilla/5.0 (X11; Linux x86_64) Chromium/129.0.1.2",
      "Chromium 129.0.1.2",
    ],
    [CHROME_UA, "Chrome 130.0.0.0"],
  ])("reads %s", (ua, expected) => {
    expect(browserFromUserAgent(ua)).toBe(expected);
  });

  it("returns nothing for an unknown or empty string", () => {
    expect(browserFromUserAgent("Mozilla/5.0 jsdom/26.0.0")).toBeUndefined();
    expect(browserFromUserAgent("")).toBeUndefined();
    expect(browserFromUserAgent(undefined)).toBeUndefined();
  });
});

describe("formatSystemDetails", () => {
  it("lists the browser, the OS and the extension version", () => {
    expect(
      formatSystemDetails(
        { browser: "Firefox 152.0", os: "Linux (x86-64)" },
        "Auto-Delete Cookies for Privacy",
        "1.2.0"
      )
    ).toBe(
      "- Browser: Firefox 152.0\n- Operating system: Linux (x86-64)\n- Auto-Delete Cookies for Privacy version: 1.2.0"
    );
  });

  it("asks the reporter to fill in what could not be read", () => {
    expect(formatSystemDetails({}, "ADCP", "1.2.0")).toBe(
      `- Browser: ${UNKNOWN_BROWSER}\n- Operating system: ${UNKNOWN_OS}\n- ADCP version: 1.2.0`
    );
  });
});

describe("getSystemDetails", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("reads getPlatformInfo and navigator.userAgentData on the Chrome build", async () => {
    global.browser.runtime.getPlatformInfo.mockResolvedValue({
      os: "mac",
      arch: "arm64",
    });
    vi.stubGlobal("navigator", {
      userAgent: CHROME_UA,
      userAgentData: uaData({ platformVersion: "14.5.0" }),
    });
    await expect(getSystemDetails()).resolves.toEqual({
      browser: "Google Chrome 130.0.6723.92",
      os: "macOS 14.5.0 (arm64)",
    });
    expect(global.browser.runtime.getBrowserInfo).not.toHaveBeenCalled();
  });

  it("reads getBrowserInfo on the Firefox build", async () => {
    vi.stubGlobal("__BROWSER__", "firefox");
    vi.resetModules();
    const firefoxFlavored = await import("@/services/system-details");
    global.browser.runtime.getBrowserInfo.mockResolvedValue({
      name: "Firefox",
      version: "140.3.0esr",
    });
    global.browser.runtime.getPlatformInfo.mockResolvedValue({
      os: "win",
      arch: "x86-64",
    });
    await expect(firefoxFlavored.getSystemDetails()).resolves.toEqual({
      browser: "Firefox 140.3.0esr",
      os: "Windows (x86-64)",
    });
  });

  it("resolves to nothing when the runtime APIs and navigator are missing", async () => {
    const runtime = global.browser.runtime as unknown as Record<
      string,
      unknown
    >;
    const { getBrowserInfo, getPlatformInfo } = runtime;
    runtime.getBrowserInfo = undefined;
    runtime.getPlatformInfo = undefined;
    vi.stubGlobal("navigator", undefined);
    try {
      await expect(getSystemDetails()).resolves.toEqual({
        browser: undefined,
        os: undefined,
      });
    } finally {
      runtime.getBrowserInfo = getBrowserInfo;
      runtime.getPlatformInfo = getPlatformInfo;
    }
  });
});
