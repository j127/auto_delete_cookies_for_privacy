/**
 * @jest-environment jsdom
 */

/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2017-2022 Kenny Do and CAD Team; fork changes (c) 2026 j127.
 * Licensed under MIT (see LICENSE).
 */
import * as React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore } from "redux";
import { when } from "jest-when";
import { ReduxConstants } from "@/typings/redux-constants";

vi.stubGlobal("__BROWSER__", "firefox");
vi.resetModules();
const { initialState } = await import("@/redux/state");
const { default: Expressions } =
  await import("@/ui/settings/components/Expressions");

describe("Expressions store selector on Firefox", () => {
  const renderExpressions = () => {
    const store = createStore(() => ({ ...initialState }));
    const dispatchSpy = jest.spyOn(store, "dispatch");
    const rendered = render(
      <Provider store={store}>
        <Expressions />
      </Provider>
    );
    return { dispatchSpy, ...rendered };
  };

  const selector = (container: HTMLElement) =>
    container.querySelector("#storeIdSelector") as HTMLSelectElement;

  beforeEach(() => {
    global.browser.i18n.getMessage.mockImplementation((key: string) => key);
  });

  it("lists live containers by name and adds expressions into the chosen one", async () => {
    when(global.browser.contextualIdentities.query)
      .calledWith(expect.any(Object))
      .mockResolvedValue([
        {
          cookieStoreId: "firefox-container-7",
          color: "orange",
          colorCode: "#ff9f00",
          icon: "briefcase",
          iconUrl: "resource://usercontext-content/briefcase.svg",
          name: "Work",
        },
      ] as never);
    const { container, dispatchSpy } = renderExpressions();
    await waitFor(() => {
      expect(
        Array.from(selector(container).options).map((o) => o.value)
      ).toContain("firefox-container-7");
    });
    const workOption = Array.from(selector(container).options).find(
      (o) => o.value === "firefox-container-7"
    );
    expect(workOption?.textContent).toBe("Work");

    fireEvent.change(selector(container), {
      target: { value: "firefox-container-7" },
    });
    const input = container.querySelector("#formText") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "work.example" } });
    fireEvent.keyUp(input, { key: "Enter" });
    expect(dispatchSpy).toHaveBeenCalledWith({
      payload: expect.objectContaining({
        expression: "work.example",
        storeId: "firefox-container-7",
      }),
      type: ReduxConstants.ADD_EXPRESSION,
    });
  });

  it("falls back to Default/Private when the container query rejects", async () => {
    when(global.browser.contextualIdentities.query)
      .calledWith(expect.any(Object))
      .mockRejectedValue(
        new Error("Contextual identities are currently disabled") as never
      );
    const { container } = renderExpressions();
    // The rejection resolves asynchronously; the selector never gains
    // container entries.
    await waitFor(() => {
      expect(
        Array.from(selector(container).options).map((o) => o.value)
      ).toEqual(["default", "private"]);
    });
  });
});
