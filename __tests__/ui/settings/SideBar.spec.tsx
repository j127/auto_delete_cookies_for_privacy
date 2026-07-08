/**
 * @jest-environment jsdom
 */
import * as React from "react";
import { fireEvent, render } from "@testing-library/react";

// SideBar resolves its tab labels through browser.i18n at module load time,
// so the i18n mock implementation must be in place before the module is
// imported. A static import would run before any beforeEach/beforeAll hook.
let SideBar: (typeof import("@/ui/settings/components/SideBar"))["default"];

beforeAll(async () => {
  global.browser.i18n.getMessage.mockImplementation((key: string) => key);
  SideBar = (await import("@/ui/settings/components/SideBar")).default;
});

const TABS: Array<[string, string]> = [
  ["tabWelcome", "overviewText"],
  ["tabSettings", "protectionText"],
  ["tabExpressionList", "savedSitesText"],
  ["tabCleanupLog", "cleanupLogText"],
  ["tabImportExport", "importExportText"],
  ["tabHelp", "helpText"],
  ["tabSupport", "supportText"],
];

describe("SideBar", () => {
  let switchTabs: jest.Mock;

  const renderSideBar = (activeTab = "tabWelcome") =>
    render(<SideBar activeTab={activeTab} switchTabs={switchTabs} />);

  beforeEach(() => {
    switchTabs = jest.fn();
    global.browser.i18n.getMessage.mockImplementation((key: string) => key);
    global.browser.runtime.getManifest.mockReturnValue({ version: "1.0.0" });
  });

  it("renders a menu item for every settings tab", () => {
    const { getByText } = renderSideBar();
    TABS.forEach(([, tabText]) => {
      const item = getByText(tabText);
      expect(item.tagName).toBe("BUTTON");
      // The tab id must never be a DOM id: the URL hash carries the same
      // string, and an anchor target would make the browser scroll the
      // button into view, hiding the navbar.
      expect(item.id).toBe("");
    });
  });

  it("is pure navigation — no brand block or version (they live in the top bar / About)", () => {
    const { queryByText } = renderSideBar();
    expect(queryByText("extensionName")).toBeNull();
    expect(queryByText("v1.0.0")).toBeNull();
  });

  it("marks only the active tab as selected", () => {
    const { getByText } = renderSideBar("tabSettings");
    TABS.forEach(([tabId, tabText]) => {
      const item = getByText(tabText);
      expect(item.classList.contains("menu-active")).toBe(
        tabId === "tabSettings"
      );
    });
  });

  it("calls switchTabs with the tab id when a tab is clicked", () => {
    const { getByText } = renderSideBar();
    fireEvent.click(getByText("cleanupLogText"));
    expect(switchTabs).toHaveBeenCalledTimes(1);
    expect(switchTabs).toHaveBeenCalledWith("tabCleanupLog");
  });

  it("renders without console errors", () => {
    renderSideBar();
    expect(console.error).not.toHaveBeenCalled();
  });
});
