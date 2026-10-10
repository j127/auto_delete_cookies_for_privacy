/**
 * Copyright (c) 2017-2022 Kenny Do and CAD Team (https://github.com/Cookie-AutoDelete/Cookie-AutoDelete/graphs/contributors)
 * Licensed under MIT (https://github.com/Cookie-AutoDelete/Cookie-AutoDelete/blob/3.X.X-Branch/LICENSE)
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import {
  EventListenerAction,
  ListType,
  SettingID,
  SiteDataType,
} from "@/typings/enums";
import ipaddr from "ipaddr.js";
import { getDomain } from "tldts";
import { browserCapabilities } from "./browser-capabilities";

/* --- CONSTANTS --- */
export const ADCPCOOKIENAME = "ADCPBrowsingDataCleanup";
export const SITEDATATYPES = [
  SiteDataType.CACHE,
  SiteDataType.INDEXEDDB,
  SiteDataType.LOCALSTORAGE,
  SiteDataType.PLUGINDATA,
  SiteDataType.SERVICEWORKERS,
];

/* --- FUNCTIONS --- */
/**
 * Console Log Outputs - Mostly For Debugging
 */
/**
 * Short unique id for notification ids, expression ids, and throwaway cookie
 * paths. Replaces the deprecated shortid package with the built-in
 * crypto.randomUUID (Chrome 92+/service workers, Node, Bun).
 */
export const uid = (): string => crypto.randomUUID();

export const adcpLog = (x: ADCPLogItem, output: boolean): void => {
  if (!x.msg || x.msg.trim() === "") return;
  if (!output) return;
  const h = `ADCP_${browser.runtime.getManifest().version}`;
  const cOut = [
    // eslint-disable-next-line no-console
    console.debug,
    // eslint-disable-next-line no-console
    console.error,
    // eslint-disable-next-line no-console
    console.info,
    // eslint-disable-next-line no-console
    console.log,
    // eslint-disable-next-line no-console
    console.warn,
  ];
  const cTypes = ["debug", "error", "info", "log", "warn"];
  let type = (x.type || "debug").toLowerCase();
  if (!cTypes.includes(type)) {
    // eslint-disable-next-line no-console
    console.error(
      `${h} - Invalid Console Output Type given [ ${type} ].  Using [debug] instead.`
    );
    type = "debug";
  }
  // Try to determine what type of object it is.
  const tx = typeof x.x;
  let data = "";
  switch (tx) {
    case "boolean":
    case "number":
    case "string":
      data = x.x.toString();
      break;
    case "undefined":
      break;
    case "object":
      data = JSON.stringify(x.x, null, 2);
      break;
    default:
      // eslint-disable-next-line no-console
      console.warn(
        `${h} - Received unexpected typeof [ ${tx} ].  Attempting to display it...`
      );
      data = x.x.toString();
      break;
  }
  // Output to console.
  cOut[cTypes.indexOf(type)](`${h} - ${type} - ${x.msg}\n${data}`);
};

/**
 * Create Partial Cookie info for debug
 */
export const createPartialTabInfo = (
  tab: Partial<browser.tabs.Tab>
): Partial<browser.tabs.Tab> => {
  return {
    cookieStoreId: tab.cookieStoreId,
    discarded: tab.discarded,
    id: tab.id,
    incognito: tab.incognito,
    status: tab.status,
    url: tab.url,
    windowId: tab.windowId,
  };
};

/**
 * Converts a version string to a number
 */
export const convertVersionToNumber = (version?: string): number => {
  if (!version) return -1;
  return parseInt(version.replace(/[.]/g, ""), 10);
};

/**
 * Abstract Event Listener call to add/remove with checks.
 * @param event The event listener
 * @param listener The callback function to add/check/remove.
 * @param action The EventListenerAction (add/remove).
 */
export const eventListenerActions = (
  event: import("webextension-polyfill").Events.Event<(...args: any[]) => void>,
  listener: (...args: any[]) => void,
  action: EventListenerAction
): void => {
  if (!event || !event.hasListener) return;
  switch (action) {
    case EventListenerAction.ADD:
      if (!event.hasListener(listener)) {
        event.addListener(listener);
      }
      break;
    case EventListenerAction.REMOVE:
      if (event.hasListener(listener)) {
        event.removeListener(listener);
      }
      break;
  }
};

/**
 * Extract the main domain from sub domains
 *   - sub.sub.domain.com ==> domain.com
 * Local html directory/files will return itself
 */
export const extractMainDomain = (domain: string): string => {
  if (domain === "") return "";
  // return itself if it is a local html file or IP Address.
  if (domain.startsWith("file://") || ipaddr.isValid(domain)) return domain;

  // Delete a '.' if domain contains it at the end
  const eDot = domain.endsWith(".");
  const editedDomain = trimDot(domain);

  // Registrable domain (eTLD+1) via the real Public Suffix List. The old
  // hand-rolled second-level-domain heuristic mistook platform suffixes —
  // user.github.io collapsed to github.io, granting open-tab protection
  // (and partition/FPD grouping) to the whole false neighborhood (audit
  // bug 9). allowPrivateDomains keeps those platform suffixes (github.io,
  // netlify.app, ...) separate per user site. Unlisted TLDs fall back to
  // "last two labels" inside tldts; single-label hosts (intranet names)
  // return null and pass through unchanged.
  const registrable = getDomain(editedDomain, { allowPrivateDomains: true });
  return `${registrable ?? editedDomain}${eDot ? "." : ""}`;
};

/**
 * This fetches all (first party) cookies for a given tab domain
 * @param state The webextension state
 * @param tab The tab to fetch all (first party) cookies for.
 */
/**
 * Wraps details for ENUMERATING cookies.getAll calls. On Firefox,
 * `firstPartyDomain: null` means "match cookies from every first-party
 * domain": required under First-Party Isolation (a getAll without the key
 * rejects outright) and the only way to see leftover FPI cookies after FPI
 * is switched off. Upstream Cookie AutoDelete regressed this to an
 * explicitly-undefined value in 2020 — Gecko treats that as omitted, the
 * rejection was swallowed per store, and cleanup silently did nothing
 * under FPI for years (audit bugs 1 and 3). Chrome rejects unknown getAll
 * keys, so the Chrome build must not carry the key at all.
 *
 * The cast hides the key from the polyfill's Firefox-generated type, which
 * declares firstPartyDomain as string-only even though Gecko accepts null.
 */
export const withAnyFirstPartyDomain = <T extends object>(details: T): T =>
  browserCapabilities.supportsFirstPartyDomain
    ? ({ ...details, firstPartyDomain: null } as unknown as T)
    : details;

/**
 * Wraps details for ENUMERATING cookies.getAll calls. `partitionKey: {}`
 * makes getAll return partitioned AND unpartitioned cookies in one call
 * (Firefox 94+/Chrome 119+; both under this extension's floors). Without
 * it, cookies partitioned by Total Cookie Protection (Firefox default
 * since 103) or CHIPS (Chrome) are invisible — the tracker cookies a
 * cleaner exists to remove could never be seen or deleted (audit bug 2).
 * Applies to BOTH builds.
 */
export const withAllPartitions = <T extends object>(details: T): T =>
  ({ ...details, partitionKey: {} }) as unknown as T;

/**
 * The partitionKey.topLevelSite candidates for a hostname — used to pull
 * the partition bucket OF a site (third-party cookies stored under it).
 * topLevelSite is a scheme+registrable-domain "site", hence mainDomain.
 *
 * Firefox ESR 140 also writes a non-default port into the key
 * (http://localhost:8080) and getAll matches the key exactly, while 152
 * and later drop the port (#432). So when the tab URL carries a port, the
 * tab's own scheme+site+port is a candidate too. Default ports never
 * appear: URL.port is empty for them.
 */
export const topLevelSiteCandidates = (
  hostname: string,
  tabUrl?: string
): string[] => {
  const mainDomain = extractMainDomain(hostname);
  if (mainDomain === "") return [];
  // An IPv6 host needs its brackets back before a port can follow it.
  // A URL origin brackets it even without a port (http://[::1]), so every
  // candidate uses the bracketed form; extractMainDomain returns it bare.
  const host = mainDomain.includes(":") ? `[${mainDomain}]` : mainDomain;
  const candidates = [`https://${host}`, `http://${host}`];
  let parsed: URL | undefined;
  try {
    parsed = tabUrl ? new URL(tabUrl) : undefined;
  } catch {
    parsed = undefined;
  }
  if (
    parsed &&
    parsed.port !== "" &&
    (parsed.protocol === "https:" || parsed.protocol === "http:")
  ) {
    candidates.push(`${parsed.protocol}//${host}:${parsed.port}`);
  }
  return candidates;
};

export const getAllCookiesForDomain = async (
  state: State,
  tab: browser.tabs.Tab
): Promise<browser.cookies.Cookie[] | undefined> => {
  if (!tab.url || tab.url === "") return;
  if (tab.url.startsWith("about:") || tab.url.startsWith("chrome:")) return;
  const debug = getSetting(state, SettingID.DEBUG_MODE) as boolean;
  const partialTabInfo = createPartialTabInfo(tab);
  const { url } = tab;
  // Chrome tabs carry no cookieStoreId: without the incognito fallback an
  // incognito tab's counts came from the regular store (#474).
  const cookieStoreId = tabCookieStoreId(tab);
  const hostname = getHostname(url);
  if (hostname === "") {
    adcpLog(
      {
        msg: "Libs.getAllCookiesForDomain:  hostname parsed empty for tab url.",
        x: { partialTabInfo, hostname },
      },
      debug
    );
    return;
  }
  const cookies: browser.cookies.Cookie[] = [];

  if (hostname.startsWith("file:")) {
    const allCookies = await browser.cookies.getAll(
      withAllPartitions(
        withAnyFirstPartyDomain({
          storeId: cookieStoreId,
        })
      )
    );
    const regExp = new RegExp(hostname.slice(7)); // take out 'file://'
    adcpLog(
      {
        msg: "Libs.getAllCookiesForDomain:  Local File Regex to rest on cookie.path",
        x: { partialTabInfo, hostname, regExp: regExp.toString() },
      },
      debug
    );
    allCookies
      .filter((c) => c.domain === "" && regExp.test(c.path))
      .forEach((cc) => cookies.push(cc));
  } else {
    adcpLog(
      {
        msg: "Libs.getAllCookiesForDomain:  browser.cookies.getAll for domain.",
        x: {
          partialTabInfo,
          domain: hostname,
        },
      },
      debug
    );
    // The site's own cookies, across every partition they may sit in.
    const cookiesDomain = await browser.cookies.getAll(
      withAllPartitions(
        withAnyFirstPartyDomain({
          domain: hostname,
          storeId: cookieStoreId,
        })
      )
    );
    cookiesDomain.forEach((c) => cookies.push(c));
    // Plus this site's partition bucket: third-party cookies partitioned
    // UNDER this top-level site (TCP/CHIPS). They belong to the site's
    // browsing footprint, so counts and per-tab actions include them.
    for (const topLevelSite of topLevelSiteCandidates(hostname, url)) {
      const partitioned = await browser.cookies.getAll(
        withAnyFirstPartyDomain({
          partitionKey: { topLevelSite },
          storeId: cookieStoreId,
        })
      );
      partitioned.forEach((c) => cookies.push(c));
    }
  }

  const deduped = dedupeCookies(cookies);

  adcpLog(
    {
      msg: "Libs.getAllCookiesForDomain:  Filtered Cookie Count",
      x: {
        partialTabInfo,
        tabURL: tab.url,
        hostname,
        cookieCount: deduped.length,
      },
    },
    debug
  );

  return deduped;
};

/**
 * Dedupes cookies by their full identity — a cookie's uniqueness includes
 * which partition it lives in, so partition-bucket queries merged with
 * domain queries cannot double-count.
 */
export const dedupeCookies = (
  cookies: browser.cookies.Cookie[]
): browser.cookies.Cookie[] => {
  const seen = new Map<string, browser.cookies.Cookie>();
  for (const cookie of cookies) {
    const key = [
      cookie.storeId,
      cookie.name,
      cookie.domain,
      cookie.path,
      cookie.partitionKey?.topLevelSite ?? "",
      cookie.firstPartyDomain ?? "",
    ].join("|");
    if (!seen.has(key)) seen.set(key, cookie);
  }
  return [...seen.values()];
};

/**
 * Gets the default expression options depending on the list/storeId.
 * If storeId is not default, it will try to get defaults set in default list
 * before using ADCP defaults (all checked).
 * @param state The State (store.getState())
 * @param storeId The container id, or 'default'
 * @param listType The List Type
 */
export const getContainerExpressionDefault = (
  state: State,
  storeId: string,
  listType: ListType
): Expression => {
  const getExpression = (list: string): Expression | undefined => {
    return state.lists[list]
      ? state.lists[list].find((exp) => {
          return (
            exp.listType === listType &&
            exp.expression === `_Default:${listType}`
          );
        })
      : undefined;
  };
  const exp: Expression = {
    expression: "",
    listType: ListType.WHITE,
    storeId: "",
  };
  return getExpression(storeId) || exp;
};

/**
 * Returns the host name of the url.
 *   - https://en.wikipedia.org/wiki/Cat ==> en.wikipedia.org
 *
 * Local file will return the directory of that file.
 *   - file:///home/user/documents/file.html ==> file:///home/user/documents
 *   - file:///D:/user/documents/file.html ==> file:///D:/user/documents
 */
export const getHostname = (urlToGetHostName: string | undefined): string => {
  if (!urlToGetHostName) {
    return "";
  }
  if (urlToGetHostName.startsWith("file:")) {
    // This assumes the browser supplied us with a valid local file url.
    // E.g. file:///C:/test.html or file:///home/user/test.html
    return urlToGetHostName.slice(0, urlToGetHostName.lastIndexOf("/"));
  }
  try {
    // Strip "www." if the URL starts with it.
    const hostname = new URL(urlToGetHostName).hostname.replace(
      /^www[a-z0-9]?\./,
      ""
    );
    // Remove enclosing [ ] from IPv6 for ipaddr parsing
    if (hostname.startsWith("[") && hostname.endsWith("]")) {
      return hostname.slice(1, -1);
    }
    return hostname;
  } catch {
    return "";
  }
};

/**
 * The url's exact hostname: like getHostname, but a leading "www." stays
 * (getHostname drops it so www and the bare domain read as one site).
 * Marker cookies are host-only, so finding the marker of exactly this host
 * needs the host the browser actually set the cookie on. IPv6 brackets are
 * removed like getHostname does. "" for file: urls and unparseable input.
 */
export const getExactHostname = (url: string | undefined): string => {
  if (!url || url.startsWith("file:")) return "";
  try {
    return normalizeHost(new URL(url).hostname);
  } catch {
    return "";
  }
};

/** Lowercase host without leading/trailing dots or IPv6 brackets. */
const normalizeHost = (host: string): string =>
  trimDot(host.trim())
    .replace(/^\[(.*)\]$/, "$1")
    .toLowerCase();

/** Whether a cookie is this extension's marker cookie for exactly host. */
export const isMarkerCookieFor = (
  cookie: Pick<browser.cookies.Cookie, "domain" | "name">,
  host: string
): boolean =>
  cookie.name === ADCPCOOKIENAME &&
  host !== "" &&
  normalizeHost(cookie.domain) === normalizeHost(host);

/**
 * Returns the explicit port of the url ("3000" for http://localhost:3000),
 * or "" for default-port urls, file: urls, and anything unparseable.
 * getHostname strips ports, but Chrome's browsingData API scopes removals
 * by origin, and a non-default port is part of the origin.
 */
export const getPort = (urlToGetPort: string | undefined): string => {
  if (!urlToGetPort) return "";
  try {
    return new URL(urlToGetPort).port;
  } catch {
    return "";
  }
};

/**
 * Returns all matched Expressions from a single list.
 * Can pass in either a single list of Expression or the entire State
 * First checks for IP, then CIDR, then falls back to Regular Expression.
 * A blank input lists every expression in search mode (an empty filter box
 * shows the whole table) but matches NOTHING in match mode — otherwise
 * URL-less tabs (new tab page, chrome:// pages) would inherit whichever
 * expression happens to be first in the list (#101).
 * @param lists The Container List of Expressions from State.lists
 * @param search whether we're searching for a regex or matching
 * @param input The string for testing
 * @param storeId The storeId/Container
 */
export const getMatchedExpressions = (
  lists: StoreIdToExpressionList,
  storeId: string,
  input?: string,
  search = false
): ReadonlyArray<Expression> => {
  const expressions = lists[storeId] || [];
  if (expressions.length === 0) return expressions;
  if (!input || input.trim().length == 0) return search ? expressions : [];
  // Check if input is a valid IP Address (IPv4 or IPv6) (non-CIDR)
  // This takes care of IPv4-mapped IPv6 address (converts to IPv4 counterpart)
  let iip = ipaddr.isValid(input) ? ipaddr.process(input) : undefined;
  // If initial test passes, do further checks.
  // This makes sure the IP Address is a full four part decimal.
  if (
    iip &&
    iip.kind() == "ipv4" &&
    !ipaddr.IPv4.isValidFourPartDecimal(input)
  ) {
    iip = undefined;
  }
  return expressions.filter((expression) => {
    const exp = expression.expression;
    if (iip) {
      const ipResult = matchIPInExpression(exp, iip);
      if (ipResult !== undefined) return ipResult;
    } // Input not an IP.  Fallback to Regexp
    return search
      ? getSearchResults(exp, input)
      : new RegExp(globExpressionToRegExp(exp)).test(input);
  });
};

/**
 * Attempts to match an expression string in a variety of ways.
 * @param exp  string - The expression/domain string
 * @param input  string - The string to search for
 */
export const getSearchResults = (
  exp: Expression["expression"],
  input: string
): boolean => {
  try {
    const ixp1 = globExpressionToRegExp(input).slice(0, -1).toLowerCase();
    const exp1 = exp.toLowerCase();
    const exp2 = exp1.slice(exp1.startsWith("*.") ? 2 : 0);
    return (
      new RegExp(globExpressionToRegExp(exp), "i").test(input) ||
      new RegExp(globExpressionToRegExp(input), "i").test(exp) ||
      new RegExp(ixp1, "i").test(exp) ||
      exp1.startsWith(ixp1) ||
      exp1.startsWith(input) ||
      exp2.startsWith(input) ||
      exp2.startsWith(ixp1) ||
      exp1.endsWith(ixp1) ||
      exp1.endsWith(input) ||
      exp1.includes(ixp1)
    );
  } catch {
    return false;
  }
};

/**
 * Gets the value of the setting
 */
export const getSetting = (
  state: State,
  settingName: SettingID
): string | number | boolean => state.settings[settingName].value;

/**
 * Gets a sanitized cookieStoreId — THE normalizer from raw browser store
 * ids to expression-list keys. Every write path (redux actions) and read
 * path (cleanup expression matching) must go through this so both agree
 * on one key space.
 *
 * Chrome semantics: "0" is the default store, "1" is the incognito store.
 * Firefox semantics: "firefox-default" and "firefox-private" map onto the
 * SAME unified "default"/"private" keys Chrome uses — upstream Cookie
 * AutoDelete kept "firefox-private" as its own key on the read path while
 * the UI wrote private-window expressions elsewhere, so private-window
 * whitelists never protected anything (audit bug 4). Container stores
 * ("firefox-container-N") pass through unchanged: each container keeps
 * its own expression list.
 */
export const getStoreId = (storeId: string): string => {
  if (storeId === "0" || storeId === "firefox-default") {
    return "default";
  }
  if (storeId === "1" || storeId === "firefox-private") {
    return "private";
  }

  return storeId;
};

/**
 * The target-aware INVERSE of getStoreId: expression-list key in, raw
 * browser store id out, for UI code that must hand cookies.getAll a real
 * store id. Passing the unified "default"/"private" keys (or Chrome's ids
 * to Firefox) makes Gecko reject the call outright — which is exactly how
 * the settings cookie-name list broke on the Firefox build when this
 * mapping was still hardcoded to Chrome's "0". Container keys ARE raw ids
 * already and pass through, as does anything unrecognized.
 */
export const toRawStoreId = (listKey: string): string => {
  const firefox = browserCapabilities.storeIdScheme === "firefox";
  if (listKey === "default") {
    return firefox ? "firefox-default" : "0";
  }
  if (listKey === "private") {
    return firefox ? "firefox-private" : "1";
  }

  return listKey;
};

/**
 * Converts a expression to its regular expression equivalent
 */
export const globExpressionToRegExp = (glob: string): string => {
  const normalizedGlob = glob.trim();
  if (normalizedGlob.slice(0, 1) === "/" && normalizedGlob.slice(-1) === "/") {
    // Treat /str/ as regular expression str
    return normalizedGlob.slice(1, -1);
  }
  const wildStart = normalizedGlob.startsWith("*.");

  return `${`${wildStart ? "(^|.)" : "^"}${normalizedGlob.slice(
    wildStart ? 2 : 0
  )}`
    .replace(/[[\]\\/.]/g, "\\$&")
    .replace(/\*/g, ".*")}$`;
};

/**
 * Returns true if it is an IP (v4 or v6)
 */
export const isAnIP = (url: string | undefined): boolean => {
  if (!url) {
    return false;
  }
  const hostname = getHostname(url);
  return (
    ipaddr.IPv4.isValidFourPartDecimal(hostname) ||
    ipaddr.IPv6.isValid(hostname)
  );
};

/**
 * Returns true if it is a webpage or a local file
 */
export const isAWebpage = (URL: string | undefined): boolean => {
  if (!URL) {
    return false;
  }
  return !!(URL.match(/^http:/) || URL.match(/^https:/) || URL.match(/^file:/));
};

/*
 * Checks if the hostname given is a local file
 */
export const localFileToRegex = (hostname: string): string => {
  if (hostname === "") return "";
  if (hostname.startsWith("file:") || hostname.indexOf("/") === 0) {
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#Escaping
    return hostname.replace(/[.*+\-?^${}()|[\]\\]/g, "\\$&");
  }
  return hostname; // Doesn't have a file path...return as is.
};

/**
 * Checks if given IP Address is in an Expression.
 * Attempts to match full IP Address, allows CIDR notation.
 * @param iip
 * @param exp
 */
export const matchIPInExpression = (
  exp: Expression["expression"],
  iip: ipaddr.IPv4 | ipaddr.IPv6
): boolean | undefined => {
  // Check if expression is a single IP Address (IPv4 or IPv6), non CIDR
  if (ipaddr.isValid(exp)) {
    // This takes care of IPv4-mapped IPv6 address (converts to IPv4 counterpart)
    const eip = ipaddr.process(exp);
    // Returns false if trying to match IPv4 and IPv6 together.
    // Putting this through the match function below will throw error.
    if (iip.kind() !== eip.kind()) return false;
    // Both kinds match at this point.
    let bits = 0;
    switch (eip.kind()) {
      case "ipv4":
        bits = 32;
        break;
      case "ipv6":
        bits = 128;
        break;
    }
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore Needed otherwise TS complains about no compatibility in union signatures.
    return eip.match(iip, bits);
  } // Not a single IP Address in Expression.
  // Check for CIDR notation '10.0.0.0/8' or '::/48'
  const cidrNotation = exp.split("/");
  // [0] should be IP, [1] should be CIDR range number
  if (cidrNotation.length === 2) {
    if (ipaddr.isValid(cidrNotation[0])) {
      try {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore Needed otherwise TS complains about no compatibility in union signatures.
        return iip.match(ipaddr.parseCIDR(exp));
      } catch {
        // Most likely an attempt to match IPv4 and IPv6 together,
        // or CIDR is invalid.
        return false;
      }
    } // First part is not a valid IP.  Fallback to Regexp.
  } // Expression Slash Array length not 2.  Fallback to Regexp.
  return undefined;
};

/**
 * The raw cookie store a tab's cookies live in. Firefox tabs name it
 * (containers and private windows included); Chrome tabs carry no
 * cookieStoreId, so the incognito flag picks Chrome's "1" or "0".
 */
export const tabCookieStoreId = (
  tab: Pick<browser.tabs.Tab, "cookieStoreId" | "incognito">
): string => tab.cookieStoreId ?? (tab.incognito ? "1" : "0");

/**
 * Whether any site-data type is set to be cleaned, i.e. whether hosts need
 * marker cookies to put their storage in a cleanup's scope.
 */
export const hasSiteDataCleanupEnabled = (state: State): boolean =>
  [
    SettingID.CLEANUP_CACHE,
    SettingID.CLEANUP_INDEXEDDB,
    SettingID.CLEANUP_LOCALSTORAGE,
    SettingID.CLEANUP_PLUGINDATA,
    SettingID.CLEANUP_SERVICEWORKERS,
  ].some((id) => Boolean(getSetting(state, id)));

/**
 * Parse cookieStoreId for use in addExpressionUI. Chrome tabs don't expose a
 * cookieStoreId, so expressions added from a tab context land in the
 * "default" store. Firefox tabs do expose one, so it is routed through
 * getStoreId to land in the unified key space ("firefox-private" →
 * "private", containers pass through) — keeping the UI write path and the
 * cleanup read path on the same list keys.
 */
export const parseCookieStoreId = (cookieStoreId: string | undefined): string =>
  getStoreId(cookieStoreId || "default");

/**
 * Prepare Domains for all cleanups.
 * @param port The tab URL's explicit port when the caller knows one — a
 * non-default port is part of the origin browsingData removals scope to.
 */
export const prepareCleanupDomains = (domain: string, port = ""): string[] => {
  if (domain.trim() === "") return [];
  let d: string = domain.trim();
  const domains = new Set<string>();
  if (ipaddr.IPv4.isValidFourPartDecimal(d)) {
    domains.add(d);
  } else if (ipaddr.IPv6.isValid(d)) {
    domains.add(`[${d}]`);
  } else {
    const www = new RegExp(/^www[0-9a-z]?\./i);
    const sDot = new RegExp(/^\./);
    // Most likely not an IPv4 or IPv6 address. Presuming domain.
    if (sDot.test(d)) {
      // dot at beginning.  .sub.doma.in(.)
      d = d.slice(1);
    }
    // at this point it should be all unison - sub.doma.in(.)
    // Origins carry no leading dot: the cookie-style .sub.doma.in variants
    // this used to emit are not valid origins — Chrome ignored them, and
    // they polluted the cleanup notification's domain list.
    domains.add(d); // sub.doma.in

    if (!www.test(d)) {
      domains.add(`www.${d}`); // www.sub.doma.in
    }
  }

  // Chrome's browsingData API takes full origins.
  const origins: string[] = [];
  for (const host of domains) {
    origins.push(`http://${host}`);
    origins.push(`https://${host}`);
    if (port !== "") {
      origins.push(`http://${host}:${port}`);
      origins.push(`https://${host}:${port}`);
    }
  }
  return origins;
};

/**
 * Firefox's browsingData scope list for one cookie/tab domain: bare
 * hostnames, exact match only — Firefox rejects Chrome's `origins` key
 * outright and does no subdomain expansion on `hostnames`. The list
 * carries the observed host itself plus the registrable domain and its
 * www variant, the practical mitigation for the exact-host subdomain gap
 * (audit bug 5: upstream sent only the bare main domain, so storage on
 * real subdomains was never cleared).
 */
export const prepareCleanupHostnames = (domain: string): string[] => {
  const d = trimDot(domain.trim());
  if (d === "") return [];
  if (ipaddr.IPv4.isValidFourPartDecimal(d) || ipaddr.IPv6.isValid(d)) {
    return [d];
  }
  const mainDomain = extractMainDomain(d);
  return [...new Set([d, mainDomain, `www.${mainDomain}`])];
};

/**
 * Per-target browsingData scope list: origins on Chrome, hostnames on
 * Firefox. The port only matters for origins — hostnames carry none.
 */
export const prepareCleanupScope = (domain: string, port = ""): string[] =>
  browserCapabilities.browsingDataScoping === "origins"
    ? prepareCleanupDomains(domain, port)
    : prepareCleanupHostnames(domain);

/**
 * Puts the domain in the right format for browser.cookies.remove()
 */
export const prepareCookieDomain = (cookie: browser.cookies.Cookie): string => {
  let cookieDomain = cookie.domain.trim();
  if (cookieDomain.length === 0 && cookie.path.trim().length !== 0) {
    // No Domain - presuming local file (file:// protocol)
    return `file://${cookie.path}`;
  }

  if (ipaddr.IPv6.isValid(cookieDomain)) {
    cookieDomain = `[${cookieDomain}]`;
  }

  const sDot = cookieDomain.startsWith(".") ? 1 : 0;

  return `http${cookie.secure ? "s" : ""}://${cookieDomain.slice(sDot)}${
    cookie.path
  }`;
};

/**
 * The urls cookies.remove is called with for a cookie whose removal url
 * prepareCookieDomain built. A cookie without the Secure attribute that an
 * https page set gets the http:// url, and where Chromium binds cookies to
 * the scheme that set them (scheme-bound cookies, #464 on Edge), that url
 * no longer matches: the removal quietly does nothing. So such cookies may
 * also need the https:// url. The http:// url stays first.
 *
 * Port-bound cookies (Chromium's EnablePortBoundCookies) set from a
 * non-default port still match neither url: cookies carry no port, so
 * prepareCookieDomain cannot add one.
 */
export const cookieRemovalUrls = (preparedUrl: string): string[] =>
  preparedUrl.startsWith("http://")
    ? [preparedUrl, `https://${preparedUrl.slice("http://".length)}`]
    : [preparedUrl];

type CookieRemoveDetails = Parameters<typeof browser.cookies.remove>[0];
type CookieRemoveResult = Awaited<ReturnType<typeof browser.cookies.remove>>;

/**
 * Whether the exact cookie (name, domain, path, host-only flag, store,
 * partition and first-party domain) is still in the store. A failed
 * lookup counts as gone.
 */
/**
 * A partitionKey as one comparable string. An absent key and {} both mean
 * unpartitioned.
 */
const partitionKeyId = (
  key: { topLevelSite?: string; hasCrossSiteAncestor?: boolean } | undefined
): string =>
  key?.topLevelSite === undefined
    ? ""
    : `${key.topLevelSite}|${key.hasCrossSiteAncestor ?? ""}`;

const cookieStillStored = async (
  details: CookieRemoveDetails,
  cookie: Pick<browser.cookies.Cookie, "domain" | "path"> & {
    hostOnly?: boolean;
  }
): Promise<boolean> => {
  try {
    const query = {
      domain: trimDot(cookie.domain),
      name: details.name,
      path: cookie.path,
      storeId: details.storeId,
      ...(details.partitionKey !== undefined && {
        partitionKey: details.partitionKey,
      }),
    };
    const found =
      (await browser.cookies.getAll(
        details.firstPartyDomain !== undefined
          ? { ...query, firstPartyDomain: details.firstPartyDomain }
          : withAnyFirstPartyDomain(query)
      )) ?? [];
    return found.some(
      (c) =>
        c.name === details.name &&
        c.domain === cookie.domain &&
        c.path === cookie.path &&
        (cookie.hostOnly === undefined || c.hostOnly === cookie.hostOnly) &&
        partitionKeyId(c.partitionKey) === partitionKeyId(details.partitionKey)
    );
  } catch {
    return false;
  }
};

/**
 * Removes one cookie through cookieRemovalUrls(details.url), in order. The
 * https:// url is only tried while the exact cookie is still stored after
 * the http:// one: cookies.remove matches by url and name, not one cookie
 * (Chrome removes every same-name cookie the url would be sent, a parent
 * domain's included), so an unconditional https:// call could take a
 * Secure same-name cookie a keep rule protects. Firefox and Chromium
 * without scheme-bound cookies therefore never make the second call. With
 * scheme-bound cookies on, that call can still take a same-name cookie the
 * https:// url is sent; cookies.remove offers nothing narrower.
 * Resolves with the first non-null result, or null when no call removed
 * anything; rejects as soon as a call rejects.
 */
export const removeCookieAtEveryScheme = async (
  details: CookieRemoveDetails,
  cookie: Pick<browser.cookies.Cookie, "domain" | "path"> & {
    hostOnly?: boolean;
  }
): Promise<CookieRemoveResult> => {
  const [first, ...rest] = cookieRemovalUrls(details.url);
  let removed: CookieRemoveResult = await browser.cookies.remove({
    ...details,
    url: first,
  });
  for (const url of rest) {
    if (!(await cookieStillStored(details, cookie))) break;
    const result = await browser.cookies.remove({ ...details, url });
    removed = removed ?? result;
  }
  return removed;
};

/**
 * Returns the first available matched expression.
 * wrapper for getMatchedExpressions
 *
 * Container stores get their own expression lists only while the
 * contextualIdentities setting is on. With it off (or not yet present —
 * it only exists once the container service restores it), container
 * cookies are governed by the default list: they are still enumerated and
 * cleaned (upstream skipped them entirely, audit bug 6a), and the user
 * manages one list for all of them.
 */
export const returnMatchedExpressionObject = (
  state: State,
  cookieStoreId: string,
  hostname: string
): Expression | undefined => {
  return getMatchedExpressions(
    state.lists,
    effectiveListKey(state, cookieStoreId),
    hostname
  )[0];
};

/**
 * The expression-list key that GOVERNS a store right now: container keys
 * fold to "default" while the contextualIdentities setting is off. Both
 * the cleanup read path and the popup's read AND write paths use this, so
 * a rule added from a container tab always lands in the list that
 * actually governs that tab.
 */
export const effectiveListKey = (
  state: State,
  cookieStoreId: string
): string => {
  const storeKey = getStoreId(cookieStoreId);
  return storeKey.startsWith("firefox-container-") &&
    state.settings[SettingID.CONTEXTUAL_IDENTITIES]?.value !== true
    ? "default"
    : storeKey;
};

/**
 * Show a notification
 * @param x Contains object consisting of:
 *          - duration: number in seconds
 *          - msg: notification content
 *          - title: notification title
 * @param display Whether to display the notification.
 */
export const showNotification = (
  x: {
    duration: number;
    msg: string;
    title?: string;
  },
  display = true
): void => {
  if (!display) return;
  const sid = `ADCP-notification-${uid()}`;
  browser.notifications.create(sid, {
    iconUrl: browser.runtime.getURL("icons/icon_48.png"),
    message: x.msg,
    title: `ADCP ${browser.runtime.getManifest().version} - ${
      x.title ? x.title : browser.i18n.getMessage("manualActionNotification")
    }`,
    type: "basic",
  });
  setTimeout(() => {
    browser.notifications.clear(sid);
  }, x.duration * 1000);
};

/**
 * Makes the proper site data property key for browser.browsingData.remove.
 * i.e. Cache => cache ; LocalStorage => localStorage
 * @param siteData The Site Data to convert to browser format.
 */
export const siteDataToBrowser = (siteData: SiteDataType): string =>
  `${siteData[0].toLowerCase()}${siteData.slice(1)}`;

/**
 * The DataTypeSet browser.browsingData.remove needs to clear one of the
 * extension's site-data types: the type's own key plus any storage the
 * browser files under separate keys that the same setting covers
 * (browserCapabilities.extraRemovalTypes: Chrome's Cache Storage and File
 * System data). siteDataToBrowser stays the single-key name, because i18n
 * keys, setting ids and log keys are built from it.
 * @param siteData The Site Data to convert to removal types.
 */
export const siteDataToRemovalTypes = (
  siteData: SiteDataType
): browser.browsingData.DataTypeSet => {
  const types: Record<string, boolean> = {
    [siteDataToBrowser(siteData)]: true,
  };
  for (const extra of browserCapabilities.extraRemovalTypes[siteData] ?? []) {
    types[extra] = true;
  }
  return types;
};

/**
 * Sleep execution for ms.
 * Ensures no 0 second setTimeout otherwise side effects.
 * Ensures we don't go over max signed 32-bit Int of 2,147,483,647
 */
export const sleep = (ms: number): Promise<any> => {
  return new Promise((r) =>
    setTimeout(r, ms < 250 ? 250 : ms > 2147483500 ? 2147483500 : ms)
  );
};

/**
 * Show an Error notification
 * @param e The Error (Error Object)
 * @param duration number in seconds
 */
export const throwErrorNotification = (e: Error, duration: number): void => {
  const nid = `ADCP-notification-failed-${uid()}`;
  browser.notifications.create(nid, {
    // Chrome fails the whole notification if the icon can't load, so this
    // must name a file that actually ships (a test pins it to disk).
    iconUrl: browser.runtime.getURL("icons/icon_48_red.png"),
    message: e.message,
    title: browser.i18n.getMessage("errorText"),
    type: "basic",
  });
  setTimeout(() => {
    browser.notifications.clear(nid);
  }, duration * 1000);
};

/**
 * Trim leading and ending dot of a string
 */
export const trimDot = (str: string): string => str.replace(/^[.]+|[.]+$/g, "");

/**
 * Opposite of a falsey check for undefined
 */
export const undefinedIsTrue = (bool: boolean | undefined): boolean => {
  if (bool === undefined) return true;
  return bool;
};

/**
 * Validate a single Expression.
 * Returns undefined if valid.  Otherwise returns an error message.
 * @param input The Domain Expression to validate.
 */
export const validateExpressionDomain = (input: string): string => {
  const inputTrim = input.trim();
  if (!inputTrim) return browser.i18n.getMessage("inputErrorEmpty");
  if (inputTrim.startsWith("/") && inputTrim.endsWith("/")) {
    // Regular Expression
    try {
      new RegExp(inputTrim.slice(1, -1));
    } catch (e) {
      return browser.i18n.getMessage("inputErrorRegExp", [`${e}`]);
    }
  } else {
    // not Regex
    if (inputTrim.startsWith("/")) {
      // missing end slash.
      return browser.i18n.getMessage("inputErrorSlashStartMissingEnd");
    }
    if (inputTrim.endsWith("/")) {
      // missing beginning slash, or not regex
      return browser.i18n.getMessage("inputErrorSlashEndMissingStart");
    }
    if (inputTrim.indexOf(",") !== -1) {
      // no commas allowed in non-regex
      return browser.i18n.getMessage("inputErrorComma");
    }
  }
  if (inputTrim.indexOf(" ") !== -1) {
    // no spaces allowed in hostnames or RegExp.
    return browser.i18n.getMessage("inputErrorSpace");
  }
  return "";
};
