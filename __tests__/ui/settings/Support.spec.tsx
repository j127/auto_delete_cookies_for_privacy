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
    // clearMocks keeps implementations, so reset the platform lookup that
    // one test fills in.
    global.browser.runtime.getPlatformInfo.mockReset();
    writeText = jest.fn().mockResolvedValue(undefined);
    // jsdom has no navigator.clipboard implementation.
    Object.defineProperty(window.navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
  });

  it("renders without React warnings", async () => {
    renderSupport();
    // The browser/OS lookup updates state after the first render; wait for
    // it so a late act() warning would land inside this test.
    await waitFor(() =>
      expect(global.browser.runtime.getPlatformInfo).toHaveBeenCalled()
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(console.error).not.toHaveBeenCalled();
  });

  it("shows the version line under the full product name, not ADCP", () => {
    renderSupport();
    expect(global.browser.i18n.getMessage).toHaveBeenCalledWith(
      "versionNumberText",
      ["extensionName"]
    );
  });

  it("renders the Support heading with the bug-report, discussions and email links as the only anchors", () => {
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
    const discussionsLink = getByText("discussionsText").closest(
      "a"
    ) as HTMLAnchorElement;
    expect(discussionsLink.getAttribute("href")).toBe(
      "https://github.com/j127/auto_delete_cookies_for_privacy/discussions"
    );
    // The external documentation link is gone — the in-app Help page owns
    // the docs now.
    expect(queryByText("documentationText")).toBeNull();
    // The third anchor is the mailto: link; nothing links to a page that
    // needs a sign-in beyond the two GitHub links people already had.
    const anchors = Array.from(container.querySelectorAll("a"));
    expect(anchors).toHaveLength(3);
    expect(anchors[2].getAttribute("href")).toMatch(
      /^mailto:support@moakh\.dev\?/
    );
  });

  it("links the Email a bug report button to a prefilled mailto: with both blocks", async () => {
    global.browser.runtime.getPlatformInfo.mockResolvedValue({
      os: "mac",
      arch: "arm64",
    });
    const { container, getByText } = renderSupport();
    const info = container.querySelector("#debugInfo") as HTMLTextAreaElement;
    await waitFor(() => expect(info.value).toContain("macOS (arm64)"));
    const dump = container.querySelector(
      "#debugSettings"
    ) as HTMLTextAreaElement;
    const link = getByText("emailBugReportText").closest(
      "a"
    ) as HTMLAnchorElement;
    expect(link.classList.contains("btn")).toBe(true);
    const href = link.getAttribute("href") as string;
    const url = new URL(href);
    expect(url.protocol).toBe("mailto:");
    expect(url.pathname).toBe("support@moakh.dev");
    expect(url.searchParams.get("subject")).toBe(
      "emailSubjectText: extensionName 1.0.0"
    );
    const body = url.searchParams.get("body") as string;
    const crlf = (text: string) => text.split("\n").join("\r\n");
    expect(body.startsWith("emailBodyPromptText")).toBe(true);
    expect(body).toContain(`System details:\r\n${crlf(info.value)}`);
    expect(body).toContain(`Settings:\r\n${crlf(dump.value)}`);
    expect(body).not.toContain("emailSettingsLeftOutText");
  });

  it("shows the support address as plain text for people with no mail app", () => {
    const { container, getByText } = renderSupport();
    expect(getByText("emailBugReportHelpText")).toBeTruthy();
    const address = container.querySelector("#supportEmail") as HTMLElement;
    expect(address.textContent).toBe("support@moakh.dev");
    expect(address.closest("a")).toBeNull();
    expect(address.getAttribute("dir")).toBe("ltr");
    expect(
      (address.parentElement as HTMLElement).textContent?.startsWith(
        "emailAddressText"
      )
    ).toBe(true);
  });

  it("fills the debug info textarea with the browser and OS it can read", async () => {
    global.browser.runtime.getPlatformInfo.mockResolvedValue({
      os: "linux",
      arch: "x86-64",
    });
    const nav = window.navigator as Navigator & { userAgentData?: unknown };
    Object.defineProperty(nav, "userAgentData", {
      value: {
        brands: [
          { brand: "Not)A;Brand", version: "99" },
          { brand: "Chromium", version: "130" },
          { brand: "Google Chrome", version: "130" },
        ],
        getHighEntropyValues: () =>
          Promise.resolve({
            fullVersionList: [
              { brand: "Google Chrome", version: "130.0.6723.92" },
            ],
            platformVersion: "6.5.0",
          }),
      },
      configurable: true,
    });
    try {
      const { container } = renderSupport();
      const info = container.querySelector("#debugInfo") as HTMLTextAreaElement;
      await waitFor(() => {
        expect(info.value).toBe(
          "- Browser: Google Chrome 130.0.6723.92\n- Operating system: Linux (x86-64)\n- extensionName version: 1.0.0"
        );
      });
    } finally {
      delete nav.userAgentData;
    }
  });

  it("asks for the browser and OS when it can't read them", async () => {
    const { container } = renderSupport();
    const info = container.querySelector("#debugInfo") as HTMLTextAreaElement;
    // Let the lookup settle: jsdom has no userAgentData and its user-agent
    // string names no browser, and the runtime mocks resolve to nothing.
    await waitFor(() =>
      expect(global.browser.runtime.getPlatformInfo).toHaveBeenCalled()
    );
    await waitFor(() => {
      expect(info.value).toBe(
        "- Browser: (please add your browser and its version)\n- Operating system: (please add your operating system)\n- extensionName version: 1.0.0"
      );
    });
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
