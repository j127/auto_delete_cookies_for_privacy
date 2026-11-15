/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */
import { readdirSync, readFileSync } from "fs";

// Chrome and Edge keep a site listed at about 100 bytes when it holds
// Private State Tokens, which no extension can delete (#578, found in
// discussion #573). Help → Troubleshooting and the README say so and say how
// to remove them. These tests keep that note in every locale.
//
// The same paragraph also covers Edge's small per-address record (#464): the
// extension only clears it once a site has no cookies left, so a keep rule
// leaves it on the site's other addresses. The domain names in its example
// stay untranslated, so the tests look for them.

const LOCALES_ROOT = new URL("../../../extension/_locales/", import.meta.url);
const README = new URL("../../../README.md", import.meta.url);

type Messages = Record<string, { message: string }>;
const troubleshooting = (locale: string): string =>
  (
    JSON.parse(
      readFileSync(new URL(`${locale}/messages.json`, LOCALES_ROOT), "utf8")
    ) as Messages
  ).helpTroubleshootingBody.message;
const LOCALES = readdirSync(LOCALES_ROOT, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

// The term stays in English in every locale: it is what DevTools shows and
// what people search for.
const TERM = "Private State Tokens";
const SITE_LIST = "chrome://settings/content/all";

describe.each(LOCALES)("%s Help troubleshooting", (locale) => {
  const paragraphs = troubleshooting(locale).split("\n\n");

  it("has one paragraph on Private State Tokens with where to delete them", () => {
    const matching = paragraphs.filter((p) => p.includes(TERM));
    expect(matching).toHaveLength(1);
    expect(matching[0]).toContain(SITE_LIST);
    expect(matching[0]).toContain("Ctrl+Shift+Delete");
    expect(matching[0]).toContain("Cmd+Shift+Delete");
  });

  it("puts it right after the old-data paragraph, as in en", () => {
    expect(paragraphs).toHaveLength(7);
    expect(paragraphs[4]).toContain(TERM);
  });

  it("explains Edge's record on a site whose cookies a keep rule holds", () => {
    const paragraph = paragraphs[4];
    expect(paragraph).toContain("accounts.google.com");
    expect(paragraph).toContain("mail.google.com");
    // The example comes after the Private State Tokens part, not before it.
    expect(paragraph.indexOf("accounts.google.com")).toBeGreaterThan(
      paragraph.indexOf("Cmd+Shift+Delete")
    );
  });
});

describe("README", () => {
  const readme = readFileSync(README, "utf8");

  it("names Private State Tokens on Chrome and Edge and how to remove them", () => {
    const section = readme.split("### What the browser won't let it clear")[1];
    expect(section).toBeDefined();
    const body = section.split("\n### ")[0];
    expect(body).toContain(TERM);
    expect(body).toContain(SITE_LIST);
    expect(body).toContain("Ctrl+Shift+Delete");
  });

  it("explains Edge's record on a kept site and how to remove it safely", () => {
    const section = readme.split("### What the browser won't let it clear")[1];
    const body = section.split("\n### ")[0];
    expect(body).toContain("`accounts.google.com`");
    expect(body).toContain("`mail.google.com`");
    expect(body).toContain("See all cookies and site data");
    expect(body).toContain('"Remove all"');
  });
});
