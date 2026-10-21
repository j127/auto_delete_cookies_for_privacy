/**
 * @jest-environment jsdom
 */

/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */
import * as React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore } from "redux";
import { SettingID } from "@/typings/enums";
import { installAndroidFlavor } from "../../android-flavor";

vi.stubGlobal("__BROWSER__", "firefox");
vi.resetModules();
installAndroidFlavor();
const { initialState } = await import("@/redux/state");
const { default: Expressions } =
  await import("@/ui/settings/components/Expressions");
const { default: Settings } = await import("@/ui/settings/components/Settings");

const withSettings = (overrides: Record<string, boolean>): State => {
  const settings = { ...initialState.settings };
  for (const [name, value] of Object.entries(overrides)) {
    settings[name] = { name, value };
  }
  return { ...initialState, settings };
};

describe("settings pages on Firefox for Android (#534)", () => {
  beforeEach(() => {
    global.browser.i18n.getMessage.mockImplementation((key: string) => key);
    global.browser.storage.session.get.mockResolvedValue({
      normalWindowSeen: false,
    } as never);
  });

  it("renders Saved sites without contextualIdentities instead of throwing", () => {
    expect(global.browser.contextualIdentities).toBeUndefined();
    const { container } = render(
      <Provider store={createStore(() => initialState)}>
        <Expressions />
      </Provider>
    );
    const selector = container.querySelector(
      "#storeIdSelector"
    ) as HTMLSelectElement;
    expect(Array.from(selector.options).map((o) => o.value)).toEqual([
      "default",
      "private",
    ]);
  });

  it("says the Private list stays saved because Android never reports the end of private browsing", async () => {
    const { container } = render(
      <Provider store={createStore(() => initialState)}>
        <Expressions />
      </Provider>
    );
    fireEvent.change(container.querySelector("#storeIdSelector") as Element, {
      target: { value: "private" },
    });
    await waitFor(() =>
      expect(
        container.querySelector("#privateListErasedNotice")?.textContent
      ).toBe("privateListKeptAndroidText")
    );
  });

  it("stacks the add bar on a phone so the input keeps its width", () => {
    const { container } = render(
      <Provider store={createStore(() => initialState)}>
        <Expressions />
      </Provider>
    );
    const bar = container.querySelector("#formText")?.parentElement;
    ["join", "join-vertical", "sm:join-horizontal", "w-full"].forEach((cls) =>
      expect(bar?.classList.contains(cls)).toBe(true)
    );
  });

  it("hides the container settings and the context menu setting", () => {
    const { queryByText } = render(
      <Provider
        store={createStore(() =>
          withSettings({
            [SettingID.POPUP_ADVANCED]: true,
            [SettingID.CONTEXTUAL_IDENTITIES]: true,
          })
        )}
      >
        <Settings />
      </Provider>
    );
    expect(queryByText("settingGroupContainers")).toBeNull();
    expect(queryByText("containerListsText")).toBeNull();
    expect(queryByText("enableContextMenus")).toBeNull();
    // The rest of the Extension group is still there.
    expect(queryByText("settingGroupExtension")).not.toBeNull();
  });
});
