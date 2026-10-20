import { ListType, SiteDataType } from "@/typings/enums";
import { expressionOptionsSummary } from "@/ui/expression-options-summary";

const base: Expression = {
  expression: "example.com",
  id: "e1",
  listType: ListType.WHITE,
  storeId: "default",
};

describe("expressionOptionsSummary", () => {
  beforeEach(() => {
    // Echo the key plus any substitutions so assertions can see both.
    global.browser.i18n.getMessage.mockImplementation(
      (key: string, subs: string[] = []) =>
        [key, ...(Array.isArray(subs) ? subs : [subs])].join(" ")
    );
  });

  it("says everything is kept when nothing is cleaned", () => {
    expect(expressionOptionsSummary(base)).toBe("summaryKeepsEverythingText");
  });

  it("treats an explicit cleanAllCookies=true like the undefined default", () => {
    expect(expressionOptionsSummary({ ...base, cleanAllCookies: true })).toBe(
      "summaryKeepsEverythingText"
    );
  });

  it("counts the named cookies when only chosen cookies are kept", () => {
    expect(
      expressionOptionsSummary({
        ...base,
        cleanAllCookies: false,
        cookieNames: ["sid", "theme", "lang"],
      })
    ).toBe("summaryNamedCookiesText 3");
  });

  it("counts zero named cookies when none are chosen yet", () => {
    expect(expressionOptionsSummary({ ...base, cleanAllCookies: false })).toBe(
      "summaryNamedCookiesText 0"
    );
  });

  it("lists the cleaned site-data types after the cookie part", () => {
    expect(
      expressionOptionsSummary({
        ...base,
        cleanSiteData: [SiteDataType.CACHE, SiteDataType.INDEXEDDB],
      })
    ).toBe("summaryAllCookiesText · summaryClearsTypesText Cache, IndexedDB");
  });

  it("combines named cookies with cleaned site-data types", () => {
    expect(
      expressionOptionsSummary({
        ...base,
        cleanAllCookies: false,
        cookieNames: ["sid"],
        cleanSiteData: [SiteDataType.LOCALSTORAGE],
      })
    ).toBe("summaryNamedCookiesText 1 · summaryClearsTypesText LocalStorage");
  });

  it("counts patterns apart from exact names (#539)", () => {
    expect(
      expressionOptionsSummary({
        ...base,
        cleanAllCookies: false,
        cookieNames: ["sid", "auth_*", "*_csrf"],
      })
    ).toBe("summaryNamedCookiesPatternsText 1 2");
  });

  it("counts an escaped asterisk as an exact name, not a pattern", () => {
    expect(
      expressionOptionsSummary({
        ...base,
        cleanAllCookies: false,
        cookieNames: ["a\\*b"],
      })
    ).toBe("summaryNamedCookiesText 1");
  });

  it("ignores saved patterns while every cookie is kept", () => {
    expect(
      expressionOptionsSummary({
        ...base,
        cookieNames: ["auth_*"],
        cleanSiteData: [SiteDataType.CACHE],
      })
    ).toBe("summaryAllCookiesText · summaryClearsTypesText Cache");
  });
});
