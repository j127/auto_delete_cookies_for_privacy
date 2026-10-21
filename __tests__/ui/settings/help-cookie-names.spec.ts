/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */
import { readdirSync, readFileSync } from "fs";
import { cookieNameMatches } from "@/services/cookie-name-patterns";

// The Help section on cookie-name patterns (#539) gives examples. These
// tests tie the examples to what the matcher does, and check that every
// translation keeps them verbatim and quotes its own "Keep All Cookies"
// and "Add" labels.

const LOCALES_ROOT = new URL("../../../extension/_locales/", import.meta.url);

type Messages = Record<string, { message: string }>;
const readLocale = (locale: string): Messages =>
  JSON.parse(
    readFileSync(new URL(`${locale}/messages.json`, LOCALES_ROOT), "utf8")
  ) as Messages;
const LOCALES = readdirSync(LOCALES_ROOT, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const EXAMPLES = ["• sid — ", "• auth_* — ", "• *_session — ", "• a\\* — "];

describe("Help: keeping only some cookies", () => {
  it("gives examples the matcher agrees with", () => {
    expect(cookieNameMatches("sid", "sid")).toBe(true);
    expect(cookieNameMatches("sid", "sid2")).toBe(false);
    expect(cookieNameMatches("auth_*", "auth_token")).toBe(true);
    expect(cookieNameMatches("*_session", "user_session")).toBe(true);
    expect(cookieNameMatches("a\\*", "a*")).toBe(true);
    expect(cookieNameMatches("a\\*", "ab")).toBe(false);
  });

  it("warns in English that older versions read a pattern literally", () => {
    const body = readLocale("en").helpCookieNamesBody.message;
    expect(body).toContain("Cookie AutoDelete");
    expect(body).toContain("auth_*");
    expect(body).toContain("cleaned");
  });

  it.each(LOCALES)(
    "%s keeps the examples and quotes its own labels",
    (locale) => {
      const messages = readLocale(locale);
      const body = messages.helpCookieNamesBody.message;
      EXAMPLES.forEach((example) => expect(body).toContain(example));
      expect(body).toContain(messages.keepAllCookiesText.message);
      expect(body).toContain(messages.cookieNameAddButton.message);
      expect(body).toContain("Cookie AutoDelete");
      expect(messages.cookieNameAddPlaceholder.message).toContain("auth_*");
    }
  );
});
