/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */
import { readdirSync, readFileSync } from "fs";
import { initialState } from "@/redux/state";
import { SettingID } from "@/typings/enums";

// The Help page described site-data cleaning as off by default for months
// after the defaults flipped to on (#475). These tests tie the English help
// copy to the real defaults in state.ts, so one can't change without the
// other.

const LOCALES_ROOT = new URL("../../../extension/_locales/", import.meta.url);

type Messages = Record<string, { message: string }>;
const readLocale = (locale: string): Messages =>
  JSON.parse(
    readFileSync(new URL(`${locale}/messages.json`, LOCALES_ROOT), "utf8")
  ) as Messages;
const en = readLocale("en");
const LOCALES = readdirSync(LOCALES_ROOT, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

// Every type behind the "Delete all site data" switch.
const SITE_DATA_TYPES = [
  SettingID.CLEANUP_CACHE,
  SettingID.CLEANUP_INDEXEDDB,
  SettingID.CLEANUP_LOCALSTORAGE,
  SettingID.CLEANUP_PLUGINDATA,
  SettingID.CLEANUP_SERVICEWORKERS,
];

const firstParagraph = (key: string): string =>
  en[key].message.split("\n\n")[0];
const firstSentence = (key: string): string =>
  firstParagraph(key).split(/(?<=\.)\s/)[0];

describe("help copy matches the site-data defaults", () => {
  it("has every site-data type on and wipe-on-enable off in initialState", () => {
    SITE_DATA_TYPES.forEach((id) =>
      expect(initialState.settings[id].value).toBe(true)
    );
    expect(
      initialState.settings[SettingID.SITEDATA_EMPTY_ON_ENABLE].value
    ).toBe(false);
  });

  describe("helpSiteDataBody", () => {
    const sentence = firstSentence("helpSiteDataBody");

    it("opens by saying cookies and every site-data type are deleted out of the box", () => {
      expect(sentence).toMatch(
        /^Out of the box the extension deletes cookies and everything else/
      );
      [
        "Cache",
        "IndexedDB",
        "LocalStorage",
        "Plugin Data",
        "Service Workers",
      ].forEach((type) => expect(sentence).toContain(type));
    });

    it("never claims cookies-only cleaning is the default", () => {
      expect(en.helpSiteDataBody.message).not.toMatch(
        /by default[^.]*cookies only/i
      );
      expect(sentence).not.toMatch(/cookies only/i);
    });

    it("names the switch and the Advanced section exactly as the UI does", () => {
      const opening = firstParagraph("helpSiteDataBody");
      expect(opening).toContain(`“${en.deleteAllSiteDataText.message}”`);
      expect(opening).toContain(`“${en.advancedChooseTypesText.message}”`);
    });

    it("describes wipe-on-enable as off unless turned on", () => {
      expect(en.helpSiteDataBody.message).toContain(
        `off unless you turn on “${en.siteDataEmptyOnEnable.message}”`
      );
    });

    it("carries the Firefox cache note verbatim right after the first sentence", () => {
      const note = en.siteDataCacheFirefoxNoteText.message;
      expect(firstParagraph("helpSiteDataBody")).toContain(note);
      expect(firstParagraph("helpSiteDataBody")).toContain(
        `${sentence} ${note}`
      );
    });
  });

  // The Help page is not browser-aware, so every language must keep the
  // "On Firefox, cache is not included" caveat. Each locale reuses its own
  // settings-page note, so an edit can't drop it in one language unnoticed.
  describe.each(LOCALES)("%s helpSiteDataBody", (locale) => {
    it("contains the locale's own Firefox cache note verbatim", () => {
      const messages = readLocale(locale);
      expect(messages.helpSiteDataBody.message).toContain(
        messages.siteDataCacheFirefoxNoteText.message
      );
    });
  });

  it("helpGettingStartedBody step 2 matches the defaults", () => {
    const step = en.helpGettingStartedBody.message
      .split("\n\n")
      .find((paragraph) => paragraph.startsWith("2.")) as string;
    expect(step).toContain(
      "Out of the box, cleaning removes cookies and everything else a site stores."
    );
    expect(step).not.toMatch(/removes cookies only/);
    expect(step).toContain(`turn off “${en.deleteAllSiteDataText.message}”`);
  });
});
