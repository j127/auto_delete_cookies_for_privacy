/**
 * @jest-environment jsdom
 */
import * as React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore } from "redux";
import { initialState } from "@/redux/state";
import About from "@/ui/settings/components/About";

const SETTING_COUNT = 24;

describe("About", () => {
  let writeText: jest.Mock;

  const renderAbout = () =>
    render(
      <Provider store={createStore(() => initialState)}>
        <About />
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
    renderAbout();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("shows the version line under the full product name, not ADCP", () => {
    renderAbout();
    expect(global.browser.i18n.getMessage).toHaveBeenCalledWith(
      "versionNumberText",
      ["extensionName"]
    );
  });

  it("links to exactly two places: bug reports and the documentation", () => {
    const { container, getByText, queryByText } = renderAbout();
    const bugLink = getByText("reportIssuesText").closest(
      "a"
    ) as HTMLAnchorElement;
    expect(bugLink.getAttribute("href")).toBe(
      "https://github.com/j127/auto_delete_cookies_for_privacy/issues"
    );
    const docLink = getByText("documentationText").closest(
      "a"
    ) as HTMLAnchorElement;
    expect(docLink.getAttribute("href")).toBe(
      "https://github.com/j127/auto_delete_cookies_for_privacy/blob/main/documentation/src/introduction.md"
    );
    expect(container.querySelectorAll("a")).toHaveLength(2);
    expect(queryByText("faqText")).toBeNull();
  });

  it("has no contributors section", () => {
    const { queryByText } = renderAbout();
    expect(queryByText(/contributorsText/)).toBeNull();
    expect(queryByText(/Kenny Do/)).toBeNull();
  });

  it("fills the debug info textarea through the value prop", () => {
    const { container } = renderAbout();
    const info = container.querySelector("#debugInfo") as HTMLTextAreaElement;
    expect(info.value).toBe(
      "- Browser Info: (Please add version number on paste)\n- extensionName version: 1.0.0"
    );
  });

  it("fills the settings dump textarea with one line per setting", () => {
    const { container } = renderAbout();
    const dump = container.querySelector(
      "#debugSettings"
    ) as HTMLTextAreaElement;
    const lines = dump.value.split("\n");
    expect(lines).toHaveLength(SETTING_COUNT);
    expect(lines[0]).toBe("- activeMode: false");
  });

  it("copies the debug info textarea value to the clipboard", async () => {
    const { container, getAllByRole } = renderAbout();
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
    const { container, getAllByRole } = renderAbout();
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
    const { container, getAllByRole } = renderAbout();
    fireEvent.click(getAllByRole("button")[0]);
    const status = container.querySelector("#copy-debugInfo") as HTMLElement;
    await waitFor(() => {
      expect(status.classList.contains("text-error")).toBe(true);
      expect(status.innerText).toBe("copyFailedText");
    });
  });
});
