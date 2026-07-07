/**
 * @jest-environment jsdom
 */
import * as React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react";
import ShareMenu, { EXTENSION_PAGE_URL } from "@/ui/popup/components/ShareMenu";

describe("ShareMenu", () => {
  beforeEach(() => {
    global.browser.i18n.getMessage.mockImplementation((key: string) => key);
  });

  it("points at the extension page through a single constant", () => {
    // Issue #143: swap this to the Chrome Web Store listing after release.
    expect(EXTENSION_PAGE_URL).toBe(
      "https://github.com/j127/auto_delete_cookies_for_privacy"
    );
  });

  it("renders the share button with its tooltip", () => {
    const { getByText } = render(<ShareMenu />);
    const summary = getByText("shareText");
    expect(summary.getAttribute("title")).toBe("shareTooltipText");
  });

  it("copies the extension page link and confirms briefly", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const { getByText } = render(<ShareMenu />);
    fireEvent.click(getByText("shareCopyLinkText"));
    expect(writeText).toHaveBeenCalledWith(EXTENSION_PAGE_URL);
    await waitFor(() => expect(getByText("shareCopiedText")).toBeTruthy());
  });

  it("prefills a mail draft with the extension page link", () => {
    const { getByText } = render(<ShareMenu />);
    const mail = getByText("shareEmailText").closest("a") as HTMLAnchorElement;
    expect(mail.getAttribute("href")).toContain("mailto:?subject=");
    expect(mail.getAttribute("href")).toContain(
      encodeURIComponent(EXTENSION_PAGE_URL)
    );
  });
});
