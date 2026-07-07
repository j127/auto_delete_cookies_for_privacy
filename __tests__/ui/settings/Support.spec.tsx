/**
 * @jest-environment jsdom
 */
import * as React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore } from "redux";
import { initialState } from "@/redux/state";
import Support from "@/ui/settings/components/Support";

const SETTING_COUNT = 24;

describe("Support", () => {
  let writeText: jest.Mock;

  const renderSupport = () =>
    render(
      <Provider store={createStore(() => initialState)}>
        <Support />
      </Provider>
    );

  beforeEach(() => {
    global.browser.runtime.getManifest.mockReturnValue({ version: "1.0.0" });
    global.browser.i18n.getMessage.mockImplementation((key: string) => key);
    writeText = jest.fn().mockResolvedValue(undefined);
    // jsdom has no navigator.clipboard implementation.
    Object.defineProperty(window.navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
  });

  it("renders without React warnings", () => {
    renderSupport();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("shows the version line under the full product name, not ADCP", () => {
    renderSupport();
    expect(global.browser.i18n.getMessage).toHaveBeenCalledWith(
      "versionNumberText",
      ["extensionName"]
    );
  });

  it("renders the Support heading with the bug-reports link as the only anchor", () => {
    const { container, getByText, queryByText } = renderSupport();
    expect((container.querySelector("h1") as HTMLElement).textContent).toBe(
      "supportText"
    );
    const bugLink = getByText("reportIssuesText").closest(
      "a"
    ) as HTMLAnchorElement;
    expect(bugLink.getAttribute("href")).toBe(
      "https://github.com/j127/auto_delete_cookies_for_privacy/issues"
    );
    // The external documentation link is gone — the in-app Help page owns
    // the docs now.
    expect(queryByText("documentationText")).toBeNull();
    expect(container.querySelectorAll("a")).toHaveLength(1);
  });

  it("fills the debug info textarea through the value prop", () => {
    const { container } = renderSupport();
    const info = container.querySelector("#debugInfo") as HTMLTextAreaElement;
    expect(info.value).toBe(
      "- Browser Info: (Please add version number on paste)\n- extensionName version: 1.0.0"
    );
  });

  it("fills the settings dump textarea with one line per setting", () => {
    const { container } = renderSupport();
    const dump = container.querySelector(
      "#debugSettings"
    ) as HTMLTextAreaElement;
    const lines = dump.value.split("\n");
    expect(lines).toHaveLength(SETTING_COUNT);
    expect(lines[0]).toBe("- activeMode: false");
  });

  it("copies the debug info textarea value to the clipboard", async () => {
    const { container, getAllByRole } = renderSupport();
    const info = container.querySelector("#debugInfo") as HTMLTextAreaElement;
    fireEvent.click(getAllByRole("button")[0]);
    expect(writeText).toHaveBeenCalledWith(info.value);
    const status = container.querySelector("#copy-debugInfo") as HTMLElement;
    await waitFor(() => {
      expect(status.classList.contains("text-success")).toBe(true);
      expect(status.innerText).toBe("copySuccessText");
    });
  });

  it("copies the settings dump textarea value to the clipboard", async () => {
    const { container, getAllByRole } = renderSupport();
    const dump = container.querySelector(
      "#debugSettings"
    ) as HTMLTextAreaElement;
    fireEvent.click(getAllByRole("button")[1]);
    expect(writeText).toHaveBeenCalledWith(dump.value);
    const status = container.querySelector(
      "#copy-debugSettings"
    ) as HTMLElement;
    await waitFor(() => {
      expect(status.classList.contains("text-success")).toBe(true);
      expect(status.innerText).toBe("copySuccessText");
    });
  });

  it("marks the status span as failed when the clipboard write rejects", async () => {
    writeText.mockRejectedValue(new Error("denied"));
    const { container, getAllByRole } = renderSupport();
    fireEvent.click(getAllByRole("button")[0]);
    const status = container.querySelector("#copy-debugInfo") as HTMLElement;
    await waitFor(() => {
      expect(status.classList.contains("text-error")).toBe(true);
      expect(status.innerText).toBe("copyFailedText");
    });
  });
});
