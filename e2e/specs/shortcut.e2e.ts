/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * The keyboard shortcut for pausing automatic cleaning (#555) ships with
 * no key (#558): Firefox registers the command unassigned, and the user
 * can give it one, as Add-ons → Manage Extension Shortcuts does.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  FirefoxSession,
  inProbe,
  launchFirefox,
  stopGeckodriver,
} from "../helpers/firefox_driver";

const COMMAND = "toggle-active-mode";

let session: FirefoxSession;

const shortcutOf = async (): Promise<string | undefined | null> =>
  (await inProbe(
    session,
    `const all = await browser.commands.getAll();
     const command = all.find((c) => c.name === args[0]);
     return command ? command.shortcut ?? null : undefined;`,
    COMMAND
  )) as string | undefined | null;

beforeAll(async () => {
  session = await launchFirefox();
}, 120000);

afterAll(async () => {
  await session?.quit();
  stopGeckodriver();
});

describe("the pause shortcut (#555, #558)", () => {
  it("is registered with no key", async () => {
    const shortcut = await shortcutOf();
    // undefined would mean the command is missing altogether.
    expect(shortcut).not.toBeUndefined();
    expect(shortcut || "").toBe("");
  });

  it("takes a key the user assigns", async () => {
    await inProbe(
      session,
      `await browser.commands.update({ name: args[0], shortcut: "Alt+Shift+Y" });
       return true;`,
      COMMAND
    );
    expect(await shortcutOf()).toBe("Alt+Shift+Y");
    await inProbe(
      session,
      `await browser.commands.reset(args[0]); return true;`,
      COMMAND
    );
    expect((await shortcutOf()) || "").toBe("");
  });
});

describe("the popup-action shortcuts (#588)", () => {
  const ACTIONS = [
    "clean-now",
    "clean-now-including-open-tabs",
    "delete-site-cookies",
    "keep-site",
    "keep-site-until-browser-closes",
  ];

  it("are registered with no key and a translated description", async () => {
    const commands = (await inProbe(
      session,
      `const all = await browser.commands.getAll();
       return all
         .filter((c) => args[0].includes(c.name))
         .map((c) => ({
           name: c.name,
           shortcut: c.shortcut || "",
           description: c.description || "",
         }));`,
      ACTIONS
    )) as { name: string; shortcut: string; description: string }[];
    expect(commands.map((c) => c.name).sort()).toEqual([...ACTIONS].sort());
    for (const command of commands) {
      expect(command.shortcut).toBe("");
      expect(command.description).not.toBe("");
      expect(command.description).not.toContain("__MSG_");
    }
  });
});
