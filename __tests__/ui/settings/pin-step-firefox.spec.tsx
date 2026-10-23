/**
 * @jest-environment jsdom
 */

/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * The pin step on the Firefox build (#536). Desktop Firefox pins through
 * the Extensions button and "Pin to Toolbar"; Firefox for Android (same
 * build, no windows API) has no toolbar, so the step points to Firefox's
 * menu instead. Neither shows Chrome's wording.
 */
import * as React from "react";
import { render } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore } from "redux";
import { installAndroidFlavor } from "../../android-flavor";

vi.stubGlobal("__BROWSER__", "firefox");
vi.resetModules();
const { initialState } = await import("@/redux/state");
const { default: Help } = await import("@/ui/settings/components/Help");
const { default: Welcome } = await import("@/ui/settings/components/Welcome");
const { pinStepKeys } = await import("@/ui/settings/pin-step");

const setupStep = (): string | null => {
  const { container } = render(
    <Provider store={createStore(() => initialState)}>
      <Welcome switchTabs={vi.fn()} />
    </Provider>
  );
  return container.querySelectorAll("#setupSteps li")[2].textContent;
};

const helpBody = (): string | null => {
  const { container } = render(<Help />);
  return container.querySelector("details div")?.textContent ?? null;
};

describe("pin step on the Firefox build (#536)", () => {
  beforeEach(() => {
    global.browser.i18n.getMessage.mockImplementation(
      (key: string, substitutions?: string | string[]) =>
        substitutions ? `${key}[${[substitutions].flat().join("|")}]` : key
    );
  });

  describe("on desktop Firefox", () => {
    it("picks the desktop Firefox keys", () => {
      expect(pinStepKeys()).toEqual({
        help: "helpPinStepFirefoxText",
        setup: "setupStepPinFirefoxText",
      });
    });

    it("shows the Firefox pin step on the Overview", () => {
      expect(setupStep()).toBe("setupStepPinFirefoxText");
    });

    it("fills Help's item 4 with the Firefox pin step", () => {
      expect(helpBody()).toBe("helpGettingStartedBody[helpPinStepFirefoxText]");
    });
  });

  describe("on Firefox for Android", () => {
    beforeAll(() => installAndroidFlavor());

    it("picks the Android keys", () => {
      expect(global.browser.windows).toBeUndefined();
      expect(pinStepKeys()).toEqual({
        help: "helpPinStepAndroidText",
        setup: "setupStepMenuAndroidText",
      });
    });

    it("points the Overview's step 3 to Firefox's menu", () => {
      expect(setupStep()).toBe("setupStepMenuAndroidText");
    });

    it("fills Help's item 4 with the menu step", () => {
      expect(helpBody()).toBe("helpGettingStartedBody[helpPinStepAndroidText]");
    });
  });
});
