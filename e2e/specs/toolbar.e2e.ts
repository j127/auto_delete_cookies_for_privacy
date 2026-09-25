/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * Matrix row 19: toolbar repaint after a keep-list change. Since #438 the
 * only repaint is the store subscriber, SettingService.onSettingsChange
 * awaiting checkIfProtected after every store change, which unit specs
 * cannot watch end to end. Each keep-list action goes through the live
 * store bridge from the probe tab, exactly as the popup and the settings
 * page send it, and the site tab's per-tab toolbar title must follow
 * (#441).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  FirefoxSession,
  launchFirefox,
  openTab,
  probe,
  stopGeckodriver,
  waitUntil,
} from "../helpers/firefox_driver";
import { FixtureServer, startFixtureServer } from "../helpers/fixture_server";

interface StoredExpression {
  id: string;
  expression: string;
  listType: string;
}

let session: FirefoxSession;
let fixture: FixtureServer;

/** Sends one action through the UI store bridge, as the popup does. */
const dispatch = async (action: Record<string, unknown>): Promise<void> => {
  const { driver, probeHandle } = session;
  await driver.switchTo().window(probeHandle);
  const result = (await driver.executeAsyncScript(
    `
    const [action, done] = [arguments[0], arguments[arguments.length - 1]];
    browser.runtime.sendMessage({ type: "@@STORE_DISPATCH", action }).then(
      () => done({ ok: true }),
      (e) => done({ ok: false, error: String(e) })
    );
    `,
    action
  )) as { ok: boolean; error?: string };
  if (!result.ok) throw new Error(`dispatch failed: ${result.error}`);
};

/**
 * The site tab's toolbar title, "<name> <version> [LIST] (count)" once the
 * extension has painted it. Match patterns ignore the port, so the fixture
 * tab is found by host alone.
 */
const siteTitle = async (): Promise<string> => {
  const { driver, probeHandle } = session;
  await driver.switchTo().window(probeHandle);
  return (await driver.executeAsyncScript(`
    const done = arguments[arguments.length - 1];
    (async () => {
      const tabs = await browser.tabs.query({ url: "http://localhost/*" });
      if (!tabs.length) return "";
      return browser.action.getTitle({ tabId: tabs[0].id });
    })().then(done, (e) => done("error: " + String(e)));
  `)) as string;
};

/** Waits for the repaint, then asserts on the title so a miss shows it. */
const expectTitle = async (list: string): Promise<void> => {
  await waitUntil(async () => (await siteTitle()).includes(`[${list}]`), 15000);
  expect(await siteTitle()).toContain(`[${list}]`);
};

/**
 * The persisted copy that getState reads lags the live store by the
 * background's one-second write throttle, so a rule removed a moment ago
 * can still be there: read a rule back by list type before reusing its id.
 */
const storedRule = async (listType: string): Promise<StoredExpression> => {
  let found: StoredExpression | undefined;
  await waitUntil(async () => {
    const state = (await probe(session, { kind: "getState" })) as {
      lists?: { default?: StoredExpression[] };
    };
    found = (state.lists?.default ?? []).find(
      (e) => e.expression === "localhost" && e.listType === listType
    );
    return found !== undefined;
  }, 10000);
  if (!found) throw new Error(`no persisted ${listType} rule for localhost`);
  return found;
};

// firefox-default on purpose: the thunks sanitize it to "default".
const rule = (listType: string) => ({
  expression: "localhost",
  listType,
  storeId: "firefox-default",
});

beforeAll(async () => {
  fixture = await startFixtureServer();
  session = await launchFirefox();
  await openTab(session, `${fixture.primary}/`);
  // The tab's own paint (onTabUpdate) must land before any list change, or
  // a later repaint could be mistaken for it.
  const painted = await waitUntil(
    async () => (await siteTitle()).includes("[NO LIST]"),
    30000
  );
  if (!painted) {
    throw new Error(`site tab never painted: "${await siteTitle()}"`);
  }
}, 120000);

afterAll(async () => {
  await session?.quit();
  stopGeckodriver();
  await fixture?.stop();
});

describe("row 19: toolbar repaint after a keep-list change", () => {
  beforeEach(async () => {
    // Every case starts from empty lists and an unmatched tab.
    await dispatch({ type: "CLEAR_EXPRESSIONS", payload: {} });
    await expectTitle("NO LIST");
  });

  it("repaints on a single add and on its removal", async () => {
    await dispatch({ type: "ADD_EXPRESSION", payload: rule("WHITE") });
    await expectTitle("WHITE");

    const added = await storedRule("WHITE");
    await dispatch({
      type: "REMOVE_EXPRESSION",
      payload: { id: added.id, storeId: "default" },
    });
    await expectTitle("NO LIST");
  }, 60000);

  it("repaints on a batch add and on an update", async () => {
    await dispatch({ type: "ADD_EXPRESSIONS", payload: [rule("GREY")] });
    await expectTitle("GREY");

    const grey = await storedRule("GREY");
    await dispatch({
      type: "UPDATE_EXPRESSION",
      payload: { ...grey, listType: "WHITE" },
    });
    await expectTitle("WHITE");
  }, 60000);

  it("repaints when the whole list is removed", async () => {
    await dispatch({ type: "ADD_EXPRESSION", payload: rule("WHITE") });
    await expectTitle("WHITE");

    await dispatch({ type: "REMOVE_LIST", payload: "default" });
    await expectTitle("NO LIST");
  }, 60000);
});
