/**
 * @jest-environment jsdom
 */
/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */
import * as React from "react";
import { render } from "@testing-library/react";
import MessageWithLink, {
  BRAVE_LINK,
} from "@/ui/common-components/MessageWithLink";

// Stands in for browser.i18n: puts the substitution where the $1
// placeholder sits, as a translation would.
const withPlaceholder =
  (template: string) =>
  (_key: string, substitutions?: string[]): string =>
    template.replace("$1", substitutions?.[0] ?? "");

describe("MessageWithLink", () => {
  it("puts the link where the message's placeholder is", () => {
    global.browser.i18n.getMessage.mockImplementation(
      withPlaceholder("Try $1, where it works.")
    );
    const { container } = render(
      <MessageWithLink link={BRAVE_LINK} messageKey="note" />
    );
    expect(container.textContent).toBe("Try Brave, where it works.");
    const links = container.querySelectorAll("a");
    expect(links).toHaveLength(1);
    expect(links[0].textContent).toBe("Brave");
    expect(global.browser.i18n.getMessage).toHaveBeenCalledWith(
      "note",
      expect.any(Array)
    );
  });

  it("opens the link in a new tab without handing over the opener", () => {
    global.browser.i18n.getMessage.mockImplementation(withPlaceholder("$1"));
    const { container } = render(
      <MessageWithLink link={BRAVE_LINK} messageKey="note" />
    );
    const link = container.querySelector("a") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("https://brave.com/");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("keeps the link wherever a translation moves the placeholder", () => {
    global.browser.i18n.getMessage.mockImplementation(
      withPlaceholder("$1 を試す")
    );
    const { container } = render(
      <MessageWithLink link={BRAVE_LINK} messageKey="note" />
    );
    expect(container.textContent).toBe("Brave を試す");
    expect(container.firstChild?.nodeName).toBe("A");
  });

  it("renders plain text when the message has no placeholder", () => {
    global.browser.i18n.getMessage.mockImplementation(
      withPlaceholder("No link here.")
    );
    const { container } = render(
      <MessageWithLink link={BRAVE_LINK} messageKey="note" />
    );
    expect(container.textContent).toBe("No link here.");
    expect(container.querySelectorAll("a")).toHaveLength(0);
  });

  it("links to Brave's own site over https", () => {
    expect(BRAVE_LINK).toEqual({ href: "https://brave.com/", text: "Brave" });
  });
});
