/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2017-2022 Kenny Do and CAD Team; fork changes (c) 2026 j127.
 * Licensed under MIT (see LICENSE).
 */

/**
 * Ambient declaration for the build-time defines injected by scripts/build.ts
 * via Bun.build's `define` option.
 *
 * In store bundles the identifier is textually replaced with a literal at
 * build time, so each per-browser artifact carries its own constant and the
 * other browser's branches are dead code. Vitest has no build step, so
 * vitest-setup.ts assigns `globalThis.__BROWSER__ = "chrome"` before any
 * src module loads (the identifier then resolves as a global property);
 * Firefox-flavored suites override it per file.
 */
declare const __BROWSER__: "chrome" | "firefox";
