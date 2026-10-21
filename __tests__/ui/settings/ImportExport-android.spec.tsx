/**
 * @jest-environment jsdom
 */

/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * The Import saved sites card on Firefox for Android (#538): container
 * lists from a desktop export fold into Default, the whole file lands as
 * one action, and the success alert reports the folded count with the
 * message that says the folded rules now apply to all tabs.
 */
import * as React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore } from "redux";
import { ListType } from "@/typings/enums";
import { ReduxConstants } from "@/typings/redux-constants";
import { installAndroidFlavor } from "../../android-flavor";

vi.stubGlobal("__BROWSER__", "firefox");
vi.resetModules();
installAndroidFlavor();
const { initialState } = await import("@/redux/state");
const { default: ImportExport } =
  await import("@/ui/settings/components/ImportExport");

const exp = (
  expression: string,
  storeId: string,
  listType: ListType = ListType.WHITE
): Expression => ({ expression, listType, storeId });

const jsonFile = (payload: unknown, name = "backup.json") =>
  new File([JSON.stringify(payload)], name, { type: "application/json" });

describe("ImportExport on Firefox for Android (#538)", () => {
  beforeEach(() => {
    global.browser.i18n.getMessage.mockImplementation(
      (key: string, subs: string[] = []) =>
        [key, ...(Array.isArray(subs) ? subs : [subs])].join(" ")
    );
  });

  it("folds container lists into Default and reports the folded count", async () => {
    const existing: State = {
      ...initialState,
      lists: { default: [exp("kept.example.com", "default")] },
    };
    const store = createStore(() => existing);
    const dispatchSpy = jest.spyOn(store, "dispatch");
    const { container } = render(
      <Provider store={store}>
        <ImportExport />
      </Provider>
    );
    const fileInput = container.querySelectorAll(
      'input[type="file"]'
    )[1] as HTMLInputElement;
    const file = jsonFile(
      {
        "firefox-container-1": [
          exp("work.example.com", "firefox-container-1"),
          exp("kept.example.com", "firefox-container-1", ListType.GREY),
        ],
        "firefox-container-3": [
          exp("bank.example.com", "firefox-container-3", ListType.GREY),
        ],
      },
      "desktop-backup.json"
    );
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(dispatchSpy).toHaveBeenCalledWith({
        payload: [
          exp("work.example.com", "default"),
          exp("bank.example.com", "default", ListType.GREY),
        ],
        type: ReduxConstants.ADD_EXPRESSIONS,
      });
    });
    // The whole file lands as one action (#437).
    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    const success = container.querySelector(".alert-success") as HTMLElement;
    expect(success.textContent).toContain(
      "importValidExpressions 2 desktop-backup.json"
    );
    // kept.example.com is already in Default, so two rules fold, not three.
    expect(success.textContent).toContain("importFoldedContainersText 2");
    expect(container.querySelector(".alert-error")).toBeNull();
  });
});
