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
import { ListType, SettingID } from "@/typings/enums";
import { ReduxConstants } from "@/typings/redux-constants";

vi.stubGlobal("__BROWSER__", "firefox");
vi.resetModules();
const { initialState } = await import("@/redux/state");
const { default: Expressions } =
  await import("@/ui/settings/components/Expressions");

describe("Expressions store selector on Firefox", () => {
  const renderExpressions = (stateOverrides: Partial<State> = {}) => {
    const store = createStore(() => ({ ...initialState, ...stateOverrides }));
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

  const workContainer = {
    cookieStoreId: "firefox-container-7",
    color: "orange",
    colorCode: "#ff9f00",
    icon: "briefcase",
    iconUrl: "resource://usercontext-content/briefcase.svg",
    name: "Work",
  };

  const withContainerLists = (value: boolean): Partial<State> => ({
    settings: {
      ...initialState.settings,
      [SettingID.CONTEXTUAL_IDENTITIES]: {
        name: SettingID.CONTEXTUAL_IDENTITIES,
        value,
      },
    },
  });

  const selectWork = async (container: HTMLElement) => {
    await waitFor(() => {
      expect(
        Array.from(selector(container).options).map((o) => o.value)
      ).toContain("firefox-container-7");
    });
    fireEvent.change(selector(container), {
      target: { value: "firefox-container-7" },
    });
  };

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

  // Issue #370: while per-container lists are off, cleanup folds every
  // container store onto "default" and never reads a container list, so
  // the page must say why rules kept in one do not apply.
  describe("inactive container list notice", () => {
    const notice = (container: HTMLElement) =>
      container.querySelector("#containerListsOffNotice");

    beforeEach(() => {
      when(global.browser.contextualIdentities.query)
        .calledWith(expect.any(Object))
        .mockResolvedValue([workContainer] as never);
    });

    it("warns that a container list is not applied while per-container lists are off", async () => {
      const { container } = renderExpressions(withContainerLists(false));
      expect(notice(container)).toBeNull();
      await selectWork(container);
      const band = notice(container) as HTMLElement;
      expect(band.className).toContain("alert-warning");
      expect(band.textContent).toBe("containerListsOffNoticeText");
      // The toggle's own label and the tab name are substituted in, so the
      // notice keeps pointing at the right control once translated.
      expect(global.browser.i18n.getMessage).toHaveBeenCalledWith(
        "containerListsOffNoticeText",
        ["containerListsText", "protectionText"]
      );
      // The container stays selected and listed: rules already kept there
      // remain viewable and deletable.
      expect(selector(container).value).toBe("firefox-container-7");
    });

    it("shows no notice while per-container lists are on", async () => {
      const { container } = renderExpressions(withContainerLists(true));
      await selectWork(container);
      expect(notice(container)).toBeNull();
    });

    it("shows no notice for the Default and Private lists", async () => {
      const { container } = renderExpressions(withContainerLists(false));
      await selectWork(container);
      fireEvent.change(selector(container), { target: { value: "default" } });
      expect(notice(container)).toBeNull();
      fireEvent.change(selector(container), { target: { value: "private" } });
      expect(notice(container)).toBeNull();
    });
  });
  // Issue #410: with per-container lists on, a container tab answers to its
  // own list alone — effectiveListKey stops folding it onto "default" — so
  // a long Default list leaves every container unprotected until its rules
  // are added again. The button copies them across in one click.
  describe("copy rules from Default", () => {
    const rule = (
      expression: string,
      listType: ListType,
      extra: Partial<Expression> = {}
    ): Expression => ({
      expression,
      id: expression,
      listType,
      storeId: "default",
      ...extra,
    });

    const defaultList: ReadonlyArray<Expression> = [
      rule("example.com", ListType.WHITE),
      rule("*.example.org", ListType.GREY, {
        cleanAllCookies: true,
        cookieNames: ["sid"],
      }),
      // The list's own default options for new rules. They travel with the
      // copy on purpose, so the container list behaves like its source.
      rule("_Default:WHITE", ListType.WHITE),
    ];

    const copyButton = (container: HTMLElement) =>
      container.querySelector(
        'button[title="copyDefaultRulesTooltipText"]'
      ) as HTMLElement | null;

    const added = (
      expression: string,
      extra: Record<string, unknown> = {}
    ) => ({
      payload: expect.objectContaining({
        expression,
        storeId: "firefox-container-7",
        ...extra,
      }),
      type: ReduxConstants.ADD_EXPRESSION,
    });

    beforeEach(() => {
      when(global.browser.contextualIdentities.query)
        .calledWith(expect.any(Object))
        .mockResolvedValue([workContainer] as never);
    });

    it("copies every Default rule into the selected container list", async () => {
      const { container, dispatchSpy } = renderExpressions({
        ...withContainerLists(true),
        lists: { default: defaultList },
      });
      await selectWork(container);
      fireEvent.click(copyButton(container) as HTMLElement);

      expect(dispatchSpy).toHaveBeenCalledTimes(defaultList.length);
      expect(dispatchSpy).toHaveBeenCalledWith(added("example.com"));
      expect(dispatchSpy).toHaveBeenCalledWith(added("_Default:WHITE"));
      // Each rule keeps its list type and its cleanup options, so a copy
      // cleans exactly what the original did.
      expect(dispatchSpy).toHaveBeenCalledWith(
        added("*.example.org", {
          cleanAllCookies: true,
          cookieNames: ["sid"],
          listType: ListType.GREY,
        })
      );
      expect(global.browser.i18n.getMessage).toHaveBeenCalledWith(
        "copyDefaultRulesSuccess",
        ["3"]
      );
    });

    it("copies only the rules the container list is missing", async () => {
      const { container, dispatchSpy } = renderExpressions({
        ...withContainerLists(true),
        lists: {
          default: defaultList,
          "firefox-container-7": [
            { ...defaultList[0], storeId: "firefox-container-7" },
          ],
        },
      });
      await selectWork(container);
      fireEvent.click(copyButton(container) as HTMLElement);

      expect(dispatchSpy).toHaveBeenCalledTimes(2);
      expect(dispatchSpy).not.toHaveBeenCalledWith(added("example.com"));
      expect(global.browser.i18n.getMessage).toHaveBeenCalledWith(
        "copyDefaultRulesSuccess",
        ["2"]
      );
    });

    it("dispatches nothing and says so when there is nothing to copy", async () => {
      const { container, dispatchSpy, getByText } = renderExpressions({
        ...withContainerLists(true),
        lists: {
          default: defaultList,
          "firefox-container-7": defaultList.map((exp) => ({
            ...exp,
            storeId: "firefox-container-7",
          })),
        },
      });
      await selectWork(container);
      fireEvent.click(copyButton(container) as HTMLElement);

      expect(dispatchSpy).not.toHaveBeenCalled();
      expect(getByText("copyDefaultRulesNoneFound")).not.toBeNull();
    });

    it("offers no copy while per-container lists are off", async () => {
      // The Default list already governs the container then, and the
      // notice above says so; copying would only duplicate rules.
      const { container } = renderExpressions({
        ...withContainerLists(false),
        lists: { default: defaultList },
      });
      await selectWork(container);
      expect(copyButton(container)).toBeNull();
    });

    it("offers no copy for the Default and Private lists", async () => {
      const { container } = renderExpressions({
        ...withContainerLists(true),
        lists: { default: defaultList },
      });
      await selectWork(container);
      expect(copyButton(container)).not.toBeNull();
      fireEvent.change(selector(container), { target: { value: "default" } });
      expect(copyButton(container)).toBeNull();
      fireEvent.change(selector(container), { target: { value: "private" } });
      expect(copyButton(container)).toBeNull();
    });
  });
});
