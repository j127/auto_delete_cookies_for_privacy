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
      // Minimum coverage enforcement, floored to whole numbers so any
      // regression fails `just test` while normal churn doesn't flake.
      // Ratcheted at the Firefox-port hardening pass (#289) to the then
      // measured baseline (statements 88.18, branches 85.79, functions
      // 84.93, lines 88.59) — up from the 82/82/77/82 floors set at the
      // #37 runner switch. Ratchet plan: whenever a change meaningfully
      // raises coverage, bump these floors to the new measured baseline;
      // the long-term target is 90 percent across the board.
      thresholds: {
        branches: 85,
        functions: 84,
        lines: 88,
        statements: 88,
      },
    },
    environment: "node",
    globals: true,
    include: ["__tests__/**/*.spec.{ts,tsx}"],
    setupFiles: ["./vitest-setup.ts"],
  },
});
