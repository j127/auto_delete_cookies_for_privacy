/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * planExpressionImport on Firefox for Android (#538). The Firefox build
 * runs there without the contextualIdentities API, so container lists from
 * a desktop export fold into default exactly as on the Chrome build
 * (import-plan.spec.ts), instead of landing as lists that never apply.
 */
import { ListType } from "@/typings/enums";
import { installAndroidFlavor } from "../../android-flavor";

vi.stubGlobal("__BROWSER__", "firefox");
vi.resetModules();
installAndroidFlavor();
const { planExpressionImport } = await import("@/ui/settings/import-plan");

const exp = (
  expression: string,
  storeId: string,
  listType: ListType = ListType.WHITE
): Expression => ({ expression, listType, storeId });

// A desktop Firefox export with containers, in the original Cookie
// AutoDelete 3.x shape (firefox-prefixed default/private keys).
const desktopExport: StoreIdToExpressionList = {
  "firefox-container-1": [
    exp("work.example.com", "firefox-container-1"),
    exp("shared.example.com", "firefox-container-1", ListType.GREY),
  ],
  "firefox-default": [exp("shared.example.com", "firefox-default")],
  "firefox-private": [
    exp("secret.example.com", "firefox-private", ListType.GREY),
  ],
  "firefox-container-4": [
    exp("bank.example.com", "firefox-container-4", ListType.GREY),
    exp("work.example.com", "firefox-container-4", ListType.GREY),
  ],
};

const byStore = (additions: Expression[], storeId: string) =>
  additions
    .filter((a) => a.storeId === storeId)
    .map((a) => `${a.expression}|${a.listType}`)
    .sort();

describe("planExpressionImport on Firefox for Android (#538)", () => {
  beforeEach(() => {
    global.browser.i18n.getMessage.mockImplementation(
      (key: string, subs: string[] = []) =>
        [key, ...(Array.isArray(subs) ? subs : [subs])].join(" ")
    );
  });

  it("folds container lists into default and counts them", () => {
    const plan = planExpressionImport(desktopExport, {});
    expect(plan.errors).toEqual([]);
    // shared.example.com is already headed for default from firefox-default,
    // and work.example.com folds once from container 1, so container 4's
    // copy is a duplicate: two folds, bank and work.
    expect(plan.foldedCount).toBe(2);
    expect(byStore(plan.additions, "default")).toEqual([
      `bank.example.com|${ListType.GREY}`,
      `shared.example.com|${ListType.WHITE}`,
      `work.example.com|${ListType.WHITE}`,
    ]);
    // firefox-private still normalizes onto private, as on desktop Firefox.
    expect(byStore(plan.additions, "private")).toEqual([
      `secret.example.com|${ListType.GREY}`,
    ]);
    // No container keys and no raw firefox-default/-private keys remain.
    expect(
      plan.additions.filter((a) => a.storeId.startsWith("firefox-"))
    ).toEqual([]);
  });

  it("merges with an existing Default entry for the same site like Chrome", () => {
    const plan = planExpressionImport(
      {
        "firefox-container-2": [
          exp("already.example.com", "firefox-container-2", ListType.GREY),
          exp("fresh.example.com", "firefox-container-2"),
        ],
      },
      { default: [exp("already.example.com", "default")] }
    );
    // The existing Default rule wins; the container copy is skipped, not
    // counted, whatever its list type (the reducer keys on the expression).
    expect(plan.additions).toEqual([exp("fresh.example.com", "default")]);
    expect(plan.foldedCount).toBe(1);
  });

  it("keeps container lists as their own keys once the container API exists", () => {
    // The fold follows the runtime API, not the build: the same Firefox
    // build on desktop, with contextualIdentities, keeps per-container
    // lists (import-plan-firefox.spec.ts covers that build in full).
    const b = global.browser as unknown as Record<string, unknown>;
    b.contextualIdentities = { query: vi.fn() };
    try {
      const plan = planExpressionImport(desktopExport, {});
      expect(plan.foldedCount).toBe(0);
      expect(byStore(plan.additions, "firefox-container-1")).toEqual([
        `shared.example.com|${ListType.GREY}`,
        `work.example.com|${ListType.WHITE}`,
      ]);
      expect(byStore(plan.additions, "firefox-container-4")).toEqual([
        `bank.example.com|${ListType.GREY}`,
        `work.example.com|${ListType.GREY}`,
      ]);
    } finally {
      delete b.contextualIdentities;
    }
  });
});
