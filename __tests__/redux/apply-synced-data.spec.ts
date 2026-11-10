/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * APPLY_SYNCED_DATA (#587): a snapshot from another device replaces the
 * lists it names and updates the settings it names, in one state change.
 */
import { ListType, SettingID } from "@/typings/enums";
import { lists, settings } from "@/redux/reducers";
import { initialState } from "@/redux/state";
import { ReduxConstants } from "@/typings/redux-constants";

const rule = (
  expression: string,
  listType = ListType.WHITE,
  storeId = "default"
): Expression => ({ expression, listType, storeId });

const apply = (payload: SyncedData) => ({
  payload,
  type: ReduxConstants.APPLY_SYNCED_DATA as const,
});

describe("APPLY_SYNCED_DATA", () => {
  describe("lists", () => {
    const before: StoreIdToExpressionList = {
      default: [{ ...rule("old.com"), id: "1" }],
      private: [{ ...rule("private.com", ListType.WHITE, "private"), id: "2" }],
    };

    it("replaces the named list, with fresh ids and the usual order", () => {
      const after = lists(
        before,
        apply({
          lists: {
            default: [
              rule("b.com", ListType.GREY),
              rule("a.com"),
              rule("c.com"),
            ],
          },
          settings: [],
        })
      );
      expect(after.default.map((e) => e.expression)).toEqual([
        "a.com",
        "c.com",
        "b.com",
      ]);
      for (const e of after.default) {
        expect(typeof e.id).toBe("string");
        expect(e.cookieNames).toEqual([]);
        expect(e.cleanSiteData).toEqual([]);
      }
    });

    it("leaves lists it doesn't name alone", () => {
      const after = lists(
        before,
        apply({ lists: { default: [rule("a.com")] }, settings: [] })
      );
      expect(after.private).toBe(before.private);
    });

    it("removes the list when the snapshot's is empty", () => {
      const after = lists(
        before,
        apply({ lists: { default: [] }, settings: [] })
      );
      expect(after.default).toBeUndefined();
      expect(after.private).toBeDefined();
    });

    it("files every rule under the list it arrived in", () => {
      const after = lists(
        {},
        apply({
          lists: { default: [rule("a.com", ListType.WHITE, "elsewhere")] },
          settings: [],
        })
      );
      expect(after.default[0].storeId).toBe("default");
    });

    it("keeps one rule per expression", () => {
      const after = lists(
        {},
        apply({
          lists: { default: [rule("a.com"), rule("a.com", ListType.GREY)] },
          settings: [],
        })
      );
      expect(after.default).toHaveLength(1);
    });
  });

  describe("settings", () => {
    it("changes only the value of a known setting", () => {
      const withId: MapToSettingObject = {
        ...initialState.settings,
        [SettingID.CLEAN_DELAY]: {
          id: "kept",
          name: SettingID.CLEAN_DELAY,
          value: 15,
        },
      };
      const after = settings(
        withId,
        apply({
          lists: {},
          settings: [{ name: SettingID.CLEAN_DELAY, value: 60 }],
        })
      );
      expect(after[SettingID.CLEAN_DELAY]).toEqual({
        id: "kept",
        name: SettingID.CLEAN_DELAY,
        value: 60,
      });
      expect(after[SettingID.ACTIVE_MODE]).toBe(withId[SettingID.ACTIVE_MODE]);
    });

    it("adds a setting this state doesn't have yet", () => {
      const after = settings(
        {},
        apply({
          lists: {},
          settings: [{ name: SettingID.NOTIFY_AUTO, value: false }],
        })
      );
      expect(after[SettingID.NOTIFY_AUTO]).toEqual({
        name: SettingID.NOTIFY_AUTO,
        value: false,
      });
    });
  });

  it("sync starts switched off", () => {
    expect(initialState.settings[SettingID.SYNC_ENABLED].value).toBe(false);
  });
});
