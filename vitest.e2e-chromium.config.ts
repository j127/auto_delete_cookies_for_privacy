import { defineConfig } from "vitest/config";

/**
 * Chromium E2E config — Chrome for Testing driven over CDP
 * (e2e/helpers/chrome_cdp.ts), so: no coverage, no browser-mock setup
 * file, serial execution (one browser at a time, each spec file with its
 * own profile), and generous timeouts. Its specs live in e2e/chromium/,
 * which the Firefox config leaves out. Run via `just e2e_chromium` (which
 * builds the extension first).
 */
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    include: ["e2e/chromium/**/*.e2e.ts"],
    fileParallelism: false,
    testTimeout: 120000,
    hookTimeout: 180000,
    environment: "node",
    globals: true,
  },
});
