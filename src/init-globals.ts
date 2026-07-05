/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2017-2022 Kenny Do and CAD Team; fork changes (c) 2026 j127.
 * Licensed under MIT (see LICENSE).
 */

/**
 * Provides the ambient `browser` global that Manifest V2 supplied through
 * loose <script> tags in extension/global_files/. Every bundle entry point
 * must import this module FIRST so the global exists before any other module
 * runs. Jest keeps providing its own stubs via __tests__/setup.js, which is
 * why nothing else imports this directly.
 */
import browserPolyfill from "webextension-polyfill";

(globalThis as any).browser = browserPolyfill;
