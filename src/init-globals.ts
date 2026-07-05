/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2017-2022 Kenny Do and CAD Team; fork changes (c) 2026 j127.
 * Licensed under MIT (see LICENSE).
 */

/**
 * Provides the ambient globals (`browser`, `browserDetect`) that Manifest V2
 * supplied through loose <script> tags in extension/global_files/. Every
 * bundle entry point must import this module FIRST so the globals exist
 * before any other module runs. Jest keeps providing its own stubs via
 * __tests__/setup.js, which is why nothing else imports these directly.
 */
import browserPolyfill from "webextension-polyfill";
import browserDetectImpl from "./services/browser-detect";

(globalThis as any).browser = browserPolyfill;
(globalThis as any).browserDetect = browserDetectImpl;
