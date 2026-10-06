import { configDefaults, defineConfig } from "vitest/config";

/**
 * E2E config — real headless Firefox via selenium/geckodriver, so:
 * no coverage, no browser-mock setup file, serial execution (one
 * geckodriver, one profile at a time), and generous timeouts.
 * Run via `just e2e_firefox` (which packages the Firefox zip first).
 */
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    include: ["e2e/**/*.e2e.ts"],
    // The Chromium specs drive Chrome, not Firefox, and have their own
    // config (vitest.e2e-chromium.config.ts, `just e2e_chromium`).
    exclude: [...configDefaults.exclude, "e2e/chromium/**"],
    fileParallelism: false,
    testTimeout: 120000,
    hookTimeout: 120000,
    environment: "node",
    globals: true,
  },
});
