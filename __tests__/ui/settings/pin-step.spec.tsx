/**
 * @jest-environment jsdom
 */

/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * The pin step on the Chrome build (#536): the Overview's activation card
 * and Help's getting-started item 4 keep Chrome's puzzle-icon wording,
 * word for word as before the per-browser keys.
 */
import * as React from "react";
import { render } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore } from "redux";
import { initialState } from "@/redux/state";
import Help from "@/ui/settings/components/Help";
import Welcome from "@/ui/settings/components/Welcome";
import { pinStepKeys } from "@/ui/settings/pin-step";
import en from "../../../extension/_locales/en/messages.json";

type Messages = Record<
  string,
  { message: string; placeholders?: Record<string, { content: string }> }
>;
const messages = en as unknown as Messages;

/** browser.i18n.getMessage over the real en strings, with substitutions. */
const enMessage = (key: string, substitutions: string[] = []): string => {
  const entry = messages[key];
  if (!entry) return "";
  return entry.message.replace(/\$([a-zA-Z0-9_@]+)\$/g, (_, name: string) => {
    const content = Object.entries(entry.placeholders ?? {}).find(
      ([n]) => n.toLowerCase() === name.toLowerCase()
    )?.[1].content;
    const index = Number(content?.slice(1)) - 1;
    return substitutions[index] ?? "";
  });
};

// The en wording before #536, which Chrome must keep.
const CHROME_SETUP_STEP =
  "Pin the extension so it stays visible: click the puzzle icon in Chrome's toolbar, then the pin next to Auto-Delete Cookies for Privacy.";
const CHROME_HELP_ITEM =
  "4. Pin the toolbar icon. Click the puzzle icon in Chrome's toolbar, then the pin next to Auto-Delete Cookies for Privacy, so the icon and its cookie-count badge stay visible.";

describe("pin step on Chrome (#536)", () => {
  beforeEach(() => {
    global.browser.i18n.getMessage.mockImplementation(
      enMessage as typeof global.browser.i18n.getMessage
    );
  });

  it("picks the Chrome keys", () => {
    expect(pinStepKeys()).toEqual({
      help: "helpPinStepText",
      setup: "setupStepPinText",
    });
  });

  it("keeps the Overview's step 3 text unchanged", () => {
    const { container } = render(
      <Provider store={createStore(() => initialState)}>
        <Welcome switchTabs={vi.fn()} />
      </Provider>
    );
    const steps = Array.from(container.querySelectorAll("#setupSteps li"));
    expect(steps[2].textContent).toBe(CHROME_SETUP_STEP);
  });

  it("keeps Help's getting-started item 4 unchanged", () => {
    const { container } = render(<Help />);
    const body = container.querySelector("details div")?.textContent ?? "";
    expect(body.split("\n\n")[4]).toBe(CHROME_HELP_ITEM);
    expect(body).not.toContain("$");
    expect(body.split("\n\n")).toHaveLength(6);
  });

  it("gives Firefox wording that does not mention Chrome", () => {
    [
      "setupStepPinFirefoxText",
      "setupStepMenuAndroidText",
      "helpPinStepFirefoxText",
      "helpPinStepAndroidText",
    ].forEach((key) => {
      expect(messages[key].message).toContain("Firefox");
      expect(messages[key].message).not.toContain("Chrome");
    });
    expect(messages.setupStepPinFirefoxText.message).toContain(
      "“Pin to Toolbar”"
    );
    expect(messages.setupStepMenuAndroidText.message).toContain("Extensions");
  });
});
