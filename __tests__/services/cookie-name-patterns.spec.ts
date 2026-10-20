/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * Issue #539: a cookie name in a keep rule may be a pattern with `*`
 * (`auth_*`), and `\*` is a literal asterisk. Names without `*` still
 * match exactly.
 */
import { initialState } from "@/redux/state";
import { isSafeToClean, prepareCookie } from "@/services/cleanup-service";
import {
  cookieNameMatches,
  cookieNamesInclude,
  escapeCookieName,
  escapeLegacyCookieNames,
  isCookieNamePattern,
} from "@/services/cookie-name-patterns";
import { ListType, ReasonClean, ReasonKeep } from "@/typings/enums";

describe("cookieNameMatches", () => {
  it.each([
    // [pattern, name, expected]
    ["sid", "sid", true],
    ["sid", "SID", false],
    ["sid", "sid2", false],
    ["sid", "", false],
    ["", "", true],
    ["", "a", false],
    ["*", "", true],
    ["*", "anything", true],
    ["**", "", true],
    ["**", "x", true],
    ["***", "abc", true],
    ["auth_*", "auth_", true],
    ["auth_*", "auth_session", true],
    ["auth_*", "auth", false],
    ["auth_*", "xauth_session", false],
    ["auth_*", "AUTH_session", false],
    ["*_session", "user_session", true],
    ["*_session", "_session", true],
    ["*_session", "user_session2", false],
    ["a*b", "ab", true],
    ["a*b", "axxb", true],
    ["a*b", "axxbc", false],
    ["a*a", "a", false],
    ["a*a", "aa", true],
    ["a*b*c", "abc", true],
    ["a*b*c", "a__b__c", true],
    ["a*b*c", "acb", false],
    ["a*b*c", "abbc", true],
    ["a*bc*bc", "abcbc", true],
    ["a*bc*bc", "abc", false],
    ["*ab*ab*", "ab", false],
    ["*ab*ab*", "abab", true],
    ["*ab*ab*", "xabyabz", true],
    ["a**b", "ab", true],
    ["a**b", "a-b", true],
    ["__Host-*", "__Host-sid", true],
    ["__Secure-*", "__Host-sid", false],
    // \* is a literal asterisk
    ["a\\*b", "a*b", true],
    ["a\\*b", "axb", false],
    ["a\\*b", "a\\*b", false],
    ["\\*", "*", true],
    ["\\*", "x", false],
    ["\\**", "*", true],
    ["\\**", "*abc", true],
    ["\\**", "abc", false],
    ["*\\*", "abc*", true],
    ["*\\*", "abc", false],
    // A backslash before anything else is an ordinary character
    ["a\\b", "a\\b", true],
    ["a\\b*", "a\\bc", true],
    ["a\\", "a\\", true],
    ["a*\\", "abc\\", true],
    ["\\\\*", "\\*", true],
    ["\\\\*", "\\x", false],
    // Unicode
    ["café_*", "café_au_lait", true],
    ["*_日本", "名前_日本", true],
    ["🍪*", "🍪jar", true],
    ["*🍪", "jar🍪", true],
    ["a*🍪*z", "a-🍪-z", true],
    ["a*🍪*z", "a-z", false],
    ["ß*", "SS", false],
  ])("%j matches %j: %s", (pattern, name, expected) => {
    expect(cookieNameMatches(pattern, name)).toBe(expected);
  });

  it("gives the same answer when a compiled pattern is reused", () => {
    expect(cookieNameMatches("cache_*", "cache_hit")).toBe(true);
    expect(cookieNameMatches("cache_*", "cache_hit")).toBe(true);
    expect(cookieNameMatches("cache_*", "miss")).toBe(false);
  });

  it("keeps working after the pattern cache fills up and is cleared", () => {
    for (let i = 0; i < 600; i += 1) {
      expect(cookieNameMatches(`p${i}_*`, `p${i}_x`)).toBe(true);
    }
    expect(cookieNameMatches("p0_*", "p0_y")).toBe(true);
  });

  it("matches a long name in linear time, without backtracking", () => {
    // A classic backtracking trap for naive glob matchers.
    const name = "a".repeat(4096);
    const pattern = `${"a*".repeat(50)}b`;
    const start = performance.now();
    expect(cookieNameMatches(pattern, name)).toBe(false);
    expect(performance.now() - start).toBeLessThan(250);
  });
});

describe("cookieNameMatches against a RegExp reference", () => {
  // The reference reads the pattern the same way, but builds an anchored
  // RegExp, which is fine for a test and too slow for cleanup.
  const reference = (pattern: string, name: string): boolean => {
    let source = "";
    for (let i = 0; i < pattern.length; i += 1) {
      if (pattern[i] === "\\" && pattern[i + 1] === "*") {
        source += "\\*";
        i += 1;
      } else if (pattern[i] === "*") {
        source += "[\\s\\S]*";
      } else {
        source += pattern[i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      }
    }
    return new RegExp(`^${source}$`).test(name);
  };

  // A small seeded generator, so a failure always reproduces.
  let seed = 539;
  const next = (): number => {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    return seed / 4294967296;
  };
  const randomString = (alphabet: string[], maxLength: number): string => {
    const length = Math.floor(next() * (maxLength + 1));
    let out = "";
    for (let i = 0; i < length; i += 1) {
      out += alphabet[Math.floor(next() * alphabet.length)];
    }
    return out;
  };

  it("agrees on 20,000 random patterns and names", () => {
    const patternAlphabet = ["a", "b", "*", "\\", "é"];
    const nameAlphabet = ["a", "b", "*", "\\", "é"];
    for (let i = 0; i < 20000; i += 1) {
      const pattern = randomString(patternAlphabet, 7);
      const name = randomString(nameAlphabet, 9);
      const expected = reference(pattern, name);
      if (cookieNameMatches(pattern, name) !== expected) {
        throw new Error(
          `${JSON.stringify(pattern)} vs ${JSON.stringify(name)}: expected ${expected}`
        );
      }
      expect(cookieNamesInclude([pattern], name)).toBe(expected);
    }
  });
});

describe("isCookieNamePattern", () => {
  it.each([
    ["sid", false],
    ["", false],
    ["*", true],
    ["auth_*", true],
    ["a\\*b", false],
    ["\\*", false],
    ["\\**", true],
    ["a\\b", false],
  ])("%j: %s", (name, expected) => {
    expect(isCookieNamePattern(name)).toBe(expected);
  });
});

describe("cookieNamesInclude", () => {
  it("does an exact match for a list without patterns", () => {
    const names = ["sid", "theme"];
    expect(cookieNamesInclude(names, "sid")).toBe(true);
    expect(cookieNamesInclude(names, "si")).toBe(false);
    expect(cookieNamesInclude(names, "sid2")).toBe(false);
    expect(cookieNamesInclude([], "sid")).toBe(false);
  });

  it("matches exact names and patterns in the same list", () => {
    const names = ["theme", "auth_*", "*_csrf", "a\\*b"];
    expect(cookieNamesInclude(names, "theme")).toBe(true);
    expect(cookieNamesInclude(names, "auth_token")).toBe(true);
    expect(cookieNamesInclude(names, "form_csrf")).toBe(true);
    expect(cookieNamesInclude(names, "a*b")).toBe(true);
    expect(cookieNamesInclude(names, "a\\*b")).toBe(false);
    expect(cookieNamesInclude(names, "axb")).toBe(false);
    expect(cookieNamesInclude(names, "session")).toBe(false);
  });

  it("does not treat an escaped entry as the text it was typed as", () => {
    // `\*x` names the cookie `*x`, not one literally called `\*x`.
    expect(cookieNamesInclude(["\\*x"], "*x")).toBe(true);
    expect(cookieNamesInclude(["\\*x"], "\\*x")).toBe(false);
  });

  it("answers from the cached split when called again with the same array", () => {
    const names = ["auth_*"];
    expect(cookieNamesInclude(names, "auth_a")).toBe(true);
    expect(cookieNamesInclude(names, "auth_b")).toBe(true);
    expect(cookieNamesInclude(names, "other")).toBe(false);
  });

  it("sees a rule's new names, because the reducer stores a new array", () => {
    const before = ["sid"];
    expect(cookieNamesInclude(before, "auth_a")).toBe(false);
    const after = [...before, "auth_*"];
    expect(cookieNamesInclude(after, "auth_a")).toBe(true);
  });
});

describe("escapeCookieName", () => {
  it.each(["*", "a*b", "**", "a\\b", "a\\*b", "plain", ""])(
    "makes an entry that matches %j and nothing else",
    (name) => {
      const entry = escapeCookieName(name);
      expect(isCookieNamePattern(entry)).toBe(false);
      expect(cookieNameMatches(entry, name)).toBe(true);
      expect(cookieNameMatches(entry, `${name}x`)).toBe(false);
    }
  );

  it("leaves a name without * unchanged", () => {
    expect(escapeCookieName("sid")).toBe("sid");
  });
});

describe("escapeLegacyCookieNames", () => {
  const rule = (id: string, cookieNames?: string[]): Expression => ({
    cleanAllCookies: false,
    cookieNames,
    expression: `${id}.example`,
    id,
    listType: ListType.WHITE,
    storeId: "default",
  });

  it("escapes every name of a rule that saved a * as part of a name", () => {
    const updates = escapeLegacyCookieNames({
      default: [rule("a", ["sid", "*"]), rule("b", ["theme"])],
      private: [rule("c", ["odd*name", "x\\*y"])],
    });
    expect(updates).toEqual([
      { ...rule("a"), cookieNames: ["sid", "\\*"] },
      { ...rule("c"), cookieNames: ["odd\\*name", "x\\\\*y"] },
    ]);
  });

  it("keeps each escaped rule keeping only the cookie it named", () => {
    const [escaped] = escapeLegacyCookieNames({
      default: [rule("a", ["*", "x\\*y"])],
    });
    const names = escaped.cookieNames as string[];
    expect(cookieNamesInclude(names, "*")).toBe(true);
    expect(cookieNamesInclude(names, "x\\*y")).toBe(true);
    expect(cookieNamesInclude(names, "anything")).toBe(false);
    expect(cookieNamesInclude(names, "x*y")).toBe(false);
  });

  it("returns nothing when no saved name has *", () => {
    expect(
      escapeLegacyCookieNames({
        default: [rule("a", ["sid"]), rule("b"), rule("c", [])],
      })
    ).toEqual([]);
    expect(escapeLegacyCookieNames({})).toEqual([]);
  });
});

describe("isSafeToClean with cookie-name patterns", () => {
  const rule = (listType: ListType, cookieNames: string[]): Expression => ({
    cleanAllCookies: false,
    cookieNames,
    expression: "example.com",
    id: `${listType}-rule`,
    listType,
    storeId: "default",
  });
  const withRule = (expression: Expression): State => ({
    ...initialState,
    lists: { default: [expression] },
  });
  const cookieNamed = (name: string): CookiePropertiesCleanup =>
    prepareCookie({
      domain: "example.com",
      hostOnly: true,
      httpOnly: false,
      name,
      path: "/",
      sameSite: "no_restriction",
      secure: true,
      session: false,
      storeId: "0",
      value: "v",
    });
  const normal = {
    greyCleanup: false,
    ignoreOpenTabs: true,
    openTabDomains: {},
  };
  const startup = { ...normal, greyCleanup: true };

  describe("normal cleanup (Keep rule)", () => {
    const state = withRule(rule(ListType.WHITE, ["theme", "auth_*"]));

    it("keeps a cookie a pattern covers", () => {
      const result = isSafeToClean(state, cookieNamed("auth_9f3c"), normal);
      expect(result.cleanCookie).toBe(false);
      expect(result.reason).toBe(ReasonKeep.MatchedExpression);
    });

    it("keeps a cookie named exactly", () => {
      const result = isSafeToClean(state, cookieNamed("theme"), normal);
      expect(result.cleanCookie).toBe(false);
    });

    it("cleans a cookie neither covers", () => {
      const result = isSafeToClean(state, cookieNamed("tracker"), normal);
      expect(result.cleanCookie).toBe(true);
      expect(result.reason).toBe(ReasonClean.MatchedExpressionButNoCookieName);
    });

    it("still matches a plain name exactly, as rules saved before patterns did", () => {
      const plain = withRule(rule(ListType.WHITE, ["auth"]));
      expect(
        isSafeToClean(plain, cookieNamed("auth"), normal).cleanCookie
      ).toBe(false);
      expect(
        isSafeToClean(plain, cookieNamed("auth_x"), normal).cleanCookie
      ).toBe(true);
    });
  });

  describe("startup cleanup (Keep until browser closes rule)", () => {
    const state = withRule(rule(ListType.GREY, ["auth_*"]));

    it("keeps a covered cookie, at startup too", () => {
      expect(
        isSafeToClean(state, cookieNamed("auth_9f3c"), normal).cleanCookie
      ).toBe(false);
      const atStartup = isSafeToClean(state, cookieNamed("auth_9f3c"), startup);
      expect(atStartup.cleanCookie).toBe(false);
      expect(atStartup.reason).toBe(ReasonKeep.MatchedExpression);
    });

    it("cleans an uncovered cookie at startup", () => {
      const result = isSafeToClean(state, cookieNamed("tracker"), startup);
      expect(result.cleanCookie).toBe(true);
      expect(result.reason).toBe(ReasonClean.StartupCleanupAndGreyList);
    });
  });
});
