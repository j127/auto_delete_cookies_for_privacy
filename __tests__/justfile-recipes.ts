/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */
import { readFileSync } from "fs";

export type Recipe = {
  dependencies: string[];
  body: string[];
  // What `just --list` shows for the recipe: the comment on the line
  // directly above its header, without the "#".
  doc?: string;
};

// Reads the justfile's plain layout only: an unindented `name: dependencies`
// header, then indented body lines until the next unindented line. A comment
// is a recipe's description only when nothing, not even a blank line, sits
// between it and the header, which is also just's own rule.
export const parseRecipes = (justfile: string): Map<string, Recipe> => {
  const recipes = new Map<string, Recipe>();
  let current: Recipe | undefined;
  let comment: string | undefined;
  for (const line of justfile.split("\n")) {
    const header = /^(\w+):(?!=)(.*)$/.exec(line);
    if (header) {
      current = {
        dependencies: header[2].trim().split(/\s+/).filter(Boolean),
        body: [],
        doc: comment,
      };
      recipes.set(header[1], current);
    } else if (/^[ \t]+\S/.test(line)) {
      current?.body.push(line.trim());
    } else if (line.trim() !== "") {
      current = undefined;
    }
    comment = /^#\s*(.*)$/.exec(line)?.[1];
  }
  return recipes;
};

export const RECIPES = parseRecipes(
  readFileSync(new URL("../justfile", import.meta.url), "utf8")
);
