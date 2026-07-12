/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2017-2022 Kenny Do and CAD Team; fork changes (c) 2026 j127.
 * Licensed under MIT (see LICENSE).
 */
import { ListType } from "@/typings/enums";

vi.stubGlobal("__BROWSER__", "firefox");
vi.resetModules();
const { planExpressionImport } = await import("@/ui/settings/import-plan");

const exp = (
  expression: string,
  storeId: string,
  listType: ListType = ListType.WHITE
): Expression => ({ expression, listType, storeId });

// The shape original Cookie AutoDelete 3.x exports: firefox-prefixed
// default/private keys plus per-container lists.
const oldCadExport: StoreIdToExpressionList = {
  default: [exp("plain.example.com", "default")],
  "firefox-default": [exp("main.example.com", "firefox-default")],
  "firefox-private": [
    exp("secret.example.com", "firefox-private", ListType.GREY),
  ],
  "firefox-container-1": [exp("work.example.com", "firefox-container-1")],
  "firefox-container-4": [
    exp("bank.example.com", "firefox-container-4", ListType.GREY),
  ],
};

describe("planExpressionImport on Firefox", () => {
  it("imports an old Cookie AutoDelete export with containers intact", () => {
    const plan = planExpressionImport(oldCadExport, {});
    expect(plan.errors).toEqual([]);
    // Nothing folds on the container-aware build.
    expect(plan.foldedCount).toBe(0);

    const byStore = (storeId: string) =>
      plan.additions
        .filter((a) => a.storeId === storeId)
        .map((a) => a.expression)
        .sort();
    // firefox-default normalizes onto the unified default key.
    expect(byStore("default")).toEqual([
      "main.example.com",
      "plain.example.com",
    ]);
    // firefox-private entries land where cleanup actually reads: private.
    expect(byStore("private")).toEqual(["secret.example.com"]);
    // Container lists survive as their own keys.
    expect(byStore("firefox-container-1")).toEqual(["work.example.com"]);
    expect(byStore("firefox-container-4")).toEqual(["bank.example.com"]);
    // No stray raw firefox-default/-private keys remain.
    expect(
      plan.additions.filter((a) => a.storeId?.startsWith("firefox-") === true)
    ).toHaveLength(2);
  });

  it("round-trips an export losslessly", () => {
    // Simulate: import once, build the resulting lists, export them (the
    // export IS state.lists), import that file again.
    const firstPlan = planExpressionImport(oldCadExport, {});
    const rebuilt: { [storeId: string]: Expression[] } = {};
    firstPlan.additions.forEach((addition) => {
      const key = addition.storeId;
      rebuilt[key] = [...(rebuilt[key] ?? []), addition];
    });
    const rebuiltLists = rebuilt as StoreIdToExpressionList;

    const secondPlan = planExpressionImport(rebuiltLists, rebuiltLists);
    expect(secondPlan.errors).toEqual([]);
    expect(secondPlan.foldedCount).toBe(0);
    // Identical additions in identical lists: nothing changes shape.
    const shape = (additions: Expression[]) =>
      additions.map((a) => `${a.storeId}|${a.expression}|${a.listType}`).sort();
    expect(shape(secondPlan.additions)).toEqual(shape(firstPlan.additions));
  });
});
