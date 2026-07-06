/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * Sets the document direction and language from the browser's UI locale so
 * layouts mirror correctly in right-to-left languages (Hebrew, Arabic).
 * Chrome exposes the predefined i18n messages @@bidi_dir ("ltr"/"rtl") and
 * @@ui_locale for this. Both page entries call this before render; if the
 * i18n API is unavailable (tests, harnesses) the document defaults stand.
 */
export const initPageDirection = (): void => {
  try {
    const dir = browser.i18n.getMessage("@@bidi_dir");
    if (dir === "ltr" || dir === "rtl") {
      document.documentElement.dir = dir;
    }
    const locale = browser.i18n.getMessage("@@ui_locale");
    if (locale) {
      document.documentElement.lang = locale.replace(/_/g, "-");
    }
  } catch {
    // i18n unavailable: leave the document's defaults (ltr) in place.
  }
};
