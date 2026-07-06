/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * DaisyUI theme plumbing (Phase 4, #39). The stylesheet registers "light" as
 * the default theme and "dark" as the prefers-color-scheme: dark theme, so
 * "auto" simply means no data-theme attribute on <html> and the browser
 * decides. An explicit user choice is persisted in browser.storage.local as
 * its own top-level key — deliberately NOT a redux Setting, so the theme
 * applies before the UI store finishes hydrating from the service worker
 * (no flash of the wrong theme) and works even if hydration fails.
 *
 * The settings-page switcher (#40) calls setTheme(); both pages call
 * initTheme() at startup, and the storage.onChanged listener keeps an open
 * popup in sync when the choice changes in settings (and vice versa).
 */

export type ThemeChoice = "light" | "dark" | "auto";

export const THEME_STORAGE_KEY = "themeChoice";

/** Anything unknown or unset (including legacy junk) degrades to auto. */
const toThemeChoice = (value: unknown): ThemeChoice =>
  value === "light" || value === "dark" ? value : "auto";

const applyTheme = (choice: ThemeChoice): void => {
  if (choice === "auto") {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = choice;
  }
};

/** Persists an explicit choice and applies it to the current page. */
export const setTheme = async (choice: ThemeChoice): Promise<void> => {
  applyTheme(choice);
  await browser.storage.local.set({ [THEME_STORAGE_KEY]: choice });
};

/**
 * Applies the persisted choice (if any) and subscribes to cross-page
 * changes. Storage failures fall back to auto rather than blocking the UI.
 */
export const initTheme = async (): Promise<void> => {
  browser.storage.onChanged.addListener(
    (changes: { [key: string]: any }, areaName: string) => {
      if (areaName !== "local") return;
      const change = changes[THEME_STORAGE_KEY];
      if (!change) return;
      applyTheme(toThemeChoice(change.newValue));
    }
  );
  try {
    const stored = await browser.storage.local.get(THEME_STORAGE_KEY);
    applyTheme(toThemeChoice(stored[THEME_STORAGE_KEY]));
  } catch {
    applyTheme("auto");
  }
};
