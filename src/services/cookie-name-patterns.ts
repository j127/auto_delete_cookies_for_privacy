/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * Cookie-name patterns for keep rules (#539). A name saved in a rule's
 * `cookieNames` may hold `*`, which matches any run of characters
 * (including none); `\*` stands for a literal asterisk. A backslash before
 * anything else is an ordinary character. There is no regular-expression
 * form. A name without `*` matches exactly, as it always has, so rules
 * saved before patterns existed behave the same.
 *
 * Cleanup checks every cookie in the browser against its rule, so this
 * runs once per cookie per cleanup. To keep that as cheap as the exact
 * `includes` it replaces:
 *
 * - each `cookieNames` array is split once (cached per array) into exact
 *   names and compiled patterns; an array without `*` is used as it is,
 *   so a rule with no patterns does the same `includes` as before, after
 *   one WeakMap lookup;
 * - a compiled pattern is its literal pieces between the wildcards, and
 *   matching is a prefix check, a suffix check and a left-to-right
 *   `indexOf` for each middle piece. Taking the leftmost place for each
 *   piece is always right when the only wildcard is `*`, so nothing
 *   backtracks and no RegExp is built.
 */

/** A pattern split at its wildcards; only built for names holding `*`. */
interface CompiledPattern {
  /** Literal text before the first wildcard. */
  readonly prefix: string;
  /** Literal pieces between wildcards, in order; empty pieces dropped. */
  readonly middles: readonly string[];
  /** Literal text after the last wildcard. */
  readonly suffix: string;
  /** Shortest name that can match: every literal piece once. */
  readonly minLength: number;
}

/** A `cookieNames` array split for matching. */
interface CompiledNames {
  /** Names matched by plain comparison (escapes already removed). */
  readonly exact: readonly string[];
  readonly patterns: readonly CompiledPattern[];
}

/**
 * Splits a name at its unescaped `*` into literal pieces, turning `\*`
 * into `*`. One piece means the name has no wildcard.
 */
const splitAtWildcards = (pattern: string): string[] => {
  const pieces: string[] = [];
  let current = "";
  for (let i = 0; i < pattern.length; i += 1) {
    const ch = pattern[i];
    if (ch === "\\" && pattern[i + 1] === "*") {
      current += "*";
      i += 1;
    } else if (ch === "*") {
      pieces.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  pieces.push(current);
  return pieces;
};

/**
 * True when the name holds an unescaped `*`, so it matches more than one
 * cookie name.
 */
export const isCookieNamePattern = (name: string): boolean =>
  name.includes("*") && splitAtWildcards(name).length > 1;

const compile = (pieces: string[]): CompiledPattern => {
  const prefix = pieces[0];
  const suffix = pieces[pieces.length - 1];
  const middles = pieces.slice(1, -1).filter((piece) => piece !== "");
  return {
    prefix,
    middles,
    suffix,
    minLength:
      prefix.length +
      suffix.length +
      middles.reduce((sum, piece) => sum + piece.length, 0),
  };
};

const matchesCompiled = (compiled: CompiledPattern, name: string): boolean => {
  const { prefix, middles, suffix, minLength } = compiled;
  if (name.length < minLength) return false;
  if (!name.startsWith(prefix) || !name.endsWith(suffix)) return false;
  // Middle pieces must fit, in order, between the prefix and the suffix.
  let from = prefix.length;
  const end = name.length - suffix.length;
  for (const piece of middles) {
    const at = name.indexOf(piece, from);
    if (at === -1 || at + piece.length > end) return false;
    from = at + piece.length;
  }
  return true;
};

// Compiled single patterns for the UI and tests. Rule lists are short, so
// the cap only guards against a page that renders many throwaway names.
const PATTERN_CACHE_LIMIT = 256;
const patternCache = new Map<string, CompiledPattern | string>();

const compileOne = (pattern: string): CompiledPattern | string => {
  let compiled = patternCache.get(pattern);
  if (compiled === undefined) {
    const pieces = splitAtWildcards(pattern);
    compiled = pieces.length === 1 ? pieces[0] : compile(pieces);
    if (patternCache.size >= PATTERN_CACHE_LIMIT) patternCache.clear();
    patternCache.set(pattern, compiled);
  }
  return compiled;
};

/**
 * Whether one saved cookie name (or pattern) covers a cookie's name. A
 * pattern without `*` is a plain comparison.
 */
export const cookieNameMatches = (pattern: string, name: string): boolean => {
  if (!pattern.includes("*")) return pattern === name;
  const compiled = compileOne(pattern);
  return typeof compiled === "string"
    ? compiled === name
    : matchesCompiled(compiled, name);
};

// Keyed by the rule's own array, so it is split once and dropped with the
// rule. The reducer always stores a new array when the names change.
const namesCache = new WeakMap<readonly string[], CompiledNames>();

const compileNames = (cookieNames: readonly string[]): CompiledNames => {
  // Without `*` the list is used as it is: the same `includes` as before.
  if (!cookieNames.some((name) => name.includes("*"))) {
    return { exact: cookieNames, patterns: [] };
  }
  const exact: string[] = [];
  const patterns: CompiledPattern[] = [];
  for (const name of cookieNames) {
    const pieces = splitAtWildcards(name);
    if (pieces.length === 1) exact.push(pieces[0]);
    else patterns.push(compile(pieces));
  }
  return { exact, patterns };
};

/**
 * Whether a rule's `cookieNames` keeps a cookie of this name: an exact
 * entry equals it or a pattern entry matches it. Replaces
 * `cookieNames.includes(name)` in cleanup.
 */
export const cookieNamesInclude = (
  cookieNames: readonly string[],
  name: string
): boolean => {
  // One WeakMap lookup per cookie; measured cheaper than scanning the
  // list for `*` each time.
  let compiled = namesCache.get(cookieNames);
  if (compiled === undefined) {
    compiled = compileNames(cookieNames);
    namesCache.set(cookieNames, compiled);
  }
  if (compiled.exact.includes(name)) return true;
  for (const pattern of compiled.patterns) {
    if (matchesCompiled(pattern, name)) return true;
  }
  return false;
};
