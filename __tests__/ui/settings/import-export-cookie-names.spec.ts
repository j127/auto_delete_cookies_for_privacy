/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * Cookie-name patterns (#539) travel through export and import as the
 * plain strings they are saved as: `auth_*` and the escaped `a\*b` come
 * back verbatim, and cleanup after the import keeps the same cookies.
 */
import { addExpressionsUI } from "@/redux/actions";
import { lists as listsReducer } from "@/redux/reducers";
import { initialState } from "@/redux/state";
import { isSafeToClean, prepareCookie } from "@/services/cleanup-service";
import { ListType } from "@/typings/enums";
import { planExpressionImport } from "@/ui/settings/import-plan";

const saved: Expression = {
  cleanAllCookies: false,
  cleanSiteData: [],
  cookieNames: ["theme", "auth_*", "*_csrf", "a\\*b"],
  expression: "example.com",
  id: "rule-1",
  listType: ListType.WHITE,
  storeId: "default",
};

/** What the Export button writes: the lists object as JSON. */
const exportLists = (lists: StoreIdToExpressionList): string =>
  JSON.stringify(lists, null, 2);

/** What the Import button does with a file: plan, then one batch action. */
const importInto = (
  existing: StoreIdToExpressionList,
  file: string
): StoreIdToExpressionList => {
  const plan = planExpressionImport(JSON.parse(file), existing);
  expect(plan.errors).toEqual([]);
  return listsReducer(existing, addExpressionsUI(plan.additions));
};

const keeps = (lists: StoreIdToExpressionList, name: string): boolean =>
  !isSafeToClean(
    { ...initialState, lists },
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
    }),
    { greyCleanup: false, ignoreOpenTabs: true, openTabDomains: {} }
  ).cleanCookie;

describe("export and import of cookie-name patterns", () => {
  beforeEach(() => {
    global.browser.i18n.getMessage.mockImplementation((key: string) => key);
  });

  it("writes patterns into the export file as they are saved", () => {
    const file = exportLists({ default: [saved] });
    expect(JSON.parse(file).default[0].cookieNames).toEqual([
      "theme",
      "auth_*",
      "*_csrf",
      "a\\*b",
    ]);
  });

  it("brings patterns back verbatim on import", () => {
    const imported = importInto({}, exportLists({ default: [saved] }));
    expect(imported.default).toHaveLength(1);
    expect(imported.default[0].cookieNames).toEqual(saved.cookieNames);
    expect(imported.default[0].cleanAllCookies).toBe(false);
  });

  it("keeps the same cookies after a round trip", () => {
    const before = { default: [saved] };
    const after = importInto({}, exportLists(before));
    for (const name of [
      "theme",
      "auth_token",
      "form_csrf",
      "a*b",
      "axb",
      "tracker",
    ]) {
      expect(keeps(after, name)).toBe(keeps(before, name));
    }
    expect(keeps(after, "auth_token")).toBe(true);
    expect(keeps(after, "axb")).toBe(false);
  });

  it("survives a second round trip unchanged", () => {
    const once = importInto({}, exportLists({ default: [saved] }));
    const twice = importInto({}, exportLists(once));
    expect(twice.default[0].cookieNames).toEqual(saved.cookieNames);
  });

  it("reads a Cookie AutoDelete export with plain names exactly as before", () => {
    // Upstream exports have the same shape; a name without `*` stays an
    // exact match.
    const upstream = JSON.stringify({
      default: [
        {
          cleanAllCookies: false,
          cookieNames: ["auth", "sid"],
          expression: "example.com",
          id: "cad-1",
          listType: "WHITE",
          storeId: "default",
        },
      ],
    });
    const imported = importInto({}, upstream);
    expect(keeps(imported, "auth")).toBe(true);
    expect(keeps(imported, "auth_token")).toBe(false);
  });
});
