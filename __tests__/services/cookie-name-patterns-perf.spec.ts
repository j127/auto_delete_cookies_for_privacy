/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * Cookie-name patterns (#539) were added on the condition that they don't
 * slow cleanups down. This times one cleanup's keep decisions over a
 * 4,000-cookie jar (cookie-jar.ts) with the old exact `includes` check and
 * with `cookieNamesInclude`, for rules without and with patterns, and
 * fails if the new check makes a cleanup clearly slower.
 *
 * The two checks run in alternating rounds and are compared by their
 * medians, so machine noise hits both alike. The bound is loose on purpose
 * (CI machines are noisy and coverage instruments only the new code); the
 * measured numbers are in the PR. Set ADCP_BENCH=1 to print them:
 *
 *   ADCP_BENCH=1 bunx vitest run __tests__/services/cookie-name-patterns-perf.spec.ts --coverage.enabled=false
 */
import { vi } from "vitest";
import { isSafeToClean } from "@/services/cleanup-service";
import {
  benchCleanupProperties,
  cookieJar,
  exactNamesState,
  patternNamesState,
} from "./cookie-jar";

// Swaps the name check cleanup calls between the old one and the new one,
// so both runs go through the same isSafeToClean.
const check = vi.hoisted(() => ({ old: false }));
vi.mock("@/services/cookie-name-patterns", async (importOriginal) => {
  const real =
    await importOriginal<typeof import("@/services/cookie-name-patterns")>();
  return {
    ...real,
    cookieNamesInclude: (names: readonly string[], name: string) =>
      check.old ? names.includes(name) : real.cookieNamesInclude(names, name),
  };
});

const cleanupDecisions = (state: State): boolean[] =>
  cookieJar.map(
    (cookie) => isSafeToClean(state, cookie, benchCleanupProperties).cleanCookie
  );

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

/** Median milliseconds per cleanup for the old and the new check. */
const timeBoth = (state: State, rounds = 7): { old: number; now: number } => {
  const old: number[] = [];
  const now: number[] = [];
  // Warm-up, so neither side pays for compilation or the first split.
  for (let i = 0; i < 1; i += 1) {
    check.old = true;
    cleanupDecisions(state);
    check.old = false;
    cleanupDecisions(state);
  }
  for (let i = 0; i < rounds; i += 1) {
    for (const useOld of i % 2 === 0 ? [true, false] : [false, true]) {
      check.old = useOld;
      const start = performance.now();
      cleanupDecisions(state);
      (useOld ? old : now).push(performance.now() - start);
    }
  }
  check.old = false;
  return { old: median(old), now: median(now) };
};

const report = (label: string, result: { old: number; now: number }) => {
  if (process.env.ADCP_BENCH) {
    // The test setup silences console, so this writes straight out.
    process.stdout.write(
      `${label}: before ${result.old.toFixed(2)} ms, after ${result.now.toFixed(2)} ms per cleanup of ${cookieJar.length} cookies (${(result.now / result.old).toFixed(2)}x)\n`
    );
  }
};

describe("cleanup cost with cookie-name patterns", () => {
  afterEach(() => {
    check.old = false;
  });

  it("makes the same decisions as the old check for rules without patterns", () => {
    check.old = true;
    const before = cleanupDecisions(exactNamesState);
    check.old = false;
    expect(cleanupDecisions(exactNamesState)).toEqual(before);
    // The jar has kept and cleaned cookies in it, so both sides are timed.
    expect(before.filter((clean) => !clean).length).toBeGreaterThan(0);
    expect(before.filter((clean) => clean).length).toBeGreaterThan(0);
  });

  it("keeps more cookies once rules carry patterns", () => {
    const kept = (decisions: boolean[]) =>
      decisions.filter((clean) => !clean).length;
    expect(kept(cleanupDecisions(patternNamesState))).toBeGreaterThan(
      kept(cleanupDecisions(exactNamesState))
    );
  });

  it("costs about the same as before for rules with exact names only", () => {
    const result = timeBoth(exactNamesState);
    report("exact names only", result);
    expect(result.now).toBeLessThan(result.old * 1.5 + 1);
  }, 60_000);

  it("costs about the same as before for rules with patterns", () => {
    const result = timeBoth(patternNamesState);
    report("5 rules with 5 patterns each", result);
    expect(result.now).toBeLessThan(result.old * 1.5 + 1);
  }, 60_000);

  it("adds little to the name check alone", async () => {
    // The real function, not the swapping wrapper mocked in above.
    const { cookieNamesInclude } = await vi.importActual<
      typeof import("@/services/cookie-name-patterns")
    >("@/services/cookie-name-patterns");
    // Only the name check, for every cookie against a rule's name list,
    // without the rule matching around it: the worst case for overhead.
    const exact = ["_gid", "PHPSESSID", "cookie_consent", "pref_3"];
    const withPatterns = [
      ...exact,
      "auth_*",
      "*_session",
      "__Host-*",
      "_ga_*",
      "cf_*",
    ];
    const names = cookieJar.map((cookie) => cookie.name);
    const timeChecks = (fn: () => void): number => {
      const runs: number[] = [];
      for (let i = 0; i < 9; i += 1) {
        const start = performance.now();
        for (let j = 0; j < 25; j += 1) fn();
        runs.push(performance.now() - start);
      }
      // Nanoseconds per check.
      return (median(runs) * 1e6) / (25 * names.length);
    };
    let hits = 0;
    const oldExact = timeChecks(() => {
      for (const name of names) if (exact.includes(name)) hits += 1;
    });
    const newExact = timeChecks(() => {
      for (const name of names) if (cookieNamesInclude(exact, name)) hits += 1;
    });
    const newPatterns = timeChecks(() => {
      for (const name of names)
        if (cookieNamesInclude(withPatterns, name)) hits += 1;
    });
    expect(hits).toBeGreaterThan(0);
    if (process.env.ADCP_BENCH) {
      process.stdout.write(
        `name check alone: includes ${oldExact.toFixed(1)} ns, cookieNamesInclude ${newExact.toFixed(1)} ns (exact names), ${newPatterns.toFixed(1)} ns (with 5 patterns)\n`
      );
    }
    // Well under a microsecond per cookie even with patterns; a cleanup
    // spends tens of microseconds per cookie on everything else.
    expect(newPatterns).toBeLessThan(1000);
  }, 60_000);
});
