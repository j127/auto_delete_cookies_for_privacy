import { defineConfig } from "vitest/config";

/**
 * Firefox store-screenshot config (#486) — the same real headless Firefox
 * as vitest.e2e.config.ts, but it runs only e2e/store/, which takes the
 * AMO listing's screenshots instead of testing behaviour. Its files end in
 * .shots.ts, so the e2e suite never picks them up. Run via
 * `just store_screenshots_firefox` (which packages the Firefox zip first).
 */
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    include: ["e2e/store/**/*.shots.ts"],
    fileParallelism: false,
    testTimeout: 120000,
    hookTimeout: 180000,
    environment: "node",
    globals: true,
  },
});
