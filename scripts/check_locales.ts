/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * Locale consistency gate (#70). For every non-English locale under
 * extension/_locales/ it verifies, against en/messages.json:
 *
 * - the file parses as JSON;
 * - the key set matches en exactly (no missing keys, no stale extras);
 * - no two keys collide case-insensitively (message names are
 *   case-insensitive in browser.i18n, and AMO's addons-linter hard-rejects
 *   such duplicates — this bit the Firefox port when keepLocalstorage*Text
 *   coexisted with keepLocalStorage*Text);
 * - the $placeholder$ tokens used in each message match en's per key
 *   (a broken placeholder crashes browser.i18n substitution at runtime);
 * - every "placeholders" definition block matches en's for that key;
 * - extensionName stays the literal untranslated brand.
 *
 * Run with: bun scripts/check_locales.ts (just check_locales)
 */

import { readdirSync } from "fs";
import { join } from "path";

const localesRoot = join(import.meta.dir, "..", "extension", "_locales");

type Message = {
  message: string;
  description?: string;
  placeholders?: { [name: string]: { content: string; example?: string } };
};
type MessagesFile = { [key: string]: Message };

// $name$ substitution tokens; $$ is an escaped dollar and not a token.
const placeholderTokens = (message: string): string[] =>
  [...message.matchAll(/\$([a-zA-Z0-9_@]+)\$/g)]
    .map((m) => m[1].toLowerCase())
    .sort();

const en: MessagesFile = await Bun.file(
  join(localesRoot, "en", "messages.json")
).json();
const enKeys = Object.keys(en).sort();

const locales = readdirSync(localesRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name !== "en")
  .map((entry) => entry.name)
  .sort();

const problems: string[] = [];

// JSON.parse collapses same-case duplicates (last wins), so what survives
// to be caught here is the case-variant kind — exactly the class AMO's
// linter rejects. en is checked too (the loop below skips it).
const caseCollisions = (data: MessagesFile, label: string): void => {
  const byLower = new Map<string, string[]>();
  for (const key of Object.keys(data)) {
    const lower = key.toLowerCase();
    byLower.set(lower, [...(byLower.get(lower) ?? []), key]);
  }
  for (const [, variants] of byLower) {
    if (variants.length > 1) {
      problems.push(
        `${label}: case-insensitive duplicate message names: ${variants.join(" / ")}`
      );
    }
  }
};
caseCollisions(en, "en");

for (const locale of locales) {
  const path = join(localesRoot, locale, "messages.json");
  let data: MessagesFile;
  try {
    data = await Bun.file(path).json();
  } catch (e) {
    problems.push(`${locale}: does not parse (${e})`);
    continue;
  }

  caseCollisions(data, locale);

  const keys = Object.keys(data).sort();
  const missing = enKeys.filter((k) => !(k in data));
  const extra = keys.filter((k) => !(k in en));
  if (missing.length > 0) {
    problems.push(`${locale}: missing keys: ${missing.join(", ")}`);
  }
  if (extra.length > 0) {
    problems.push(`${locale}: stale extra keys: ${extra.join(", ")}`);
  }

  for (const key of enKeys) {
    const entry = data[key];
    if (!entry) continue;
    if (typeof entry.message !== "string" || entry.message.length === 0) {
      problems.push(`${locale}/${key}: empty or non-string message`);
      continue;
    }
    const want = placeholderTokens(en[key].message);
    const got = placeholderTokens(entry.message);
    if (want.join("|") !== got.join("|")) {
      problems.push(
        `${locale}/${key}: placeholder tokens [${got.join(", ")}] != en [${want.join(", ")}]`
      );
    }
    const wantDefs = Object.keys(en[key].placeholders ?? {})
      .map((n) => n.toLowerCase())
      .sort();
    const gotDefs = Object.keys(entry.placeholders ?? {})
      .map((n) => n.toLowerCase())
      .sort();
    if (wantDefs.join("|") !== gotDefs.join("|")) {
      problems.push(
        `${locale}/${key}: placeholders block [${gotDefs.join(", ")}] != en [${wantDefs.join(", ")}]`
      );
    }
    for (const [name, def] of Object.entries(entry.placeholders ?? {})) {
      const enDef = Object.entries(en[key].placeholders ?? {}).find(
        ([n]) => n.toLowerCase() === name.toLowerCase()
      );
      if (enDef && def.content !== enDef[1].content) {
        problems.push(
          `${locale}/${key}: placeholder ${name} content "${def.content}" != en "${enDef[1].content}"`
        );
      }
    }
  }

  if (
    data.extensionName &&
    data.extensionName.message !== en.extensionName.message
  ) {
    problems.push(
      `${locale}: extensionName must stay the literal brand "${en.extensionName.message}"`
    );
  }
}

if (problems.length > 0) {
  console.error(`${problems.length} locale problem(s):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(
  `${locales.length} locales consistent with en (${enKeys.length} keys each).`
);
