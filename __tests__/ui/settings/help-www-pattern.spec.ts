/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */
import { readdirSync, readFileSync } from "fs";
import { ListType } from "@/typings/enums";
import { getHostname, getMatchedExpressions } from "@/services/libs";

// A plain-domain rule also covers the www. host: rules are matched against
// the hostname with a leading "www." dropped (getHostname). The pattern help
// used to call example.com "exactly that domain", so a rule for youtube.com
// read as if it left www.youtube.com to be cleaned (#600). These tests keep
// the www. note in the Saved sites pattern table and in Help, in every
// locale, and check that the code still behaves the way the help says.

const LOCALES_ROOT = new URL("../../../extension/_locales/", import.meta.url);

type Messages = Record<string, { message: string }>;
const messages = (locale: string): Messages =>
  JSON.parse(
    readFileSync(new URL(`${locale}/messages.json`, LOCALES_ROOT), "utf8")
  ) as Messages;
const LOCALES = readdirSync(LOCALES_ROOT, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

describe.each(LOCALES)("%s plain-domain pattern help", (locale) => {
  const m = messages(locale);

  it("says the pattern table's example.com row includes www", () => {
    expect(m.patternDomainMeaningText.message).toContain("www");
  });

  it("names www.example.com as covered and mail.example.com as not, in Help", () => {
    const lines = m.helpPatternsBody.message
      .split("\n")
      .filter((line) => line.startsWith("• example.com"));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("www.example.com");
    expect(lines[0]).toContain("mail.example.com");
  });
});

describe("what the help describes", () => {
  const lists = {
    default: [
      {
        expression: "example.com",
        id: "1",
        listType: ListType.WHITE,
        storeId: "default",
      },
    ],
  };
  const matches = (url: string): number =>
    getMatchedExpressions(lists, "default", getHostname(url)).length;

  it("lets an example.com rule cover example.com and www.example.com", () => {
    expect(matches("https://example.com/")).toBe(1);
    expect(matches("https://www.example.com/")).toBe(1);
  });

  it("leaves other subdomains such as mail.example.com uncovered", () => {
    expect(matches("https://mail.example.com/")).toBe(0);
  });
});
