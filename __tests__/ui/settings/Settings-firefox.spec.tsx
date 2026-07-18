/**
 * @jest-environment jsdom
 */

/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2017-2022 Kenny Do and CAD Team; fork changes (c) 2026 j127.
 * Licensed under MIT (see LICENSE).
 */
import * as React from "react";
import { render } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore } from "redux";
import { SettingID } from "@/typings/enums";

vi.stubGlobal("__BROWSER__", "firefox");
vi.resetModules();
const { initialState } = await import("@/redux/state");
const { default: Settings } = await import("@/ui/settings/components/Settings");

// Advanced + debug both on: the only state that renders the debug panel.
const debugOn = (): State => ({
  ...initialState,
  settings: {
    ...initialState.settings,
    [SettingID.POPUP_ADVANCED]: {
      name: SettingID.POPUP_ADVANCED,
      value: true,
    },
    [SettingID.DEBUG_MODE]: {
      name: SettingID.DEBUG_MODE,
      value: true,
    },
  },
});

describe("Settings debug panel on Firefox", () => {
  beforeEach(() => {
    global.browser.i18n.getMessage.mockImplementation((key: string) => key);
  });

  it("points at about:debugging, not the Chrome service-worker console", () => {
    const store = createStore(() => debugOn());
    const { getByText } = render(
      <Provider store={store}>
        <Settings />
      </Provider>
    );
    const panel = getByText("openDebugMode").closest(
      "div.alert"
    ) as HTMLElement;
    expect(panel.textContent).toContain(
      "about:debugging#/runtime/this-firefox"
    );
    expect(panel.textContent).toContain("firefoxDebugMode");
    // The Chrome path must not leak into the Firefox build.
    expect(panel.textContent).not.toContain("chrome://");
    expect(panel.textContent).not.toContain("chromeDebugMode");
  });
});
