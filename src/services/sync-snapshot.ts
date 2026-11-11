/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * The data half of keep-list sync (#587): what a device writes into the
 * browser's sync storage, and how another device reads it back. Pure
 * functions only; sync-service.ts does the storage and store work.
 *
 * A snapshot (format 1) is one JSON document:
 *
 *   { "v": 1, "lists": { "default": [rule, ...] }, "settings": { name: value } }
 *
 * Rules are stored compactly: no id (each device makes its own), no storeId
 * (the list key says it), and fields at their defaults left out. The JSON is
 * split into chunks small enough for the per-item quota, and a meta item
 * carries the checksum that tells a reader all chunks have arrived.
 */
import { ListType, SettingID, SiteDataType } from "@/typings/enums";
import { initialState } from "@/redux/state";

export const SYNC_FORMAT_VERSION = 1;

/** storage.local: what the settings page shows about sync. */
export const SYNC_STATUS_KEY = "syncStatus";

/** The sync state the background records for the settings page. */
export type SyncStatus =
  | { state: "ok"; at: number }
  | { state: "tooLarge"; bytes: number; quota: number }
  | { state: "newerVersion" }
  | { state: "error"; message: string };

/**
 * The lists that sync. Only the main list: the private list is erased
 * whenever private browsing ends, and Firefox container ids
 * (firefox-container-N) name different containers on different devices.
 */
export const SYNCED_LISTS: ReadonlyArray<string> = ["default"];

/**
 * The settings that travel with the keep list. An allowlist on purpose, so a
 * setting added later stays on its device until someone decides it should
 * sync. Deliberately left out:
 * - automatic cleaning on/off and the pause (pausing one computer must not
 *   switch the others off, and a synced pause would never resume there)
 * - the sync switch itself (each device opts in on its own)
 * - "empty site data on enable" (it erases data, so it stays a local choice)
 * - debug mode, popup/settings text size, and the update notice
 * - deprecated settings
 */
export const SYNCED_SETTINGS: ReadonlyArray<SettingID> = [
  SettingID.CLEAN_DELAY,
  SettingID.CLEAN_DISCARDED,
  SettingID.CLEAN_DOMAIN_CHANGE,
  SettingID.CLEAN_EXPIRED,
  SettingID.CLEAN_OPEN_TABS_STARTUP,
  SettingID.CLEANUP_CACHE,
  SettingID.CLEANUP_INDEXEDDB,
  SettingID.CLEANUP_LOCALSTORAGE,
  SettingID.CLEANUP_PLUGINDATA,
  SettingID.CLEANUP_SERVICEWORKERS,
  SettingID.CONTEXT_MENUS,
  SettingID.CONTEXTUAL_IDENTITIES,
  SettingID.CONTEXTUAL_IDENTITIES_AUTOREMOVE,
  SettingID.ENABLE_GREYLIST,
  SettingID.KEEP_DEFAULT_ICON,
  SettingID.NOTIFY_AUTO,
  SettingID.NOTIFY_DURATION,
  SettingID.NOTIFY_MANUAL,
  SettingID.NUM_COOKIES_ICON,
  SettingID.POPUP_ADVANCED,
  SettingID.STAT_LOGGING,
];

export type CompactRule = {
  /** expression */
  e: string;
  /** list type: W = Keep, G = Keep until browser closes */
  t: "W" | "G";
  /** cookieNames, when not empty */
  c?: string[];
  /** cleanSiteData, when not empty */
  s?: string[];
  /** cleanAllCookies, only when the rule sets it (undefined means "clean all") */
  a?: boolean;
  /** cleanLocalStorage, the pre-3.4.0 field, only when the rule still has it */
  l?: boolean;
};

export type SettingValue = boolean | number | string;

export type SyncSnapshot = {
  v: number;
  lists: { [listKey: string]: CompactRule[] };
  settings: { [name: string]: SettingValue };
};

export type ParseResult =
  | { ok: true; snapshot: SyncSnapshot }
  | { ok: false; reason: "invalid" | "newer" };

const SITE_DATA_TYPES = new Set<string>(Object.values(SiteDataType));

const compactRule = (rule: Expression): CompactRule => {
  const compact: CompactRule = {
    e: rule.expression,
    t: rule.listType === ListType.GREY ? "G" : "W",
  };
  if (rule.cookieNames && rule.cookieNames.length > 0) {
    compact.c = [...rule.cookieNames];
  }
  if (rule.cleanSiteData && rule.cleanSiteData.length > 0) {
    compact.s = [...rule.cleanSiteData].sort();
  }
  if (typeof rule.cleanAllCookies === "boolean") {
    compact.a = rule.cleanAllCookies;
  }
  if (typeof rule.cleanLocalStorage === "boolean") {
    compact.l = rule.cleanLocalStorage;
  }
  return compact;
};

/** Rebuilds a rule with its fields in one fixed order, for stable JSON. */
const canonicalRule = (rule: CompactRule): CompactRule => {
  const out: CompactRule = { e: rule.e, t: rule.t };
  if (rule.c !== undefined && rule.c.length > 0) out.c = [...rule.c];
  if (rule.s !== undefined && rule.s.length > 0) out.s = [...rule.s].sort();
  if (rule.a !== undefined) out.a = rule.a;
  if (rule.l !== undefined) out.l = rule.l;
  return out;
};

const byExpression = (a: CompactRule, b: CompactRule): number =>
  a.e < b.e ? -1 : a.e > b.e ? 1 : 0;

/**
 * Puts a snapshot in canonical form: lists in SYNCED_LISTS order, rules
 * sorted by expression with one rule per expression, settings in
 * SYNCED_SETTINGS order. Two devices holding the same data then produce the
 * same JSON and the same checksum.
 */
export const canonicalSnapshot = (snapshot: SyncSnapshot): SyncSnapshot => {
  const lists: SyncSnapshot["lists"] = {};
  for (const key of SYNCED_LISTS) {
    const seen = new Set<string>();
    lists[key] = (snapshot.lists[key] ?? [])
      .filter((rule) => {
        if (seen.has(rule.e)) return false;
        seen.add(rule.e);
        return true;
      })
      .map(canonicalRule)
      .sort(byExpression);
  }
  const settings: SyncSnapshot["settings"] = {};
  for (const name of SYNCED_SETTINGS) {
    if (snapshot.settings[name] !== undefined) {
      settings[name] = snapshot.settings[name];
    }
  }
  return { v: SYNC_FORMAT_VERSION, lists, settings };
};

/** The synced part of this device's state. */
export const buildSnapshot = (state: State): SyncSnapshot => {
  const lists: SyncSnapshot["lists"] = {};
  for (const key of SYNCED_LISTS) {
    lists[key] = (state.lists[key] ?? []).map(compactRule);
  }
  const settings: SyncSnapshot["settings"] = {};
  for (const name of SYNCED_SETTINGS) {
    const setting = state.settings[name];
    if (setting !== undefined) settings[name] = setting.value;
  }
  return canonicalSnapshot({ v: SYNC_FORMAT_VERSION, lists, settings });
};

export const serializeSnapshot = (snapshot: SyncSnapshot): string =>
  JSON.stringify(canonicalSnapshot(snapshot));

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

/** Reads one stored rule; null when it can't be a rule. */
const readRule = (value: unknown): CompactRule | null => {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.e !== "string" || raw.e.trim() === "") return null;
  if (raw.t !== "W" && raw.t !== "G") return null;
  const rule: CompactRule = { e: raw.e, t: raw.t };
  if (raw.c !== undefined) {
    if (!isStringArray(raw.c)) return null;
    rule.c = raw.c;
  }
  if (raw.s !== undefined) {
    if (!isStringArray(raw.s)) return null;
    // A site-data type this version doesn't know is dropped, not fatal.
    rule.s = raw.s.filter((type) => SITE_DATA_TYPES.has(type));
  }
  if (raw.a !== undefined) {
    if (typeof raw.a !== "boolean") return null;
    rule.a = raw.a;
  }
  if (raw.l !== undefined) {
    if (typeof raw.l !== "boolean") return null;
    rule.l = raw.l;
  }
  return rule;
};

/**
 * Reads a stored snapshot. A snapshot from a newer format is reported as
 * such (the caller must not overwrite it); anything malformed is "invalid".
 * Rules that can't be read are skipped, and settings are taken only when
 * they are on the allowlist and have the type the setting has here.
 */
export const parseSnapshot = (text: string): ParseResult => {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, reason: "invalid" };
  }
  const data = raw as Record<string, unknown>;
  if (typeof data.v !== "number" || !Number.isInteger(data.v) || data.v < 1) {
    return { ok: false, reason: "invalid" };
  }
  if (data.v > SYNC_FORMAT_VERSION) return { ok: false, reason: "newer" };
  if (
    typeof data.lists !== "object" ||
    data.lists === null ||
    typeof data.settings !== "object" ||
    data.settings === null
  ) {
    return { ok: false, reason: "invalid" };
  }
  const rawLists = data.lists as Record<string, unknown>;
  const rawSettings = data.settings as Record<string, unknown>;

  const lists: SyncSnapshot["lists"] = {};
  for (const key of SYNCED_LISTS) {
    const rawList = rawLists[key];
    if (rawList === undefined) {
      lists[key] = [];
      continue;
    }
    if (!Array.isArray(rawList)) return { ok: false, reason: "invalid" };
    lists[key] = rawList
      .map(readRule)
      .filter((rule): rule is CompactRule => rule !== null);
  }

  const settings: SyncSnapshot["settings"] = {};
  for (const name of SYNCED_SETTINGS) {
    const value = rawSettings[name];
    const expected = typeof initialState.settings[name]?.value;
    if (value !== undefined && typeof value === expected) {
      settings[name] = value as SettingValue;
    }
  }
  return {
    ok: true,
    snapshot: canonicalSnapshot({ v: SYNC_FORMAT_VERSION, lists, settings }),
  };
};

/**
 * The first sync on a device that already has rules: keep everything from
 * both sides. A rule on both sides (same expression) takes the synced
 * version, and synced settings win over local ones.
 */
export const mergeSnapshots = (
  local: SyncSnapshot,
  remote: SyncSnapshot
): SyncSnapshot => {
  const lists: SyncSnapshot["lists"] = {};
  for (const key of SYNCED_LISTS) {
    const byExpr = new Map<string, CompactRule>();
    for (const rule of local.lists[key] ?? []) byExpr.set(rule.e, rule);
    for (const rule of remote.lists[key] ?? []) byExpr.set(rule.e, rule);
    lists[key] = [...byExpr.values()];
  }
  return canonicalSnapshot({
    v: SYNC_FORMAT_VERSION,
    lists,
    settings: { ...local.settings, ...remote.settings },
  });
};

/** Expands stored rules into the store's rule shape (ids are added there). */
export const rulesToExpressions = (
  rules: ReadonlyArray<CompactRule>,
  listKey: string
): Expression[] =>
  rules.map((rule) => ({
    expression: rule.e,
    listType: rule.t === "G" ? ListType.GREY : ListType.WHITE,
    storeId: listKey,
    cookieNames: rule.c ? [...rule.c] : [],
    cleanSiteData: rule.s ? (rule.s as SiteDataType[]) : [],
    ...(rule.a !== undefined ? { cleanAllCookies: rule.a } : {}),
    ...(rule.l !== undefined ? { cleanLocalStorage: rule.l } : {}),
  }));

/** The payload of the store action that applies a snapshot in one step. */
export const snapshotToSyncedData = (snapshot: SyncSnapshot): SyncedData => ({
  lists: Object.fromEntries(
    SYNCED_LISTS.map((key) => [
      key,
      rulesToExpressions(snapshot.lists[key] ?? [], key),
    ])
  ),
  settings: Object.entries(snapshot.settings).map(([name, value]) => ({
    name,
    value,
  })),
});

// --- Checksum ---------------------------------------------------------------

/**
 * 64-bit FNV-1a over the UTF-8 bytes. Not a security measure: it tells a
 * reader whether every chunk of a write has arrived, and lets a device see
 * that it already holds what the sync storage holds.
 *
 * The 64-bit state is kept in four 16-bit limbs so plain number math stays
 * exact (BigInt is several times slower on long lists). The prime is
 * 2^40 + 0x1b3: multiplying by it is h * 0x1b3 plus h shifted 40 bits,
 * which lands 8 bits into the third limb.
 */
export const checksum = (text: string): string => {
  // Offset basis 0xcbf29ce484222325, least significant limb first.
  let h0 = 0x2325;
  let h1 = 0x8422;
  let h2 = 0x9ce4;
  let h3 = 0xcbf2;
  for (const byte of new TextEncoder().encode(text)) {
    h0 ^= byte;
    const t0 = h0 * 0x1b3;
    let t1 = h1 * 0x1b3;
    let t2 = h2 * 0x1b3 + (h0 << 8);
    const t3 = h3 * 0x1b3 + (h1 << 8);
    t1 += t0 >>> 16;
    h0 = t0 & 0xffff;
    t2 += t1 >>> 16;
    h1 = t1 & 0xffff;
    h3 = (t3 + (t2 >>> 16)) & 0xffff;
    h2 = t2 & 0xffff;
  }
  return [h3, h2, h1, h0]
    .map((limb) => limb.toString(16).padStart(4, "0"))
    .join("");
};

// --- Chunking ---------------------------------------------------------------

export const utf8Length = (text: string): number =>
  new TextEncoder().encode(text).length;

/**
 * What an item costs against the sync quotas: its key plus the JSON form of
 * its value, in UTF-8 bytes. That is how Chrome and Firefox both count.
 */
export const itemBytes = (key: string, value: unknown): number =>
  utf8Length(key) + utf8Length(JSON.stringify(value));

/**
 * Bytes one code point adds to a string's JSON form. Matches
 * JSON.stringify: quote and backslash get a backslash, control characters
 * and lone surrogates become escapes, everything else is its UTF-8 length.
 */
const jsonCharBytes = (ch: string): number => {
  const code = ch.codePointAt(0) as number;
  if (ch === '"' || ch === "\\") return 2;
  if (code < 0x20) return JSON.stringify(ch).length - 2;
  if (code >= 0xd800 && code <= 0xdfff) return 6;
  if (code < 0x80) return 1;
  if (code < 0x800) return 2;
  if (code < 0x10000) return 3;
  return 4;
};

/**
 * Splits text into chunks whose items fit maxItemBytes, key included.
 * Splits between code points, so a character outside the BMP is never cut
 * in half. Always returns at least one chunk.
 */
export const splitIntoChunks = (
  text: string,
  maxItemBytes: number,
  keyFor: (index: number) => string
): string[] => {
  const chunks: string[] = [];
  let current = "";
  // The two quotes around a JSON string.
  let currentBytes = 2;
  let budget = maxItemBytes - utf8Length(keyFor(0));
  for (const ch of text) {
    const cost = jsonCharBytes(ch);
    if (current !== "" && currentBytes + cost > budget) {
      chunks.push(current);
      current = "";
      currentBytes = 2;
      budget = maxItemBytes - utf8Length(keyFor(chunks.length));
    }
    current += ch;
    currentBytes += cost;
  }
  if (current !== "" || chunks.length === 0) chunks.push(current);
  return chunks;
};
