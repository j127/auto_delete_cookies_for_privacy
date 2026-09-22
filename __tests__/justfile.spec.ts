/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */
import { RECIPES } from "./justfile-recipes";

// `just --list`, which plain `just` also prints, describes each recipe with
// only the comment line directly above it. Until #420 two recipes ended a
// multi-line comment partway through a sentence, so the list showed
// fragments such as "CI never needs it)". These checks catch a description
// that is the tail end of a longer comment instead of a line that stands on
// its own.

const bracketsPair = (text: string): boolean => {
  let depth = 0;
  for (const char of text) {
    if (char === "(") depth++;
    if (char === ")" && --depth < 0) return false;
  }
  return depth === 0;
};

describe("just --list", () => {
  it("has recipes to check", () => {
    expect(RECIPES.size).toBeGreaterThan(0);
  });

  it.each([...RECIPES.keys()])(
    "describes %s in one line that stands on its own",
    (name) => {
      const doc = RECIPES.get(name)?.doc ?? "";
      expect(doc, "needs a comment on the line directly above it").not.toBe("");
      expect(doc, "starts partway through a sentence").toMatch(/^[A-Z]/);
      expect(bracketsPair(doc), "has an unmatched bracket").toBe(true);
      expect(
        (doc.match(/`/g) ?? []).length % 2,
        "has an unmatched backtick"
      ).toBe(0);
      expect(doc, "reads as if it continues on another line").not.toMatch(
        /[,;:]$/
      );
    }
  );
});
