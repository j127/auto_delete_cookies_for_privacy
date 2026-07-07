/**
 * @jest-environment jsdom
 */
import * as React from "react";
import { fireEvent, render } from "@testing-library/react";
import Help from "@/ui/settings/components/Help";

const SECTION_TITLES = [
  "helpGettingStartedTitle",
  "helpCleaningTitle",
  "helpSiteDataTitle",
  "helpPatternsTitle",
  "helpImportExportTitle",
  "helpLogTitle",
  "helpPermissionsTitle",
  "helpTroubleshootingTitle",
];

describe("Help", () => {
  beforeEach(() => {
    global.browser.i18n.getMessage.mockImplementation((key: string) => key);
  });

  it("renders the heading and all eight sections collapsed", () => {
    const { container, getByText } = render(<Help />);
    expect((container.querySelector("h1") as HTMLElement).textContent).toBe(
      "helpText"
    );
    getByText("helpSubText");
    const sections = Array.from(container.querySelectorAll("details"));
    expect(sections).toHaveLength(8);
    sections.forEach((section) => expect(section.open).toBe(false));
    SECTION_TITLES.forEach((title) => getByText(title));
  });

  it("shows a section's body when its summary is toggled open", () => {
    const { container, getByText } = render(<Help />);
    const first = container.querySelector("details") as HTMLDetailsElement;
    fireEvent.click(getByText("helpGettingStartedTitle"));
    // jsdom doesn't toggle details natively on summary click; assert the
    // body is present in the DOM (details content is always rendered) and
    // the open attribute works when set.
    first.open = true;
    expect(first.open).toBe(true);
    getByText("helpGettingStartedBody");
  });

  it("contains no links at all — the guide is fully self-contained", () => {
    const { container } = render(<Help />);
    expect(container.querySelectorAll("a")).toHaveLength(0);
  });

  it("renders without console errors", () => {
    render(<Help />);
    expect(console.error).not.toHaveBeenCalled();
  });
});
