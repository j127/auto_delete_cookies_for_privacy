/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * The browser and operating system lines of the Support page's system
 * details block, so people filing a bug report don't have to look them up.
 *
 * This is the one deliberate exception to browser-capabilities.ts's "no
 * runtime.getBrowserInfo, no UA sniffing" rule. The values here are only
 * displayed (and pasted into a report); nothing in the extension branches on
 * them. Every source is optional: a missing API, a rejected call, or an
 * unexpected shape leaves that part out instead of breaking the page.
 *
 * Sources, best first:
 * - Browser on Firefox: runtime.getBrowserInfo() (name + full version).
 * - Browser on Chromium: navigator.userAgentData, with getHighEntropyValues
 *   for the full version and the real brand (Chrome, Edge, Brave, Opera...).
 * - Both fall back to the user-agent string.
 * - OS: runtime.getPlatformInfo() (os + arch), plus on Chromium the
 *   userAgentData platform version where it says something useful.
 */
import { BrowserTarget, CURRENT_BROWSER } from "./browser-capabilities";

export interface SystemDetails {
  /** e.g. "Firefox 140.3.0esr" or "Google Chrome 130.0.6723.92". */
  browser?: string;
  /** e.g. "macOS 14.5.0 (arm64)" or "Linux (x86-64)". */
  os?: string;
}

export interface BrandVersion {
  brand: string;
  version: string;
}

export interface HighEntropyValues {
  fullVersionList?: BrandVersion[];
  platformVersion?: string;
}

/** The subset of NavigatorUAData (Chromium only) this module reads. */
export interface UserAgentDataLike {
  brands?: BrandVersion[];
  platform?: string;
  getHighEntropyValues?: (hints: string[]) => Promise<HighEntropyValues>;
}

export interface SystemDetailsSources {
  target: BrowserTarget;
  getBrowserInfo?: () =>
    Promise<{ name?: string; version?: string } | undefined> | undefined;
  getPlatformInfo?: () =>
    Promise<{ os?: string; arch?: string } | undefined> | undefined;
  userAgentData?: UserAgentDataLike;
  userAgent?: string;
}

/** runtime.PlatformOs values (both browsers) mapped to readable names. */
const OS_NAMES: Readonly<Record<string, string>> = {
  android: "Android",
  cros: "ChromeOS",
  fuchsia: "Fuchsia",
  ios: "iOS",
  linux: "Linux",
  mac: "macOS",
  openbsd: "OpenBSD",
  win: "Windows",
};

/** Reads a source without ever throwing or rejecting. */
const safely = async <T>(
  read: (() => Promise<T> | T) | undefined
): Promise<T | undefined> => {
  if (!read) return undefined;
  try {
    return await read();
  } catch {
    return undefined;
  }
};

const isText = (value: unknown): value is string =>
  typeof value === "string" && value.trim() !== "";

const nameWithVersion = (name: string, version: unknown): string =>
  isText(version) ? `${name} ${version.trim()}` : name;

/**
 * Chromium lists itself, its product brand, and a made-up "GREASE" brand
 * (e.g. "Not)A;Brand") meant to break naive parsers. The product brand is
 * the useful one; plain Chromium builds only list "Chromium".
 */
const isGreaseBrand = (brand: string): boolean => /not.*a.*brand/i.test(brand);

export const pickBrand = (
  list: ReadonlyArray<BrandVersion> | undefined
): BrandVersion | undefined => {
  if (!Array.isArray(list)) return undefined;
  const real = list.filter(
    (entry) =>
      entry && isText(entry.brand) && !isGreaseBrand(entry.brand.trim())
  );
  return (
    real.find((entry) => entry.brand.trim() !== "Chromium") ??
    real.find((entry) => entry.brand.trim() === "Chromium")
  );
};

/**
 * Last resort for the browser line. Order matters: Edge and Opera also
 * carry "Chrome/" in their user-agent strings.
 */
export const browserFromUserAgent = (
  userAgent: string | undefined
): string | undefined => {
  if (!isText(userAgent)) return undefined;
  const patterns: ReadonlyArray<[RegExp, string]> = [
    [/Firefox\/([\d.]+[\w.]*)/, "Firefox"],
    [/Edg(?:e|A|iOS)?\/([\d.]+)/, "Microsoft Edge"],
    [/OPR\/([\d.]+)/, "Opera"],
    [/Chrome\/([\d.]+)/, "Chrome"],
    [/Chromium\/([\d.]+)/, "Chromium"],
  ];
  for (const [pattern, name] of patterns) {
    const match = userAgent.match(pattern);
    if (match) return nameWithVersion(name, match[1]);
  }
  return undefined;
};

/**
 * Turns the Chromium platform version into something readable where it
 * helps. Windows reports a platform version, not the marketing name:
 * 13 and up is Windows 11, 1 to 12 is Windows 10. macOS, ChromeOS and
 * Android report their own version. Linux reports nothing useful.
 */
const osVersionLabel = (
  os: string | undefined,
  platformVersion: string | undefined
): { name?: string; version?: string } => {
  if (!os || !isText(platformVersion)) return {};
  if (os === "win") {
    const major = Number.parseInt(platformVersion, 10);
    if (Number.isNaN(major) || major < 1) return {};
    return { name: major >= 13 ? "Windows 11" : "Windows 10" };
  }
  if (os === "mac" || os === "cros" || os === "android") {
    return { version: platformVersion.trim() };
  }
  return {};
};

/** Maps userAgentData.platform ("macOS", "Chrome OS", ...) to an os key. */
const osKeyFromUAPlatform = (platform: unknown): string | undefined => {
  if (!isText(platform)) return undefined;
  const lower = platform.toLowerCase();
  if (lower.includes("mac")) return "mac";
  if (lower.includes("win")) return "win";
  if (lower.includes("chrome")) return "cros";
  if (lower.includes("android")) return "android";
  if (lower.includes("linux")) return "linux";
  return undefined;
};

export const collectSystemDetails = async (
  sources: SystemDetailsSources
): Promise<SystemDetails> => {
  const { target, userAgentData } = sources;

  const platformInfo = await safely(sources.getPlatformInfo);
  // Only Chromium has userAgentData; one call fetches both hints.
  const highEntropy =
    target === "chrome" && userAgentData
      ? await safely(() =>
          userAgentData.getHighEntropyValues?.([
            "fullVersionList",
            "platformVersion",
          ])
        )
      : undefined;

  let browserLine: string | undefined;
  if (target === "firefox") {
    const info = await safely(sources.getBrowserInfo);
    if (info && isText(info.name)) {
      browserLine = nameWithVersion(info.name.trim(), info.version);
    }
  } else {
    const brand =
      pickBrand(highEntropy?.fullVersionList) ??
      pickBrand(userAgentData?.brands);
    if (brand) browserLine = nameWithVersion(brand.brand.trim(), brand.version);
  }
  browserLine ??= browserFromUserAgent(sources.userAgent);

  const osKey = isText(platformInfo?.os)
    ? platformInfo.os
    : osKeyFromUAPlatform(userAgentData?.platform);
  let osLine: string | undefined;
  if (osKey) {
    const label = osVersionLabel(osKey, highEntropy?.platformVersion);
    const baseName = label.name ?? OS_NAMES[osKey] ?? osKey;
    osLine = nameWithVersion(baseName, label.version);
    if (isText(platformInfo?.arch)) osLine += ` (${platformInfo.arch})`;
  }

  return { browser: browserLine, os: osLine };
};

/** Reads the live browser APIs for collectSystemDetails. Never rejects. */
export const getSystemDetails = (): Promise<SystemDetails> => {
  const runtime = browser.runtime as unknown as Partial<
    Pick<SystemDetailsSources, "getBrowserInfo" | "getPlatformInfo">
  >;
  const nav =
    typeof navigator === "undefined"
      ? undefined
      : (navigator as Navigator & { userAgentData?: UserAgentDataLike });
  return collectSystemDetails({
    target: CURRENT_BROWSER,
    getBrowserInfo:
      typeof runtime.getBrowserInfo === "function"
        ? () => runtime.getBrowserInfo?.()
        : undefined,
    getPlatformInfo:
      typeof runtime.getPlatformInfo === "function"
        ? () => runtime.getPlatformInfo?.()
        : undefined,
    userAgentData: nav?.userAgentData,
    userAgent: nav?.userAgent,
  }).catch(() => ({}));
};

/** What the block says when a value couldn't be read. */
export const UNKNOWN_BROWSER = "(please add your browser and its version)";
export const UNKNOWN_OS = "(please add your operating system)";

/**
 * The system details block, as shown on the Support page and copied into
 * bug reports. Kept in English on purpose: it is pasted into the
 * maintainers' issue tracker, like the settings block next to it.
 */
export const formatSystemDetails = (
  details: SystemDetails,
  extensionName: string,
  extensionVersion: string
): string =>
  [
    `- Browser: ${details.browser ?? UNKNOWN_BROWSER}`,
    `- Operating system: ${details.os ?? UNKNOWN_OS}`,
    `- ${extensionName} version: ${extensionVersion}`,
  ].join("\n");
