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

  it("shares the Chrome Web Store listing on the Chrome build", () => {
    // Issue #143 swapped this to the Chrome Web Store listing at publication;
    // #326 made it per-build-target. Chrome is the default test flavor
    // (vitest-setup.ts), and the Chrome artifact must keep sharing the Chrome
    // link — the Firefox side is covered by ShareMenu-firefox.spec.tsx.
    expect(EXTENSION_PAGE_URL).toBe(
      "https://chromewebstore.google.com/detail/auto-delete-cookies-for-p/ghnodpmkiilfdelcloblidoeecblgbfp"
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
