/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */
import { readdirSync, readFileSync } from "fs";
import {
  identityReport,
  SAME_AS_EN,
  SAME_AS_EN_EVERYWHERE,
  type Messages,
} from "../../scripts/locale-identity";

// New message keys are seeded into every locale with the English text, so
// key parity and placeholder checks pass while the translations catch up.
// Until #409 nothing noticed when a seed stayed: fifteen keys sat in
// English in all 31 locales. identityReport is what notices now.

const LOCALES_ROOT = new URL("../../extension/_locales/", import.meta.url);

const readMessages = (locale: string): Messages => {
  const file = JSON.parse(
    readFileSync(new URL(`${locale}/messages.json`, LOCALES_ROOT), "utf8")
  ) as Record<string, { message: string }>;
  return Object.fromEntries(
    Object.entries(file).map(([key, entry]) => [key, entry.message])
  );
};

const LOCALES = readdirSync(LOCALES_ROOT, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name !== "en")
  .map((entry) => entry.name);

const EN = readMessages("en");

describe("identityReport", () => {
  const en: Messages = {
    containerListsText: "Separate keep lists per container",
    extensionName: "Auto Delete Cookies for Privacy",
    protectionText: "Protection",
  };

  it("flags a value left in English", () => {
    const report = identityReport("de", en, {
      ...en,
      protectionText: "Schutz",
    });
    expect(report.untranslated).toEqual(["containerListsText"]);
  });

  it("passes a locale that translated everything it had to", () => {
    const report = identityReport("de", en, {
      containerListsText: "Getrennte Behalten-Listen pro Container",
      extensionName: "Auto Delete Cookies for Privacy",
      protectionText: "Schutz",
    });
    expect(report.untranslated).toEqual([]);
    expect(report.staleAllowances).toEqual([]);
  });

  it("lets the brand and the API names stay English everywhere", () => {
    for (const locale of ["de", "ja", "ar", "unknown-locale"]) {
      const report = identityReport("de", en, { ...en, protectionText: "x" });
      expect(report.untranslated, locale).not.toContain("extensionName");
    }
    expect(SAME_AS_EN_EVERYWHERE).toContain("extensionName");
  });

  it("lets a locale keep a word it really does spell the English way", () => {
    // "Protection" is the French word too, and fr lists it.
    expect(SAME_AS_EN.fr).toContain("protectionText");
    const report = identityReport("fr", en, {
      ...en,
      containerListsText: "Listes de conservation distinctes par conteneur",
    });
    expect(report.untranslated).toEqual([]);
  });

  it("asks for a stale allowance to be dropped once the locale translates it", () => {
    const report = identityReport("fr", en, {
      ...en,
      containerListsText: "Listes de conservation distinctes par conteneur",
      protectionText: "Sécurité",
    });
    expect(report.staleAllowances).toEqual(["protectionText"]);
  });

  it("asks for an allowance to be dropped once en drops the key", () => {
    const withoutProtection = { ...en };
    delete (withoutProtection as Record<string, string>).protectionText;
    const report = identityReport("fr", withoutProtection, {
      containerListsText: "Listes de conservation distinctes par conteneur",
      extensionName: "Auto Delete Cookies for Privacy",
    });
    expect(report.unknownAllowances).toContain("protectionText");
  });
});

describe("the locale files themselves", () => {
  it("covers every non-English locale", () => {
    expect(LOCALES).toHaveLength(31);
  });

  it.each(LOCALES)("has no English left in %s", (locale) => {
    const report = identityReport(locale, EN, readMessages(locale));
    expect(
      report.untranslated,
      "translate these, or list them in scripts/locale-identity.ts"
    ).toEqual([]);
    expect(
      report.staleAllowances,
      "these are translated now: drop them from SAME_AS_EN"
    ).toEqual([]);
    expect(
      report.unknownAllowances,
      "en no longer has these keys: drop them from SAME_AS_EN"
    ).toEqual([]);
  });
});
