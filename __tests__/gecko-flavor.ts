/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2017-2022 Kenny Do and CAD Team; fork changes (c) 2026 j127.
 * Licensed under MIT (see LICENSE).
 */

/**
 * Gecko-SEMANTICS mock layer over the hand-rolled jest mock tree.
 *
 * Upstream Cookie AutoDelete's FPI regression survived five years because
 * their mock asserted the broken call shape: it happily accepted
 * `firstPartyDomain: undefined` while real Gecko treats an
 * explicitly-undefined property as omitted and REJECTS the call under
 * First-Party Isolation. This module models what Gecko actually does, as
 * a stateful cookie jar behind cookies.getAll/remove plus the
 * browsingData origins rejection — so specs exercise real semantics
 * instead of hand-trained argument echoes.
 *
 * Behavioral contract implemented (per MDN + the audit's fact-checks):
 * - getAll under FPI without a firstPartyDomain property → rejects.
 * - getAll firstPartyDomain: null → matches every FPD; a string matches
 *   exactly; property ABSENT (FPI off) → only firstPartyDomain: "".
 * - getAll partitionKey omitted → unpartitioned only; {} → partitioned
 *   AND unpartitioned; { topLevelSite } → exactly that partition.
 * - remove requires the exact identity (name, host from url, storeId,
 *   firstPartyDomain under FPI, exact partitionKey) and resolves null on
 *   a miss, like Gecko.
 * - browsingData.remove({ origins }) → rejects (Firefox has no origins
 *   key); hostnames resolves.
 *
 * Install per file AFTER stubbing __BROWSER__ to "firefox"; the Chrome
 * flavor never installs this, keeping every existing spec untouched.
 */

interface GeckoFlavorOptions {
  /** Models privacy.firstparty.isolate. */
  firstPartyIsolate?: boolean;
}

export interface GeckoJar {
  /** Live view of the remaining cookies. */
  cookies: browser.cookies.Cookie[];
  seed: (...cookies: browser.cookies.Cookie[]) => void;
}

const hostFromUrl = (url: string): string => {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
};

const domainMatches = (cookieDomain: string, wanted: string): boolean => {
  const host = cookieDomain.replace(/^\./, "");
  const want = wanted.replace(/^\./, "");
  return (
    host === want || host.endsWith(`.${want}`) || want.endsWith(`.${host}`)
  );
};

export const installGeckoCookieMock = (
  options: GeckoFlavorOptions = {}
): GeckoJar => {
  const jar: browser.cookies.Cookie[] = [];

  global.browser.cookies.getAll.mockImplementation(
    (details: {
      domain?: string;
      storeId?: string;
      firstPartyDomain?: string | null;
      partitionKey?: { topLevelSite?: string };
    }) => {
      if (options.firstPartyIsolate && !("firstPartyDomain" in details)) {
        return Promise.reject(
          new Error(
            "First-Party Isolation is enabled, but the required 'firstPartyDomain' attribute was not set."
          )
        );
      }
      let matched = [...jar];
      if (details.storeId !== undefined) {
        matched = matched.filter((c) => c.storeId === details.storeId);
      }
      if (details.domain !== undefined) {
        matched = matched.filter((c) =>
          domainMatches(c.domain, details.domain as string)
        );
      }
      if (!("firstPartyDomain" in details)) {
        // FPI off, key omitted: Gecko only returns non-isolated cookies.
        matched = matched.filter((c) => (c.firstPartyDomain ?? "") === "");
      } else if (details.firstPartyDomain !== null) {
        matched = matched.filter(
          (c) => (c.firstPartyDomain ?? "") === details.firstPartyDomain
        );
      }
      if (!("partitionKey" in details)) {
        matched = matched.filter((c) => c.partitionKey === undefined);
      } else if (details.partitionKey?.topLevelSite !== undefined) {
        matched = matched.filter(
          (c) =>
            c.partitionKey?.topLevelSite === details.partitionKey?.topLevelSite
        );
      }
      // partitionKey: {} → no partition filtering at all.
      return Promise.resolve(matched);
    }
  );

  global.browser.cookies.remove.mockImplementation(
    (details: {
      name: string;
      url: string;
      storeId?: string;
      firstPartyDomain?: string;
      partitionKey?: { topLevelSite?: string };
    }) => {
      if (options.firstPartyIsolate && !("firstPartyDomain" in details)) {
        return Promise.reject(
          new Error(
            "First-Party Isolation is enabled, but the required 'firstPartyDomain' attribute was not set."
          )
        );
      }
      const host = hostFromUrl(details.url);
      const index = jar.findIndex(
        (c) =>
          c.name === details.name &&
          domainMatches(c.domain, host) &&
          (details.storeId === undefined || c.storeId === details.storeId) &&
          (c.firstPartyDomain ?? "") === (details.firstPartyDomain ?? "") &&
          (c.partitionKey?.topLevelSite ?? "") ===
            (details.partitionKey?.topLevelSite ?? "")
      );
      if (index === -1) return Promise.resolve(null);
      const [removed] = jar.splice(index, 1);
      return Promise.resolve({
        name: removed.name,
        storeId: removed.storeId,
        url: details.url,
      });
    }
  );

  global.browser.browsingData.remove.mockImplementation(
    (removalOptions: { origins?: string[]; hostnames?: string[] }) => {
      if ("origins" in removalOptions) {
        return Promise.reject(
          new Error('Firefox does not support the "origins" removal option')
        );
      }
      return Promise.resolve(undefined);
    }
  );

  return {
    cookies: jar,
    seed: (...cookies) => {
      jar.push(...cookies);
    },
  };
};
