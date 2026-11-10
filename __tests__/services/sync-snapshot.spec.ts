/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * The data side of keep-list sync (#587): building, reading and merging
 * snapshots, the checksum, and chunking against the browsers' quotas.
 */
import { ListType, SettingID, SiteDataType } from "@/typings/enums";
import { initialState } from "@/redux/state";
import {
  buildSnapshot,
  canonicalSnapshot,
  checksum,
  itemBytes,
  mergeSnapshots,
  parseSnapshot,
  rulesToExpressions,
  serializeSnapshot,
  snapshotToSyncedData,
  splitIntoChunks,
  SYNC_FORMAT_VERSION,
  SYNCED_SETTINGS,
  type CompactRule,
  type SyncSnapshot,
  utf8Length,
} from "@/services/sync-snapshot";

const rule = (overrides: Partial<Expression> = {}): Expression => ({
  expression: "example.com",
  listType: ListType.WHITE,
  storeId: "default",
  id: "local-id",
  cookieNames: [],
  cleanSiteData: [],
  ...overrides,
});

const stateWith = (
  lists: StoreIdToExpressionList,
  settings: { [name: string]: boolean | number | string } = {}
): State => {
  const merged: { [name: string]: Setting } = { ...initialState.settings };
  for (const [name, value] of Object.entries(settings)) {
    merged[name] = { ...merged[name], name, value };
  }
  return { ...initialState, lists, settings: merged };
};

const snapshot = (
  rules: CompactRule[],
  settings: SyncSnapshot["settings"] = {}
): SyncSnapshot => ({
  v: SYNC_FORMAT_VERSION,
  lists: { default: rules },
  settings,
});

describe("buildSnapshot()", () => {
  it("stores the default list compactly, without ids or store ids", () => {
    const snap = buildSnapshot(
      stateWith({
        default: [
          rule({ expression: "b.com", listType: ListType.GREY }),
          rule({
            expression: "a.com",
            cookieNames: ["sid", "auth_*"],
            cleanSiteData: [SiteDataType.LOCALSTORAGE, SiteDataType.CACHE],
            cleanAllCookies: false,
          }),
        ],
      })
    );
    expect(snap.lists.default).toEqual([
      {
        e: "a.com",
        t: "W",
        c: ["sid", "auth_*"],
        s: [SiteDataType.CACHE, SiteDataType.LOCALSTORAGE],
        a: false,
      },
      { e: "b.com", t: "G" },
    ]);
  });

  it("leaves out the private list and container lists", () => {
    const snap = buildSnapshot(
      stateWith({
        default: [rule()],
        private: [rule({ expression: "private.com", storeId: "private" })],
        "firefox-container-1": [
          rule({ expression: "work.com", storeId: "firefox-container-1" }),
        ],
      })
    );
    expect(Object.keys(snap.lists)).toEqual(["default"]);
    expect(snap.lists.default.map((r) => r.e)).toEqual(["example.com"]);
  });

  it("carries the allowlisted settings and nothing device-local", () => {
    const snap = buildSnapshot(stateWith({}, { [SettingID.CLEAN_DELAY]: 30 }));
    expect(snap.settings[SettingID.CLEAN_DELAY]).toBe(30);
    expect(Object.keys(snap.settings)).toEqual([...SYNCED_SETTINGS]);
    for (const local of [
      SettingID.ACTIVE_MODE,
      SettingID.RESUME_ACTIVE_MODE,
      SettingID.SYNC_ENABLED,
      SettingID.SITEDATA_EMPTY_ON_ENABLE,
      SettingID.DEBUG_MODE,
      SettingID.SIZE_POPUP,
      SettingID.SIZE_SETTING,
      SettingID.ENABLE_NEW_POPUP,
    ]) {
      expect(snap.settings).not.toHaveProperty(local);
    }
  });

  it("keeps the pre-3.4.0 cleanLocalStorage field when a rule has it", () => {
    const snap = buildSnapshot(
      stateWith({ default: [rule({ cleanLocalStorage: true })] })
    );
    expect(snap.lists.default[0].l).toBe(true);
  });

  it("gives the same JSON for the same data in any order", () => {
    const one = stateWith({
      default: [rule({ expression: "a.com" }), rule({ expression: "b.com" })],
    });
    const two = stateWith({
      default: [
        rule({ expression: "b.com", id: "x" }),
        rule({ expression: "a.com", id: "y" }),
      ],
    });
    expect(serializeSnapshot(buildSnapshot(one))).toBe(
      serializeSnapshot(buildSnapshot(two))
    );
  });

  it("works on a state with no default list", () => {
    expect(buildSnapshot(stateWith({})).lists.default).toEqual([]);
  });
});

describe("canonicalSnapshot()", () => {
  it("keeps one rule per expression, the first one", () => {
    const canon = canonicalSnapshot(
      snapshot([
        { e: "a.com", t: "W" },
        { e: "a.com", t: "G" },
      ])
    );
    expect(canon.lists.default).toEqual([{ e: "a.com", t: "W" }]);
  });

  it("drops empty optional arrays", () => {
    const canon = canonicalSnapshot(
      snapshot([{ e: "a.com", t: "W", c: [], s: [] }])
    );
    expect(canon.lists.default[0]).toEqual({ e: "a.com", t: "W" });
  });

  it("drops settings that are not on the allowlist", () => {
    const canon = canonicalSnapshot(
      snapshot([], {
        [SettingID.ACTIVE_MODE]: true,
        [SettingID.CLEAN_DELAY]: 5,
      })
    );
    expect(canon.settings).toEqual({ [SettingID.CLEAN_DELAY]: 5 });
  });

  it("fills a missing list with an empty one", () => {
    expect(
      canonicalSnapshot({ v: 1, lists: {}, settings: {} }).lists.default
    ).toEqual([]);
  });
});

describe("parseSnapshot()", () => {
  it("reads back what serializeSnapshot wrote", () => {
    const original = buildSnapshot(
      stateWith(
        {
          default: [
            rule({ cookieNames: ["a"], cleanAllCookies: true }),
            rule({ expression: "z.org", listType: ListType.GREY }),
          ],
        },
        { [SettingID.NOTIFY_AUTO]: false }
      )
    );
    const parsed = parseSnapshot(serializeSnapshot(original));
    expect(parsed).toEqual({ ok: true, snapshot: original });
  });

  it.each([
    ["not JSON", "{oops"],
    ["not an object", "42"],
    ["null", "null"],
    ["no version", JSON.stringify({ lists: {}, settings: {} })],
    [
      "a fractional version",
      JSON.stringify({ v: 1.5, lists: {}, settings: {} }),
    ],
    ["version zero", JSON.stringify({ v: 0, lists: {}, settings: {} })],
    ["no lists", JSON.stringify({ v: 1, settings: {} })],
    ["no settings", JSON.stringify({ v: 1, lists: {} })],
    [
      "a list that is not an array",
      JSON.stringify({ v: 1, lists: { default: {} }, settings: {} }),
    ],
  ])("rejects %s as invalid", (_label, text) => {
    expect(parseSnapshot(text)).toEqual({ ok: false, reason: "invalid" });
  });

  it("reports a newer format instead of reading it", () => {
    expect(
      parseSnapshot(
        JSON.stringify({ v: SYNC_FORMAT_VERSION + 1, lists: {}, settings: {} })
      )
    ).toEqual({ ok: false, reason: "newer" });
  });

  it("reads a snapshot with no default list as an empty list", () => {
    const parsed = parseSnapshot(
      JSON.stringify({ v: 1, lists: {}, settings: {} })
    );
    expect(parsed.ok && parsed.snapshot.lists.default).toEqual([]);
  });

  it("skips rules it can't read and keeps the rest", () => {
    const parsed = parseSnapshot(
      JSON.stringify({
        v: 1,
        lists: {
          default: [
            { e: "good.com", t: "W" },
            null,
            "bare-string.com",
            { e: "", t: "W" },
            { e: "   ", t: "W" },
            { e: "bad-type.com", t: "X" },
            { e: "bad-cookies.com", t: "W", c: "sid" },
            { e: "bad-cookie-item.com", t: "W", c: [1] },
            { e: "bad-sitedata.com", t: "W", s: "Cache" },
            { e: "bad-all.com", t: "W", a: "yes" },
            { e: "bad-ls.com", t: "W", l: 1 },
          ],
        },
        settings: {},
      })
    );
    expect(parsed.ok && parsed.snapshot.lists.default).toEqual([
      { e: "good.com", t: "W" },
    ]);
  });

  it("drops site-data types this version doesn't know", () => {
    const parsed = parseSnapshot(
      JSON.stringify({
        v: 1,
        lists: {
          default: [
            { e: "a.com", t: "W", s: [SiteDataType.CACHE, "futureType"] },
          ],
        },
        settings: {},
      })
    );
    expect(parsed.ok && parsed.snapshot.lists.default[0].s).toEqual([
      SiteDataType.CACHE,
    ]);
  });

  it("takes only allowlisted settings that have the right type", () => {
    const parsed = parseSnapshot(
      JSON.stringify({
        v: 1,
        lists: {},
        settings: {
          [SettingID.CLEAN_DELAY]: 20,
          [SettingID.NOTIFY_AUTO]: "yes",
          [SettingID.ACTIVE_MODE]: true,
          futureSetting: 1,
        },
      })
    );
    expect(parsed.ok && parsed.snapshot.settings).toEqual({
      [SettingID.CLEAN_DELAY]: 20,
    });
  });
});

describe("mergeSnapshots()", () => {
  it("keeps the rules of both sides", () => {
    const merged = mergeSnapshots(
      snapshot([{ e: "local.com", t: "W" }]),
      snapshot([{ e: "remote.com", t: "G" }])
    );
    expect(merged.lists.default.map((r) => r.e)).toEqual([
      "local.com",
      "remote.com",
    ]);
  });

  it("takes the synced version of a rule on both sides", () => {
    const merged = mergeSnapshots(
      snapshot([{ e: "both.com", t: "W" }]),
      snapshot([{ e: "both.com", t: "G", c: ["sid"] }])
    );
    expect(merged.lists.default).toEqual([
      { e: "both.com", t: "G", c: ["sid"] },
    ]);
  });

  it("lets synced settings win and keeps local ones the other side lacks", () => {
    const merged = mergeSnapshots(
      snapshot([], {
        [SettingID.CLEAN_DELAY]: 5,
        [SettingID.NOTIFY_AUTO]: false,
      }),
      snapshot([], { [SettingID.CLEAN_DELAY]: 60 })
    );
    expect(merged.settings).toEqual({
      [SettingID.CLEAN_DELAY]: 60,
      [SettingID.NOTIFY_AUTO]: false,
    });
  });

  it("copes with snapshots missing the list", () => {
    const merged = mergeSnapshots(
      { v: 1, lists: {}, settings: {} },
      { v: 1, lists: {}, settings: {} }
    );
    expect(merged.lists.default).toEqual([]);
  });
});

describe("rulesToExpressions() and snapshotToSyncedData()", () => {
  it("expands stored rules into store rules for the list", () => {
    expect(
      rulesToExpressions(
        [
          {
            e: "a.com",
            t: "G",
            c: ["sid"],
            s: [SiteDataType.CACHE],
            a: false,
            l: true,
          },
          { e: "b.com", t: "W" },
        ],
        "default"
      )
    ).toEqual([
      {
        expression: "a.com",
        listType: ListType.GREY,
        storeId: "default",
        cookieNames: ["sid"],
        cleanSiteData: [SiteDataType.CACHE],
        cleanAllCookies: false,
        cleanLocalStorage: true,
      },
      {
        expression: "b.com",
        listType: ListType.WHITE,
        storeId: "default",
        cookieNames: [],
        cleanSiteData: [],
      },
    ]);
  });

  it("builds the payload for the one-step store action", () => {
    expect(
      snapshotToSyncedData(
        snapshot([{ e: "a.com", t: "W" }], { [SettingID.CLEAN_DELAY]: 9 })
      )
    ).toEqual({
      lists: {
        default: [
          {
            expression: "a.com",
            listType: ListType.WHITE,
            storeId: "default",
            cookieNames: [],
            cleanSiteData: [],
          },
        ],
      },
      settings: [{ name: SettingID.CLEAN_DELAY, value: 9 }],
    });
  });

  it("gives an empty list when the snapshot has none", () => {
    expect(
      snapshotToSyncedData({ v: 1, lists: {}, settings: {} }).lists
    ).toEqual({
      default: [],
    });
  });
});

describe("checksum()", () => {
  it("is a 16-digit hex string", () => {
    expect(checksum("")).toMatch(/^[0-9a-f]{16}$/);
  });

  it("matches the FNV-1a 64-bit reference values", () => {
    expect(checksum("")).toBe("cbf29ce484222325");
    expect(checksum("a")).toBe("af63dc4c8601ec8c");
    expect(checksum("foobar")).toBe("85944171f73967e8");
  });

  it("changes when one character changes", () => {
    expect(checksum('{"e":"a.com"}')).not.toBe(checksum('{"e":"b.com"}'));
  });

  it("hashes UTF-8 bytes, so non-ASCII text is stable", () => {
    expect(checksum("bücher.de")).toBe(checksum("bücher.de"));
    expect(checksum("bücher.de")).not.toBe(checksum("bucher.de"));
  });
});

describe("chunking", () => {
  const key = (i: number) => `syncChunk${i}`;
  const fits = (chunks: string[], max: number) =>
    chunks.every((chunk, i) => itemBytes(key(i), chunk) <= max);

  it("measures key plus JSON value in UTF-8 bytes", () => {
    expect(itemBytes("k", "ab")).toBe(1 + 4);
    expect(itemBytes("k", 'a"b')).toBe(1 + 6);
    expect(utf8Length("ü")).toBe(2);
  });

  it("keeps a short text in one chunk", () => {
    expect(splitIntoChunks("hello", 8192, key)).toEqual(["hello"]);
  });

  it("returns one empty chunk for empty text", () => {
    expect(splitIntoChunks("", 8192, key)).toEqual([""]);
  });

  it("splits long text so every item fits and the parts join back", () => {
    const text = JSON.stringify(
      Array.from({ length: 2000 }, (_, i) => ({
        e: `site-${i}.example.com`,
        t: "W",
      }))
    );
    const chunks = splitIntoChunks(text, 8000, key);
    expect(chunks.length).toBeGreaterThan(1);
    expect(fits(chunks, 8000)).toBe(true);
    expect(chunks.join("")).toBe(text);
  });

  it("counts JSON escapes: quotes, backslashes and control characters", () => {
    const text = '"\\\n\u0001'.repeat(400);
    const chunks = splitIntoChunks(text, 300, key);
    expect(fits(chunks, 300)).toBe(true);
    expect(chunks.join("")).toBe(text);
  });

  it("never cuts a character outside the BMP in half", () => {
    const text = "😀".repeat(500);
    const chunks = splitIntoChunks(text, 101, key);
    expect(fits(chunks, 101)).toBe(true);
    expect(chunks.join("")).toBe(text);
    for (const chunk of chunks) {
      expect(chunk.length % 2).toBe(0);
    }
  });

  it("counts multi-byte and lone-surrogate characters at their JSON size", () => {
    const text = `ü€${"\ud800"}`.repeat(200);
    const chunks = splitIntoChunks(text, 120, key);
    expect(fits(chunks, 120)).toBe(true);
    expect(chunks.join("")).toBe(text);
  });
});
