/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * Issue #511: keep rules match a cookie's own host (#490), so a rule for
 * youtube.com also kept the cookies of a YouTube player embedded on
 * lenovo.com, which are only ever used there. A cookie partitioned under
 * another site is now kept only while that site is kept too; a cookie
 * partitioned under its own site needs nothing more.
 */
import { initialState } from "@/redux/state";
import {
  cleanSiteData,
  filterSiteData,
  isPartitionKept,
  isSafeToClean,
  matchKeepRules,
  prepareCookie,
} from "@/services/cleanup-service";
import { ADCPCOOKIENAME } from "@/services/libs";
import {
  ListType,
  OpenTabStatus,
  ReasonClean,
  ReasonKeep,
  SiteDataType,
} from "@/typings/enums";
import { when } from "jest-when";

const rule = (expression: string, listType = ListType.WHITE): Expression => ({
  expression,
  id: expression,
  listType,
  storeId: "default",
});

const withRules = (...rules: Expression[]): State => ({
  ...initialState,
  lists: { default: rules },
});

const cookie = (
  overrides: Partial<browser.cookies.Cookie> & { domain: string }
): CookiePropertiesCleanup =>
  prepareCookie({
    hostOnly: false,
    httpOnly: false,
    name: "sid",
    path: "/",
    sameSite: "no_restriction",
    secure: true,
    session: false,
    storeId: "0",
    value: "v",
    ...overrides,
  });

/** A YouTube cookie of a player embedded on lenovo.com. */
const embeddedYouTube = cookie({
  domain: ".youtube.com",
  name: "VISITOR_INFO1_LIVE",
  partitionKey: { topLevelSite: "https://lenovo.com" },
});
const ownYouTube = cookie({ domain: ".youtube.com", name: "SID" });
/** A first-party partitioned cookie, like Cloudflare's (#505). */
const cfClearance = cookie({
  domain: ".beyondunreal.com",
  name: "cf_clearance",
  partitionKey: { topLevelSite: "https://beyondunreal.com" },
});

const youtube = rule("*.youtube.com");
const lenovo = rule("*.lenovo.com");

const judge = (
  state: State,
  props: CookiePropertiesCleanup,
  { greyCleanup = false, openTabs = [] as string[] } = {}
) =>
  isSafeToClean(state, props, {
    greyCleanup,
    ignoreOpenTabs: false,
    openTabDomains: { "0": openTabs },
  });

describe("matchKeepRules()", () => {
  it("matches an unpartitioned cookie by its own host", () => {
    expect(matchKeepRules(withRules(youtube), ownYouTube, false)).toEqual({
      matched: youtube,
      ownMatch: youtube,
    });
  });

  it("drops the own match of a cookie partitioned under a site no rule keeps", () => {
    expect(matchKeepRules(withRules(youtube), embeddedYouTube, false)).toEqual({
      matched: undefined,
      ownMatch: youtube,
    });
  });

  it("keeps the own match while the embedding site is kept too", () => {
    expect(
      matchKeepRules(withRules(youtube, lenovo), embeddedYouTube, false)
    ).toEqual({ matched: youtube, ownMatch: youtube });
  });

  it("lets a Greylist rule for the embedding site keep it until a startup cleanup", () => {
    const state = withRules(youtube, rule("*.lenovo.com", ListType.GREY));
    expect(matchKeepRules(state, embeddedYouTube, false).matched).toBe(youtube);
    expect(matchKeepRules(state, embeddedYouTube, true).matched).toBe(
      undefined
    );
  });

  it("needs nothing more for a cookie partitioned under its own site", () => {
    const beyondunreal = rule("*.beyondunreal.com");
    expect(matchKeepRules(withRules(beyondunreal), cfClearance, false)).toEqual(
      { matched: beyondunreal, ownMatch: beyondunreal }
    );
  });

  it("does not let the embedding site's rule keep a cookie its own host has no rule for", () => {
    expect(matchKeepRules(withRules(lenovo), embeddedYouTube, false)).toEqual({
      matched: undefined,
      ownMatch: undefined,
    });
  });
});

describe("isSafeToClean() with partitioned cookies (#511)", () => {
  it("cleans an embedded cookie whose own site is kept but whose embedding site is not", () => {
    const result = judge(withRules(youtube), embeddedYouTube);
    expect(result.cleanCookie).toBe(true);
    expect(result.reason).toBe(ReasonClean.PartitionNotKept);
    // The log names the rule that kept the site's own cookies.
    expect(result.expression).toBe(youtube);
  });

  it("still keeps it while the embedding site is open", () => {
    const result = judge(withRules(youtube), embeddedYouTube, {
      openTabs: ["lenovo.com"],
    });
    expect(result.cleanCookie).toBe(false);
    expect(result.reason).toBe(ReasonKeep.OpenTabs);
  });

  it("keeps it when the embedding site is kept as well", () => {
    const result = judge(withRules(youtube, lenovo), embeddedYouTube);
    expect(result.cleanCookie).toBe(false);
    expect(result.reason).toBe(ReasonKeep.MatchedExpression);
  });

  it("keeps the site's own cookies and its first-party partitioned ones", () => {
    expect(judge(withRules(youtube), ownYouTube).reason).toBe(
      ReasonKeep.MatchedExpression
    );
    expect(
      judge(withRules(rule("*.beyondunreal.com")), cfClearance).reason
    ).toBe(ReasonKeep.MatchedExpression);
  });

  it("cleans the embedded cookie at a startup cleanup when the embedding site is only greylisted", () => {
    const state = withRules(youtube, rule("*.lenovo.com", ListType.GREY));
    expect(judge(state, embeddedYouTube).cleanCookie).toBe(false);
    const atStartup = judge(state, embeddedYouTube, { greyCleanup: true });
    expect(atStartup.cleanCookie).toBe(true);
    expect(atStartup.reason).toBe(ReasonClean.PartitionNotKept);
  });

  it("cleans the frame host's partitioned marker the same way (#504)", () => {
    const marker = cookie({
      domain: "www.youtube.com",
      hostOnly: true,
      name: ADCPCOOKIENAME,
      partitionKey: { topLevelSite: "https://lenovo.com" },
      path: "/marker",
      secure: false,
    });
    const result = judge(withRules(youtube), marker);
    expect(result.cleanCookie).toBe(true);
    expect(result.reason).toBe(ReasonClean.PartitionNotKept);
  });
});

describe("site data of a partitioned cookie no rule keeps (#511)", () => {
  const cleaned = (props: CookiePropertiesCleanup): CleanReasonObject => ({
    cached: false,
    cleanCookie: true,
    cookie: props,
    expression: youtube,
    openTabStatus: OpenTabStatus.TabsWasNotIgnored,
    reason: ReasonClean.PartitionNotKept,
  });

  beforeEach(() => {
    when(global.browser.browsingData.remove)
      .calledWith(expect.any(Object), expect.any(Object))
      .mockResolvedValue(undefined as never);
  });

  it("puts its host in the site-data scope like a cookie no rule matches", () => {
    expect(
      filterSiteData(cleaned(embeddedYouTube), SiteDataType.LOCALSTORAGE)
    ).toBe(true);
  });

  it("still leaves the storage of a kept host alone", async () => {
    expect(
      await cleanSiteData(
        withRules(youtube),
        SiteDataType.LOCALSTORAGE,
        [cleaned(embeddedYouTube)],
        false
      )
    ).toEqual([]);
    expect(global.browser.browsingData.remove).not.toHaveBeenCalled();
  });

  it("clears it when the host's rule asks for that storage to be cleaned", async () => {
    const youtubeCleanStorage = {
      ...youtube,
      cleanSiteData: [SiteDataType.LOCALSTORAGE],
    };
    expect(
      await cleanSiteData(
        withRules(youtubeCleanStorage),
        SiteDataType.LOCALSTORAGE,
        [cleaned(embeddedYouTube)],
        false
      )
    ).toEqual([".youtube.com"]);
  });
});

describe("isPartitionKept()", () => {
  it("is true for an unpartitioned cookie and one partitioned under its own site", () => {
    expect(isPartitionKept(withRules(), ownYouTube, false)).toBe(true);
    expect(isPartitionKept(withRules(), cfClearance, false)).toBe(true);
  });

  it("is false under a site no rule keeps, true once a rule keeps it", () => {
    expect(isPartitionKept(withRules(youtube), embeddedYouTube, false)).toBe(
      false
    );
    expect(
      isPartitionKept(withRules(youtube, lenovo), embeddedYouTube, false)
    ).toBe(true);
  });

  it("needs a Whitelist rule for the embedding site at a startup cleanup", () => {
    const grey = withRules(youtube, rule("*.lenovo.com", ListType.GREY));
    expect(isPartitionKept(grey, embeddedYouTube, false)).toBe(true);
    expect(isPartitionKept(grey, embeddedYouTube, true)).toBe(false);
  });
});
