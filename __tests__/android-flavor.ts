/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * Firefox for Android on top of the Firefox flavor (#534). Android runs the
 * same Firefox build, but its `browser` has no contextualIdentities (from
 * Firefox for Android 138 on), no context menus and no windows API, and
 * runtime.getPlatformInfo reports os "android". Tabs carry no
 * cookieStoreId there (MDN lists tabs.Tab.cookieStoreId as unsupported), so
 * specs build tabs without one.
 *
 * Use per file AFTER stubbing __BROWSER__ to "firefox": the mock tree from
 * __tests__/setup.js is per file, so removing APIs here never leaks into
 * another spec file.
 */
export const installAndroidFlavor = (): void => {
  const b = global.browser as unknown as Record<string, unknown>;
  delete b.contextualIdentities;
  delete b.contextMenus;
  delete b.windows;
  stubAndroidPlatform();
};

/** getPlatformInfo answers like Firefox for Android. Re-run after a reset. */
export const stubAndroidPlatform = (): void => {
  vi.mocked(global.browser.runtime.getPlatformInfo).mockResolvedValue({
    arch: "aarch64",
    os: "android",
  } as never);
};
