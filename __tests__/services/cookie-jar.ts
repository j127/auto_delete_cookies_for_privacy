/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * A realistic cookie jar and keep-rule set for the cookie-name pattern
 * timing spec (#539, cookie-name-patterns-perf.spec.ts).
 *
 * - 400 sites with 10 cookies each: 4,000 cookies, which is a heavy but
 *   real browser profile.
 * - 60 Keep rules. 20 of them keep only named cookies (four exact names
 *   each). In the patterns variant, 5 of those 20 also carry a handful of
 *   patterns, which is about what a user who has found the feature would
 *   add.
 */
import { initialState } from "@/redux/state";
import { prepareCookie } from "@/services/cleanup-service";
import { ListType } from "@/typings/enums";

const SITES = 400;
const COOKIES_PER_SITE = 10;
const RULES = 60;
const NAMED_RULES = 20;
const PATTERN_RULES = 5;

const site = (i: number): string => `site${i}.example`;

// Cookie names as real sites set them: analytics, consent, session ids
// with changing suffixes, and __Host- prefixes.
const cookieNameFor = (siteIndex: number, j: number): string =>
  [
    "_ga",
    `_ga_${(siteIndex * 7919).toString(36).toUpperCase()}`,
    "_gid",
    `auth_${(siteIndex * 104729 + j).toString(16)}`,
    "PHPSESSID",
    "cookie_consent",
    `user_session`,
    "__Host-csrf",
    `cf_clearance`,
    `pref_${j}`,
  ][j];

export const cookieJar: CookiePropertiesCleanup[] = Array.from(
  { length: SITES * COOKIES_PER_SITE },
  (_, k) => {
    const siteIndex = Math.floor(k / COOKIES_PER_SITE);
    const j = k % COOKIES_PER_SITE;
    return prepareCookie({
      domain: site(siteIndex),
      hostOnly: true,
      httpOnly: false,
      name: cookieNameFor(siteIndex, j),
      path: "/",
      sameSite: "no_restriction",
      secure: true,
      session: false,
      storeId: "0",
      value: "v",
    });
  }
);

const keepRules = (withPatterns: boolean): Expression[] =>
  Array.from({ length: RULES }, (_, i) => {
    const base: Expression = {
      expression: site(i * 5),
      id: `rule-${i}`,
      listType: ListType.WHITE,
      storeId: "default",
    };
    if (i >= NAMED_RULES) return base;
    const exact = ["_gid", "PHPSESSID", "cookie_consent", "pref_3"];
    const patterns =
      withPatterns && i < PATTERN_RULES
        ? ["auth_*", "*_session", "__Host-*", "_ga_*", "cf_*"]
        : [];
    return {
      ...base,
      cleanAllCookies: false,
      cookieNames: [...exact, ...patterns],
    };
  });

const stateWith = (rules: Expression[]): State => ({
  ...initialState,
  lists: { default: rules },
});

/** Keep rules with exact cookie names only: the shape every rule has today. */
export const exactNamesState = stateWith(keepRules(false));

/** The same rules, five of which also keep a handful of patterns. */
export const patternNamesState = stateWith(keepRules(true));

/** A normal (not startup) cleanup that ignores open tabs. */
export const benchCleanupProperties = {
  greyCleanup: false,
  ignoreOpenTabs: true,
  openTabDomains: {},
};
