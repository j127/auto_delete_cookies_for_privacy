import { defineConfig } from "vitest/config";

export default defineConfig({
  // Resolves the tsconfig "@/*" paths alias natively (no plugin needed).
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    // Mirrors the old jest clearMocks: true.
    clearMocks: true,
    coverage: {
      enabled: true,
      include: ["src/**"],
      provider: "v8",
      reporter: ["text", "lcov"],
      // Minimum coverage enforcement. Values are the v8-provider baseline
      // measured at the #37 runner switch (statements 82.29, branches 82.95,
      // functions 77.18, lines 82.48 — v8 counts slightly differently than
      // ts-jest's istanbul did, hence the small re-base from the old
      // 83/85/77/82 floors) floored to whole numbers, so any regression
      // fails `just test` while normal churn doesn't flake. Ratchet plan:
      // whenever a change meaningfully raises coverage, bump these floors to
      // the new measured baseline; the long-term target is 90 percent across
      // the board.
      thresholds: {
        branches: 82,
        functions: 77,
        lines: 82,
        statements: 82,
      },
    },
    environment: "node",
    globals: true,
    include: ["__tests__/**/*.spec.{ts,tsx}"],
    setupFiles: ["./vitest-setup.ts"],
  },
});
