import { ListType } from "@/typings/enums";
import {
  parseRawExpression,
  planExpressionImport,
} from "@/ui/settings/import-plan";

const exp = (
  expression: string,
  storeId = "default",
  listType = ListType.WHITE
): Expression => ({ expression, listType, storeId });

describe("parseRawExpression", () => {
  it("splits comma-separated domains and trims whitespace", () => {
    expect(
      parseRawExpression(exp("example.com, *.example.org ,news.site"))
    ).toEqual(["example.com", "*.example.org", "news.site"]);
  });

  it("keeps a regex containing commas as one expression", () => {
    expect(
      parseRawExpression(exp("/^(a|b){1,3}\\.example\\.com$/, plain.site"))
    ).toEqual(["/^(a|b){1,3}\\.example\\.com$/", "plain.site"]);
  });

  it("combines an unterminated regex through the end of the list", () => {
    expect(parseRawExpression(exp("/^unterminated{1,2, tail.site"))).toEqual([
      "/^unterminated{1,2,tail.site",
    ]);
  });
});

describe("planExpressionImport", () => {
  beforeEach(() => {
    global.browser.i18n.getMessage.mockImplementation(
      (key: string, subs: string[] = []) =>
        [key, ...(Array.isArray(subs) ? subs : [subs])].join(" ")
    );
  });

  it("imports default and private lists unchanged, with no folds", () => {
    const plan = planExpressionImport(
      {
        default: [exp("example.com")],
        private: [exp("secret.example.com", "private", ListType.GREY)],
      },
      {}
    );
    expect(plan.additions).toEqual([
      exp("example.com"),
      exp("secret.example.com", "private", ListType.GREY),
    ]);
    expect(plan.foldedCount).toBe(0);
    expect(plan.errors).toEqual([]);
  });

  it("folds container-list entries into default and counts them", () => {
    const plan = planExpressionImport(
      {
        "firefox-container-1": [
          exp("work.example.com", "firefox-container-1"),
          exp("mail.example.com", "firefox-container-1", ListType.GREY),
        ],
      },
      {}
    );
    expect(plan.additions).toEqual([
      exp("work.example.com", "default"),
      exp("mail.example.com", "default", ListType.GREY),
    ]);
    expect(plan.foldedCount).toBe(2);
  });

  it("dedupes folded entries against the existing default list", () => {
    const plan = planExpressionImport(
      {
        "firefox-container-2": [
          exp("already.example.com", "firefox-container-2"),
          exp("fresh.example.com", "firefox-container-2"),
        ],
      },
      { default: [exp("already.example.com")] }
    );
    expect(plan.additions).toEqual([exp("fresh.example.com", "default")]);
    expect(plan.foldedCount).toBe(1);
  });

  it("dedupes folded entries against the file's own default section and other containers", () => {
    const plan = planExpressionImport(
      {
        // Container listed before default in the file: the default section
        // still wins because native lists are planned first.
        "firefox-container-1": [
          exp("shared.example.com", "firefox-container-1"),
          exp("solo.example.com", "firefox-container-1"),
        ],
        default: [exp("shared.example.com")],
        "firefox-container-2": [
          exp("solo.example.com", "firefox-container-2", ListType.GREY),
        ],
      },
      {}
    );
    expect(plan.additions).toEqual([
      exp("shared.example.com"),
      exp("solo.example.com", "default"),
    ]);
    expect(plan.foldedCount).toBe(1);
  });

  it("dedupes by expression alone, matching the ADD_EXPRESSION reducer", () => {
    // Same expression under a different list type would be dropped by the
    // reducer, so it must not count as a fold either.
    const plan = planExpressionImport(
      {
        "firefox-container-1": [
          exp("dup.example.com", "firefox-container-1", ListType.GREY),
        ],
      },
      { default: [exp("dup.example.com", "default", ListType.WHITE)] }
    );
    expect(plan.additions).toEqual([]);
    expect(plan.foldedCount).toBe(0);
  });

  it("rejects invalid expressions with per-entry reasons and keeps the rest", () => {
    const plan = planExpressionImport(
      {
        "firefox-container-1": [
          exp("bad domain", "firefox-container-1"),
          exp("good.example.com", "firefox-container-1"),
        ],
      },
      {}
    );
    expect(plan.additions).toEqual([exp("good.example.com", "default")]);
    expect(plan.errors).toEqual([
      "- bad domain (firefox-container-1) -> inputErrorSpace",
    ]);
    expect(plan.foldedCount).toBe(1);
  });

  it("reports a non-array store value as an error", () => {
    const plan = planExpressionImport(
      {
        default: "oops" as unknown as Expression[],
      },
      {}
    );
    expect(plan.additions).toEqual([]);
    expect(plan.errors).toEqual(["- importListNotArray default"]);
  });
});
