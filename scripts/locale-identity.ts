/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * Untranslated-stub detection for the locale gate (#409).
 *
 * New keys are seeded into every locale with the English text so that
 * `just check_locales` (key parity, placeholders, brand) keeps passing
 * while the translations catch up. Nothing used to notice when a seed was
 * never replaced: fifteen keys sat in English in all 31 locales for two
 * releases, covering the Saved-sites list selector, the Firefox
 * containers card and the host-permissions banner.
 *
 * So a value identical to English is now a problem, unless it is listed
 * below as deliberate.
 */

/**
 * Identical in every locale: the brand, the example domain in a
 * placeholder, and the Web Storage / IndexedDB API names, which are
 * spelled the same everywhere they appear in a browser.
 */
export const SAME_AS_EN_EVERYWHERE: readonly string[] = [
  "domainPlaceholderText",
  "extensionName",
  "indexedDBText",
  "localStorageText",
  "sessionStorageText",
];

/**
 * Per locale, on top of the list above: short labels a language really
 * does spell the English way, mostly loanwords ("Cache", "Menu",
 * "Filter") and words French and English share ("Protection").
 *
 * Add a key here only after checking that the English spelling is what
 * that language uses — never to silence a stub. Drop a key from here as
 * soon as the locale gives it its own wording; the gate says so when
 * that happens, because a list that is not true stops being read.
 */
export const SAME_AS_EN: Readonly<Record<string, readonly string[]>> = {
  af: ["filterText"],
  cs: ["cookiesText", "importExportText", "popupCookieCountText"],
  da: [
    "cacheText",
    "cookiesText",
    "filterText",
    "menuText",
    "popupCookieCountText",
    "siteDataSessionCookieText",
    "supportText",
    "themeAutoText",
  ],
  de: [
    "cacheText",
    "cookiesText",
    "filterText",
    "greyListWordText",
    "importExportText",
    "popupCookieCountText",
    "supportText",
    "whiteListWordText",
  ],
  el: ["cacheText", "cookiesText", "popupCookieCountText"],
  es: ["cookiesText", "popupCookieCountText"],
  fr: [
    "cacheText",
    "cookiesText",
    "documentationText",
    "domainExpressionsText",
    "importExportText",
    "menuText",
    "minutesText",
    "popupCookieCountText",
    "protectionText",
    "settingGroupExtension",
    "siteDataSessionCookieText",
    "themeAutoText",
  ],
  gl: ["cookiesText", "popupCookieCountText", "settingGroupExtension"],
  he: ["serviceWorkersText"],
  id: ["cacheText", "filterText", "menuText"],
  it: ["cacheText", "menuText", "patternColumnText", "themeAutoText"],
  nl: [
    "cacheText",
    "cookiesText",
    "domainExpressionsText",
    "filterText",
    "menuText",
    "popupCookieCountText",
    "settingGroupAutoClean",
    "settingGroupExtension",
  ],
  no: ["filterText", "themeAutoText"],
  pl: ["menuText"],
  pt_BR: [
    "cacheText",
    "cookiesText",
    "domainExpressionsText",
    "menuText",
    "popupCookieCountText",
    "settingGroupExtension",
  ],
  pt_PT: [
    "cacheText",
    "cookiesText",
    "domainExpressionsText",
    "menuText",
    "popupCookieCountText",
    "settingGroupExtension",
  ],
  ro: ["cacheText", "domainExpressionsText", "importExportText"],
  sv: [
    "cacheText",
    "filterText",
    "importExportText",
    "siteDataSessionCookieText",
    "supportText",
    "themeAutoText",
  ],
  tr: ["domainExpressionsText"],
  vi: ["menuText"],
};

/** Key to message text, which is all this check looks at. */
export type Messages = Readonly<Record<string, string>>;

export type IdentityReport = {
  /** Keys still holding the English text with no allowance for it. */
  untranslated: string[];
  /** Allowed keys this locale has since translated: drop them. */
  staleAllowances: string[];
  /** Allowed keys that no longer exist in en: drop them too. */
  unknownAllowances: string[];
};

/** Every key this locale may leave in English. */
export const allowedSameAsEn = (locale: string): Set<string> =>
  new Set([...SAME_AS_EN_EVERYWHERE, ...(SAME_AS_EN[locale] ?? [])]);

export const identityReport = (
  locale: string,
  en: Messages,
  messages: Messages
): IdentityReport => {
  const allowed = allowedSameAsEn(locale);
  const listed = SAME_AS_EN[locale] ?? [];
  return {
    untranslated: Object.keys(en).filter(
      (key) => key in messages && messages[key] === en[key] && !allowed.has(key)
    ),
    staleAllowances: listed.filter(
      (key) => key in messages && key in en && messages[key] !== en[key]
    ),
    unknownAllowances: [...SAME_AS_EN_EVERYWHERE, ...listed].filter(
      (key) => !(key in en)
    ),
  };
};
