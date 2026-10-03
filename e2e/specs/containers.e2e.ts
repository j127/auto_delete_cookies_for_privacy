/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * Matrix rows 7, 8, 9, 10 and 14: Firefox containers (#430). Containers
 * are created and removed from the probe, container tabs are opened from
 * it with browser.tabs.create({ cookieStoreId }), settings and rules go
 * through the live store bridge, and Saved sites is driven through its
 * real controls. Rows 7, 8, 9 and 14 share one session; row 10 needs a
 * profile with containers switched off, so it runs in its own.
 *
 * What stays manual: the popup's keep buttons and the native right-click
 * menu, which webdriver drives neither of. Both write through
 * effectiveListKey (unit specs pin that), so the rules below are
 * dispatched straight into the list those entry points would pick.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { By, WebElement } from "selenium-webdriver";
import {
  closeTab,
  FirefoxSession,
  launchFirefox,
  openTab,
  probe,
  readBoolPref,
  setBoolPref,
  stopGeckodriver,
  waitUntil,
} from "../helpers/firefox_driver";
import { FixtureServer, startFixtureServer } from "../helpers/fixture_server";

interface ProbeCookie {
  name: string;
  storeId: string;
}

interface StoredExpression {
  id: string;
  expression: string;
  listType: string;
  storeId: string;
}

interface ActivityEntry {
  storeIds?: Record<string, { cookie: { name: string; hostname: string } }[]>;
  browsingDataCleanup?: { LocalStorage?: string[] };
}

interface PersistedState {
  lists?: Record<string, StoredExpression[]>;
  activityLog?: ActivityEntry[];
}

const DEFAULT_STORE = "firefox-default";
const CONTAINER_A = "ADCP e2e A";

let session: FirefoxSession;
let fixture: FixtureServer;

const cookieNames = async (
  storeId: string,
  domain: string
): Promise<string[]> =>
  (
    (await probe(session, {
      kind: "getAllCookies",
      details: { firstPartyDomain: null, partitionKey: {}, storeId, domain },
    })) as ProbeCookie[]
  ).map((c) => c.name);

const hasFixtureCookies = async (
  storeId: string,
  domain: string
): Promise<boolean> => {
  const names = await cookieNames(storeId, domain);
  return names.includes("e2e_header") && names.includes("e2e_js");
};

const hasNoFixtureCookies = async (
  storeId: string,
  domain: string
): Promise<boolean> =>
  !(await cookieNames(storeId, domain)).some((n) => n.startsWith("e2e_"));

const persistedState = async (): Promise<PersistedState> =>
  (await probe(session, { kind: "getState" })) as PersistedState;

/**
 * The persisted copy lags the live store by the background's one-second
 * write debounce, so every check of the lists polls it.
 */
const waitForLists = async (
  check: (lists: Record<string, StoredExpression[]>) => boolean,
  timeoutMs = 10000
): Promise<boolean> =>
  waitUntil(async () => check((await persistedState()).lists ?? {}), timeoutMs);

const expressionsIn = (
  lists: Record<string, StoredExpression[]>,
  listKey: string
): string[] => (lists[listKey] ?? []).map((e) => e.expression);

/**
 * Whether a list holds the rule. An exact comparison on purpose: CodeQL
 * reads includes() with a host-like literal as URL substring checking.
 */
const hasRule = (
  lists: Record<string, StoredExpression[]>,
  listKey: string,
  expression: string
): boolean => expressionsIn(lists, listKey).some((e) => e === expression);

const dispatch = async (action: Record<string, unknown>): Promise<void> => {
  await probe(session, { kind: "dispatch", action });
};

/** Adds a keep rule to a list through the store bridge, then confirms it. */
const keep = async (expression: string, listKey: string): Promise<void> => {
  await dispatch({
    type: "ADD_EXPRESSION",
    payload: { expression, listType: "WHITE", storeId: listKey },
  });
  const stored = await waitForLists((lists) =>
    hasRule(lists, listKey, expression)
  );
  if (!stored) throw new Error(`rule ${expression} never reached ${listKey}`);
};

/** Empties every list and waits until the persisted copy agrees. */
const clearLists = async (): Promise<void> => {
  await dispatch({ type: "CLEAR_EXPRESSIONS", payload: {} });
  const cleared = await waitForLists(
    (lists) => Object.keys(lists).length === 0
  );
  if (!cleared) throw new Error("lists were not cleared");
};

const applySettings = async (
  settings: Record<string, unknown>
): Promise<void> => {
  const applied = (await probe(session, {
    kind: "updateSettings",
    settings,
  })) as Record<string, unknown>;
  for (const [name, value] of Object.entries(settings)) {
    if (applied[name] !== value) {
      throw new Error(`settings not applied: ${JSON.stringify(applied)}`);
    }
  }
};

const createContainer = async (name: string): Promise<string> => {
  const created = (await probe(session, {
    kind: "createContainer",
    name,
  })) as { cookieStoreId?: string; error?: string };
  if (!created.cookieStoreId) {
    throw new Error(`container not created: ${created.error}`);
  }
  return created.cookieStoreId;
};

/**
 * Opens each url in a container tab, runs the checks that need the tabs
 * open, and closes the tabs even when a check fails: an open tab protects
 * its site, so a leftover tab would hide the next row's cleanup (see
 * whileOpen in cleanup.e2e.ts).
 */
const whileOpenInContainer = async (
  cookieStoreId: string,
  urls: string[],
  checks: () => Promise<void>
): Promise<void> => {
  const tabIds: number[] = [];
  try {
    for (const url of urls) {
      const opened = (await probe(session, {
        kind: "openContainerTab",
        url,
        cookieStoreId,
      })) as { tabId?: number; probeError?: string };
      if (opened.tabId === undefined) {
        throw new Error(`container tab not opened: ${opened.probeError}`);
      }
      tabIds.push(opened.tabId);
    }
    await checks();
  } finally {
    for (const tabId of tabIds) {
      await probe(session, { kind: "closeTabById", tabId });
    }
  }
};

/** The UI string for a message id, read in the settings page itself. */
const message = async (name: string): Promise<string> => {
  const { driver, probeHandle } = session;
  await driver.switchTo().window(probeHandle);
  return (await driver.executeScript(
    "return browser.i18n.getMessage(arguments[0]);",
    name
  )) as string;
};

/**
 * Turns the probe tab into Saved sites. The app reads the hash only on
 * mount, hence the refresh; the container selector is filled from a live
 * contextualIdentities query on mount too, so containers must exist first.
 */
const openSavedSites = async (): Promise<void> => {
  const { driver, extensionOrigin, probeHandle } = session;
  await driver.switchTo().window(probeHandle);
  await driver.get(
    `${extensionOrigin}/settings/settings.html#tabExpressionList`
  );
  await driver.navigate().refresh();
  const mounted = await waitUntil(
    async () =>
      (await driver.findElements(By.id("storeIdSelector"))).length > 0,
    15000
  );
  if (!mounted) throw new Error("Saved sites never rendered");
};

/**
 * The selector's options as [value, label] pairs, read in one script: the
 * options re-render while the container query settles (a container's list
 * shows as orphaned until the query answers), so element handles go stale.
 */
const listOptions = async (): Promise<[string, string][]> =>
  (await session.driver.executeScript(
    `return [...document.querySelectorAll("#storeIdSelector option")].map(
      (o) => [o.value, o.textContent]
    );`
  )) as [string, string][];

/**
 * Picks a list in the "Which list" selector with a real click, once its
 * option carries the expected label (a container's name, or the orphaned
 * marker). Retried as a whole, since a re-render can swap the option node
 * between the find and the click.
 */
const selectList = async (listKey: string, label: string): Promise<void> => {
  const { driver } = session;
  const selected = await waitUntil(
    async () => {
      const ready = (await listOptions()).some(
        ([value, text]) => value === listKey && text.includes(label)
      );
      if (!ready) return false;
      try {
        // Clicking the option alone selects it and fires change; clicking
        // the select first would open its dropdown.
        await driver
          .findElement(By.css(`#storeIdSelector option[value="${listKey}"]`))
          .click();
      } catch {
        return false;
      }
      return (
        (await driver.executeScript(
          'return document.getElementById("storeIdSelector").value;'
        )) === listKey
      );
    },
    15000,
    300
  );
  if (!selected) {
    throw new Error(
      `could not select ${listKey} (${label}): ${JSON.stringify(await listOptions())}`
    );
  }
};

/** The button whose label contains text, or null when there is none. */
const buttonWithText = async (text: string): Promise<WebElement | null> =>
  (await session.driver.executeScript(
    `return [...document.querySelectorAll("button")].find((b) =>
      b.textContent.includes(arguments[0])
    ) ?? null;`,
    text
  )) as WebElement | null;

/** Whether an alert of the given DaisyUI kind shows text. */
const alertShows = async (
  kind: "success" | "error",
  text: string
): Promise<boolean> =>
  (await session.driver.executeScript(
    `return [...document.querySelectorAll('[role="alert"].alert-' + arguments[0])]
      .some((a) => a.textContent.includes(arguments[1]));`,
    kind,
    text
  )) as boolean;

beforeAll(async () => {
  fixture = await startFixtureServer();
}, 30000);

afterAll(async () => {
  stopGeckodriver();
  await fixture?.stop();
});

describe("containers available (rows 7, 8, 9, 14)", () => {
  let containerA: string;

  beforeAll(async () => {
    session = await launchFirefox();
    await applySettings({ activeMode: true, delayBeforeClean: 1 });
    containerA = await createContainer(CONTAINER_A);
  }, 120000);

  afterAll(async () => {
    await session?.quit();
  });

  describe("row 7: containers, separate keep lists on", () => {
    beforeAll(async () => {
      await clearLists();
      await applySettings({ contextualIdentities: true });
      await keep("localhost", containerA);
    }, 60000);

    it("honors a container's rule in that container only", async () => {
      // localhost is kept in container A; 127.0.0.1 in the same container
      // is not, and its removal shows a cleanup covered the container.
      await whileOpenInContainer(
        containerA,
        [`${fixture.primary}/cookies`, `${fixture.thirdParty}/cookies`],
        async () => {
          const appeared = await waitUntil(
            async () =>
              (await hasFixtureCookies(containerA, "localhost")) &&
              (await hasFixtureCookies(containerA, "127.0.0.1")),
            15000
          );
          expect(appeared).toBe(true);
        }
      );
      const defaultTab = await openTab(session, `${fixture.primary}/cookies`);
      try {
        const appeared = await waitUntil(
          () => hasFixtureCookies(DEFAULT_STORE, "localhost"),
          15000
        );
        expect(appeared).toBe(true);
      } finally {
        await closeTab(session, defaultTab);
      }

      // Both cleanups ran once the default tab's localhost cookies and the
      // container's unkept 127.0.0.1 cookies are gone.
      const cleaned = await waitUntil(
        async () =>
          (await hasNoFixtureCookies(DEFAULT_STORE, "localhost")) &&
          (await hasNoFixtureCookies(containerA, "127.0.0.1")),
        45000
      );
      expect(cleaned).toBe(true);
      expect(await hasFixtureCookies(containerA, "localhost")).toBe(true);
    }, 120000);

    it("copies the Default rules into the container list once", async () => {
      await keep("example.com", "default");
      await openSavedSites();
      await selectList(containerA, CONTAINER_A);
      // The not-applied notice belongs to row 8; with lists on it is gone.
      expect(
        await session.driver.findElements(By.id("containerListsOffNotice"))
      ).toHaveLength(0);

      const copyText = await message("copyDefaultRulesText");
      const firstPress = await buttonWithText(copyText);
      if (!firstPress) throw new Error(`no "${copyText}" button`);
      await firstPress.click();
      const copied = await waitForLists((lists) =>
        hasRule(lists, containerA, "example.com")
      );
      expect(copied).toBe(true);

      const secondPress = await buttonWithText(copyText);
      if (!secondPress) throw new Error(`no "${copyText}" button`);
      await secondPress.click();
      const noneFound = await message("copyDefaultRulesNoneFound");
      expect(await waitUntil(() => alertShows("error", noneFound), 5000)).toBe(
        true
      );
      // Past the persist debounce, so a second copy would show by now.
      await new Promise((r) => setTimeout(r, 2000));
      const lists = (await persistedState()).lists ?? {};
      expect(expressionsIn(lists, containerA).sort()).toEqual([
        "example.com",
        "localhost",
      ]);
    }, 60000);
  });

  describe("row 8: containers, separate keep lists off (the default)", () => {
    beforeAll(async () => {
      await clearLists();
      await applySettings({ contextualIdentities: false });
      // With separate lists off, the popup and the context menu write a
      // container tab's rule into the Default list (effectiveListKey).
      await keep("localhost", "default");
      // A rule in the container's own list is not applied while off.
      await keep("127.0.0.1", containerA);
    }, 60000);

    it("lets the Default list govern a container tab", async () => {
      await whileOpenInContainer(
        containerA,
        [`${fixture.primary}/cookies`, `${fixture.thirdParty}/cookies`],
        async () => {
          const appeared = await waitUntil(
            async () =>
              (await hasFixtureCookies(containerA, "localhost")) &&
              (await hasFixtureCookies(containerA, "127.0.0.1")),
            15000
          );
          expect(appeared).toBe(true);
        }
      );

      const cleaned = await waitUntil(
        () => hasNoFixtureCookies(containerA, "127.0.0.1"),
        45000
      );
      expect(cleaned).toBe(true);
      expect(await hasFixtureCookies(containerA, "localhost")).toBe(true);
    }, 90000);

    it("warns on Saved sites that the container list is not applied", async () => {
      await openSavedSites();
      await selectList(containerA, CONTAINER_A);
      const noticeShown = await waitUntil(
        async () =>
          (await session.driver.findElements(By.id("containerListsOffNotice")))
            .length > 0,
        5000
      );
      expect(noticeShown).toBe(true);
      // The copy button needs separate lists on, so it is hidden here.
      expect(
        await buttonWithText(await message("copyDefaultRulesText"))
      ).toBeNull();
    }, 60000);
  });

  describe("row 9: deleting a container with cleanup of deleted containers on", () => {
    let containerB: string;

    beforeAll(async () => {
      await clearLists();
      await applySettings({
        contextualIdentities: true,
        contextualIdentitiesAutoRemove: true,
      });
      containerB = await createContainer("ADCP e2e B");
      await keep("localhost", containerB);
    }, 60000);

    it("drops the removed container's list and cookies", async () => {
      // The container's own rule keeps its cookies past the tab close.
      await whileOpenInContainer(
        containerB,
        [`${fixture.primary}/cookies`],
        async () => {
          const appeared = await waitUntil(
            () => hasFixtureCookies(containerB, "localhost"),
            15000
          );
          expect(appeared).toBe(true);
        }
      );

      const removed = (await probe(session, {
        kind: "removeContainer",
        cookieStoreId: containerB,
      })) as { ok?: boolean; error?: string };
      expect(removed.error).toBeUndefined();

      const listDropped = await waitForLists(
        (lists) => lists[containerB] === undefined
      );
      expect(listDropped).toBe(true);
      // Firefox itself clears a removed container's cookie store (seen on
      // 156 with this setting off), so this check pins the end state the
      // row expects; the list check above is the one that catches a broken
      // onRemoved handler.
      const cookiesGone = await waitUntil(
        () => hasNoFixtureCookies(containerB, "localhost"),
        15000
      );
      expect(cookiesGone).toBe(true);
    }, 90000);
  });

  describe("row 14: cross-container storage guard", () => {
    beforeAll(async () => {
      await clearLists();
      await applySettings({ contextualIdentities: true });
      await keep("localhost", containerA);
      await dispatch({ type: "CLEAR_ACTIVITY_LOG" });
      const emptied = await waitUntil(
        async () => ((await persistedState()).activityLog ?? []).length === 0,
        10000
      );
      if (!emptied) throw new Error("activity log was not cleared");
    }, 60000);

    it("leaves a site's storage alone while another container keeps it", async () => {
      // Two sites in the default store, where neither is kept: localhost is
      // kept in container A, 127.0.0.1 nowhere, so only 127.0.0.1 may join
      // the storage wipe. No tab of either stays open (an open tab in any
      // store also vetoes the wipe, which would hide the list guard).
      const tabs = [
        await openTab(session, `${fixture.primary}/storage`),
        await openTab(session, `${fixture.thirdParty}/storage`),
      ];
      try {
        const appeared = await waitUntil(
          async () =>
            (await cookieNames(DEFAULT_STORE, "localhost")).includes(
              "e2e_storage_marker"
            ) &&
            (await cookieNames(DEFAULT_STORE, "127.0.0.1")).includes(
              "e2e_storage_marker"
            ),
          15000
        );
        expect(appeared).toBe(true);
      } finally {
        for (const tab of tabs) await closeTab(session, tab);
      }

      const wipedOf = (entry: ActivityEntry): string[] =>
        entry.browsingDataCleanup?.LocalStorage ?? [];
      const cleanedInDefault = (entry: ActivityEntry, host: string) =>
        (entry.storeIds?.[DEFAULT_STORE] ?? []).some(
          (o) =>
            o.cookie.name === "e2e_storage_marker" && o.cookie.hostname === host
        );
      let log: ActivityEntry[] = [];
      const settled = await waitUntil(async () => {
        log = (await persistedState()).activityLog ?? [];
        return (
          log.some((e) => cleanedInDefault(e, "localhost")) &&
          log.some((e) => wipedOf(e).includes("127.0.0.1"))
        );
      }, 45000);
      if (!settled) console.log("row14 log:", JSON.stringify(log));
      expect(settled).toBe(true);
      // localhost's cookies were cleaned in the default store, yet its
      // storage stayed out of every wipe.
      expect(log.flatMap(wipedOf)).not.toContain("localhost");
    }, 120000);
  });
});

describe("row 10: containers disabled (privacy.userContext.enabled=false)", () => {
  beforeAll(async () => {
    session = await launchFirefox({ "privacy.userContext.enabled": false });
    // Installing an extension with the contextualIdentities permission
    // switches containers back on (Firefox 156 reads the pref as true
    // right after the install), so the launch pref alone does not hold.
    // Switching it off again from chrome context does, and the API then
    // rejects exactly as it does for a user who disabled containers. The
    // matrix row's restart step stays manual: webdriver's profile does
    // not survive a restart.
    await setBoolPref(session, "privacy.userContext.enabled", false);
    if (
      (await readBoolPref(session, "privacy.userContext.enabled")) !== false
    ) {
      throw new Error("privacy.userContext.enabled did not stay false");
    }
    const query = (await probe(session, { kind: "queryContainers" })) as {
      error?: string;
    };
    if (query.error === undefined) {
      throw new Error("contextualIdentities.query still answers");
    }
    await applySettings({ activeMode: true, delayBeforeClean: 1 });
  }, 120000);

  afterAll(async () => {
    await session?.quit();
  });

  it("cleans up with the container API rejecting", async () => {
    const tab = await openTab(session, `${fixture.primary}/cookies`);
    try {
      const appeared = await waitUntil(
        () => hasFixtureCookies(DEFAULT_STORE, "localhost"),
        15000
      );
      expect(appeared).toBe(true);
    } finally {
      await closeTab(session, tab);
    }
    const cleaned = await waitUntil(
      () => hasNoFixtureCookies(DEFAULT_STORE, "localhost"),
      45000
    );
    expect(cleaned).toBe(true);
  }, 90000);

  it("lists no containers and keeps orphaned lists manageable", async () => {
    // A list left behind by a container, as after an import or a removal.
    const orphan = "firefox-container-1";
    await keep("example.com", orphan);
    await openSavedSites();
    // Default, Private and the orphan; no live container is offered. The
    // profile still holds Firefox's four stock containers, one of them
    // firefox-container-1, but the rejected query hides them all.
    const orphanLabel = await message("orphanedStoreText");
    const values = async () => (await listOptions()).map(([value]) => value);
    expect(
      await waitUntil(async () => (await values()).includes(orphan), 10000)
    ).toBe(true);
    expect(await values()).toEqual(["default", "private", orphan]);

    await selectList(orphan, orphanLabel);
    const removeText = await message("removeOrphanedListText");
    const remove = await buttonWithText(removeText);
    if (!remove) throw new Error(`no "${removeText}" button`);
    await remove.click();
    const dropped = await waitForLists((lists) => lists[orphan] === undefined);
    expect(dropped).toBe(true);
  }, 60000);
});
