/**
 * @jest-environment jsdom
 */

/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2017-2022 Kenny Do and CAD Team; fork changes (c) 2026 j127.
 * Licensed under MIT (see LICENSE).
 */
import * as React from "react";
import { fireEvent, render } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore } from "redux";
import { SettingID } from "@/typings/enums";
import { ReduxConstants } from "@/typings/redux-constants";

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

// Issue #370: the contextualIdentities setting decides which keep list
// governs a container tab, but it shipped with no toggle anywhere, so
// per-container lists could never be turned on. The card is Firefox-only.
describe("Settings Firefox containers card", () => {
  const withContainerLists = (value: boolean): State => ({
    ...initialState,
    settings: {
      ...initialState.settings,
      [SettingID.CONTEXTUAL_IDENTITIES]: {
        name: SettingID.CONTEXTUAL_IDENTITIES,
        value,
      },
    },
  });

  const renderSettings = (state: State = initialState) => {
    const store = createStore(() => state);
    const dispatchSpy = jest.spyOn(store, "dispatch");
    return {
      dispatchSpy,
      ...render(
        <Provider store={store}>
          <Settings />
        </Provider>
      ),
    };
  };

  const toggle = (container: HTMLElement) =>
    container.querySelector("#contextualIdentities") as HTMLInputElement;

  beforeEach(() => {
    global.browser.i18n.getMessage.mockImplementation((key: string) => key);
  });

  it("renders the card and the per-container toggle without Advanced mode", () => {
    // Advanced mode is off in initialState: the toggle must be reachable
    // without it, since an unreachable toggle is the bug being fixed.
    const { container, getByText } = renderSettings();
    const title = getByText("settingGroupContainers");
    expect(title.tagName).toBe("H2");
    const card = title.closest("section") as HTMLElement;
    expect(card.textContent).toContain("containerListsText");
    expect(card.textContent).toContain("containerListsDescText");
    expect(toggle(container).type).toBe("checkbox");
    expect(toggle(container).checked).toBe(false);
  });

  it("dispatches UPDATE_SETTING when the per-container toggle is flipped", () => {
    const { container, dispatchSpy } = renderSettings();
    fireEvent.click(toggle(container));
    expect(dispatchSpy).toHaveBeenCalledWith({
      payload: { name: SettingID.CONTEXTUAL_IDENTITIES, value: true },
      type: ReduxConstants.UPDATE_SETTING,
    });
  });

  it("reveals the auto-remove toggle only while per-container lists are on", () => {
    const off = renderSettings(withContainerLists(false));
    expect(off.queryByText("containerAutoRemoveText")).toBeNull();
    expect(
      off.container.querySelector("#contextualIdentitiesAutoRemove")
    ).toBeNull();
    off.unmount();

    const on = renderSettings(withContainerLists(true));
    expect(toggle(on.container).checked).toBe(true);
    expect(on.getByText("containerAutoRemoveText")).not.toBeNull();
    expect(on.getByText("containerAutoRemoveDescText")).not.toBeNull();
    const autoRemove = on.container.querySelector(
      "#contextualIdentitiesAutoRemove"
    ) as HTMLInputElement;
    expect(autoRemove.checked).toBe(false);
    fireEvent.click(autoRemove);
    expect(on.dispatchSpy).toHaveBeenCalledWith({
      payload: {
        name: SettingID.CONTEXTUAL_IDENTITIES_AUTOREMOVE,
        value: true,
      },
      type: ReduxConstants.UPDATE_SETTING,
    });
  });

  it("renders without console errors with per-container lists on", () => {
    renderSettings(withContainerLists(true));
    expect(console.error).not.toHaveBeenCalled();
  });
});
