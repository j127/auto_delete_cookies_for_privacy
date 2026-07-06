/**
 * @jest-environment jsdom
 */
import * as React from "react";
import { render } from "@testing-library/react";
import SettingsTooltip from "@/ui/settings/components/SettingsTooltip";

const DOC_BASE =
  "https://github.com/j127/auto_delete_cookies_for_privacy/blob/main/documentation/src/";

describe("SettingsTooltip", () => {
  beforeEach(() => {
    // The tooltip text (data-tip) comes from i18n since #40.
    global.browser.i18n.getMessage.mockImplementation((key: string) => key);
  });

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
    // A CSS-only DaisyUI tooltip wraps the link since #40.
    const wrapper = anchor.parentElement as HTMLElement;
    expect(wrapper.classList.contains("tooltip")).toBe(true);
    expect(wrapper.hasAttribute("data-tip")).toBe(true);
  });

  it("renders the question-circle icon inside the link", () => {
    const anchor = renderTooltip("faq.md");
    const icon = anchor.querySelector("svg") as SVGElement;
    expect(icon).not.toBeNull();
    // Inline SVG icon since #43 (the FontAwesome runtime is gone).
    expect(icon.getAttribute("data-icon")).toBe("question-circle");
  });

  it("renders without console errors", () => {
    renderTooltip("settings.md");
    expect(console.error).not.toHaveBeenCalled();
  });
});
