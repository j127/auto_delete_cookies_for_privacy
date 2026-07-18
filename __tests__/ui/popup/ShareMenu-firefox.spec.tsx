/**
 * @jest-environment jsdom
 */

/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2017-2022 Kenny Do and CAD Team; fork changes (c) 2026 j127.
 * Licensed under MIT (see LICENSE).
 */
import * as React from "react";
import { fireEvent, render } from "@testing-library/react";
import chromeManifest from "../../../extension/manifest.json";
import {
  buildFirefoxManifest,
  ChromeManifest,
} from "../../../scripts/firefox_manifest";

vi.stubGlobal("__BROWSER__", "firefox");
vi.resetModules();
const { default: ShareMenu, EXTENSION_PAGE_URL } =
  await import("@/ui/popup/components/ShareMenu");

const AMO_LISTING =
  "https://addons.mozilla.org/firefox/addon/autodelete-cookies-for-privacy/";

describe("ShareMenu on the Firefox build", () => {
  beforeEach(() => {
    global.browser.i18n.getMessage.mockImplementation((key: string) => key);
  });

  it("shares the AMO listing, not the Chrome Web Store one", () => {
    expect(EXTENSION_PAGE_URL).toBe(AMO_LISTING);
    // The bug #326 exists to prevent: a Firefox user handing a friend a link
    // they cannot install from.
    expect(EXTENSION_PAGE_URL).not.toContain("chromewebstore");
  });

  it("copies the AMO link to the clipboard", () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const { getByText } = render(<ShareMenu />);
    fireEvent.click(getByText("shareCopyLinkText"));
    // The literal, not EXTENSION_PAGE_URL: asserting the constant against
    // itself would pass even if the component ignored it.
    expect(writeText).toHaveBeenCalledWith(AMO_LISTING);
  });

  it("prefills a mail draft with the AMO link", () => {
    const { getByText } = render(<ShareMenu />);
    const mail = getByText("shareEmailText").closest("a") as HTMLAnchorElement;
    expect(mail.getAttribute("href")).toContain(
      encodeURIComponent(AMO_LISTING)
    );
  });

  it("links the locale-less AMO listing", () => {
    // AMO redirects each visitor to their own locale and the extension ships
    // in 32 languages, so an /en-US/ prefix would pin everyone to English.
    // Mirrors the GUID-shape guard on FIREFOX_ADDON_ID: this catches someone
    // pasting the URL straight out of the browser bar.
    expect(EXTENSION_PAGE_URL).toMatch(
      /^https:\/\/addons\.mozilla\.org\/firefox\/addon\/[a-z0-9-]+\/$/
    );
  });

  it("is the only Firefox-facing AMO link: the manifest homepage is not one", () => {
    // These two deliberately differ. Sharing an AMO link is what a user wants
    // when handing the extension to someone; homepage_url cannot be an AMO
    // link at all, because AMO's validator rejects it (RESTRICTED_HOMEPAGE_URL
    // — see the firefox_manifest spec). This pins that split so a future
    // "unify the URLs" cleanup fails loudly instead of breaking submission.
    // The static imports above are safe despite hoisting over the __BROWSER__
    // stub, because firefox_manifest.ts never reads __BROWSER__.
    const generated = buildFirefoxManifest(chromeManifest as ChromeManifest);
    expect(EXTENSION_PAGE_URL).toContain("addons.mozilla.org");
    expect(generated.homepage_url).not.toContain("addons.mozilla.org");
    expect(generated.homepage_url).not.toBe(EXTENSION_PAGE_URL);
  });
});
