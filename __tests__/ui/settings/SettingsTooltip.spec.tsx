/**
 * @jest-environment jsdom
 */
import * as React from "react";
import { render } from "@testing-library/react";
import fontAwesomeImports from "../../../src/ui/font-awesome-imports";
import SettingsTooltip from "../../../src/ui/settings/components/SettingsTooltip";

// Register the FontAwesome icons the settings entrypoint normally provides.
fontAwesomeImports();

const DOC_BASE =
  "https://github.com/j127/autodelete_cookies_for_privacy/blob/main/documentation/src/";

describe("SettingsTooltip", () => {
  const renderTooltip = (hrefURL: string) => {
    const { container } = render(<SettingsTooltip hrefURL={hrefURL} />);
    return container.querySelector("a") as HTMLAnchorElement;
  };

  it("builds the href from the documentation base URL for relative values", () => {
    const anchor = renderTooltip("settings.md#extension-options");
    expect(anchor.getAttribute("href")).toBe(
      `${DOC_BASE}settings.md#extension-options`
    );
  });

  it("passes full URLs through unchanged", () => {
    const anchor = renderTooltip("https://example.com/help");
    expect(anchor.getAttribute("href")).toBe("https://example.com/help");
  });

  it("opens in a new tab as a help link without an opener", () => {
    const anchor = renderTooltip("faq.md");
    expect(anchor.getAttribute("target")).toBe("_blank");
    expect(anchor.getAttribute("rel")).toBe("help noreferrer noopener");
    expect(anchor.classList.contains("tooltipCustom")).toBe(true);
  });

  it("renders a regular-style FontAwesome icon inside the link", () => {
    const anchor = renderTooltip("faq.md");
    const icon = anchor.querySelector("svg") as SVGElement;
    expect(icon).not.toBeNull();
    expect(icon.classList.contains("svg-inline--fa")).toBe(true);
    expect(icon.getAttribute("data-prefix")).toBe("far");
  });

  it("renders without console errors", () => {
    renderTooltip("settings.md");
    expect(console.error).not.toHaveBeenCalled();
  });
});
