/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */
import { extractMainDomain, getHostname, isAnIP } from "./libs";

/** What the popup offers to keep for a tab's URL. */
export interface KeepTarget {
  /** The tab's hostname; empty on a tab with no site. */
  hostname: string;
  /** The plain domain shown in the caption, e.g. `example.com`. */
  domain: string;
  /** Every expression the advanced popup lists for this site. */
  addableHostnames: string[];
  /** The broadest addable expression, e.g. `*.example.com`. */
  keepExpression: string;
}

/**
 * The rule the popup's Keep buttons add for a URL. The popup and the
 * keyboard shortcuts (#588) both read it from here, so a shortcut always
 * adds the same rule the popup would.
 */
export const keepTargetFor = (url: string | undefined): KeepTarget => {
  const hostname = getHostname(url);
  const mainDomain = extractMainDomain(hostname);
  const addableHostnames = [
    hostname === mainDomain ? undefined : `*.${mainDomain}`,
    hostname,
  ].filter(Boolean) as string[];
  if (hostname !== "" && !isAnIP(url) && !hostname.startsWith("file:")) {
    addableHostnames.push(`*.${hostname}`);
  }

  const domain = mainDomain || hostname;
  const keepExpression =
    addableHostnames.find((h) => h === `*.${domain}`) ?? hostname;
  return { addableHostnames, domain, hostname, keepExpression };
};
