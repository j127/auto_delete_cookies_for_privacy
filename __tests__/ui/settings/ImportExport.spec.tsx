/**
 * @jest-environment jsdom
 */
import * as React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore } from "redux";
import { initialState } from "@/redux/state";
import { ListType, SettingID } from "@/typings/enums";
import { ReduxConstants } from "@/typings/redux-constants";
import ImportExport from "@/ui/settings/components/ImportExport";

const jsonFile = (payload: unknown, name = "backup.json") =>
  new File([JSON.stringify(payload)], name, { type: "application/json" });

describe("ImportExport", () => {
  const renderPage = (state: State = initialState) => {
    const store = createStore(() => state);
    const dispatchSpy = jest.spyOn(store, "dispatch");
    const rendered = render(
      <Provider store={store}>
        <ImportExport />
      </Provider>
    );
    const fileInputs = () =>
      Array.from(
        rendered.container.querySelectorAll('input[type="file"]')
      ) as HTMLInputElement[];
    return { dispatchSpy, fileInputs, ...rendered };
  };

  beforeEach(() => {
    global.browser.i18n.getMessage.mockImplementation((key: string) => key);
  });

  it("renders the heading and the two backup cards", () => {
    const { container, getByText } = renderPage();
    expect((container.querySelector("h1") as HTMLElement).textContent).toBe(
      "importExportText"
    );
    expect(getByText("importExportSubText")).not.toBeNull();
    const cardTitles = Array.from(container.querySelectorAll("h2")).map(
      (h) => h.textContent
    );
    expect(cardTitles).toEqual(["preferencesText", "savedSitesText"]);
    // Settings card: export, import, reset. Saved sites card: export, import.
    getByText("exportSettingsText");
    getByText("importCoreSettingsText");
    getByText("defaultSettingsText");
    getByText("exportURLSText");
    getByText("importURLSText");
  });

  it("dispatches RESET_SETTINGS and shows a success alert on reset to defaults", () => {
    const { container, dispatchSpy, getByText } = renderPage();
    fireEvent.click(getByText("defaultSettingsText"));
    expect(dispatchSpy).toHaveBeenCalledWith({
      type: ReduxConstants.RESET_SETTINGS,
    });
    const success = container.querySelector(".alert-success") as HTMLElement;
    expect(success.textContent).toBe("defaultSettingsText");
  });

  it("exports the settings and reports the download name", () => {
    const { container, getByText } = renderPage();
    fireEvent.click(getByText("exportSettingsText"));
    const success = container.querySelector(".alert-success") as HTMLElement;
    expect(success.textContent).toContain("exportSettingsText");
    expect(success.textContent).toContain("CAD_CoreSettings_");
  });

  it("imports known settings and dispatches only the changed values", async () => {
    const { dispatchSpy, fileInputs, container } = renderPage();
    const file = jsonFile({
      settings: [
        { name: SettingID.ACTIVE_MODE, value: true },
        // Unchanged from the defaults: must not dispatch.
        { name: SettingID.CLEAN_DELAY, value: 15 },
      ],
    });
    fireEvent.change(fileInputs()[0], { target: { files: [file] } });

    await waitFor(() => {
      expect(dispatchSpy).toHaveBeenCalledWith({
        payload: { name: SettingID.ACTIVE_MODE, value: true },
        type: ReduxConstants.UPDATE_SETTING,
      });
    });
    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    const success = container.querySelector(".alert-success") as HTMLElement;
    expect(success.textContent).toBe("importCoreSettingsText");
  });

  it("rejects a settings file containing unknown settings", async () => {
    const { dispatchSpy, fileInputs, container } = renderPage();
    const file = jsonFile({
      settings: [{ name: "someFutureSetting", value: true }],
    });
    fireEvent.change(fileInputs()[0], { target: { files: [file] } });

    await waitFor(() => {
      expect(
        container.querySelector(".alert-error") as HTMLElement
      ).not.toBeNull();
    });
    const error = container.querySelector(".alert-error") as HTMLElement;
    expect(error.textContent).toContain("importCoreSettingsFailed");
    expect(error.textContent).toContain("someFutureSetting");
    expect(dispatchSpy).not.toHaveBeenCalled();
  });

  it("rejects a non-JSON file for either card without reading it", () => {
    const { dispatchSpy, fileInputs, container } = renderPage();
    const bad = new File(["nope"], "backup.txt", { type: "text/plain" });
    fireEvent.change(fileInputs()[1], { target: { files: [bad] } });
    const error = container.querySelector(".alert-error") as HTMLElement;
    expect(error.textContent).toContain("importFileTypeInvalid");
    expect(dispatchSpy).not.toHaveBeenCalled();
  });

  it("imports container lists into default and reports the folded count", async () => {
    const { container, dispatchSpy, fileInputs } = renderPage();
    const file = jsonFile(
      {
        "firefox-container-1": [
          {
            expression: "work.example.com",
            listType: "WHITE",
            storeId: "firefox-container-1",
          },
        ],
      },
      "cad-backup.json"
    );
    fireEvent.change(fileInputs()[1], { target: { files: [file] } });

    await waitFor(() => {
      expect(dispatchSpy).toHaveBeenCalledWith({
        payload: {
          expression: "work.example.com",
          listType: ListType.WHITE,
          storeId: "default",
        },
        type: ReduxConstants.ADD_EXPRESSION,
      });
    });
    const success = container.querySelector(".alert-success") as HTMLElement;
    expect(success.textContent).toContain("importValidExpressions");
    expect(success.textContent).toContain("importFoldedContainersText");
  });

  it("renders without console errors", () => {
    renderPage();
    expect(console.error).not.toHaveBeenCalled();
  });
});
