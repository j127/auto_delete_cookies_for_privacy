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
    const { container } = renderSideBar();
    TABS.forEach(([tabId, tabText]) => {
      const item = container.querySelector(`#${tabId}`) as HTMLElement;
      expect(item).not.toBeNull();
      expect(item.textContent).toBe(tabText);
      expect(item.tagName).toBe("BUTTON");
    });
  });

  it("is pure navigation — no brand block or version (they live in the top bar / About)", () => {
    const { queryByText } = renderSideBar();
    expect(queryByText("extensionName")).toBeNull();
    expect(queryByText("v1.0.0")).toBeNull();
  });

  it("marks only the active tab as selected", () => {
    const { container } = renderSideBar("tabSettings");
    TABS.forEach(([tabId]) => {
      const item = container.querySelector(`#${tabId}`) as HTMLElement;
      expect(item.classList.contains("menu-active")).toBe(
        tabId === "tabSettings"
      );
    });
  });

  it("calls switchTabs with the tab id when a tab is clicked", () => {
    const { container } = renderSideBar();
    fireEvent.click(container.querySelector("#tabCleanupLog") as HTMLElement);
    expect(switchTabs).toHaveBeenCalledTimes(1);
    expect(switchTabs).toHaveBeenCalledWith("tabCleanupLog");
  });

  it("renders without console errors", () => {
    renderSideBar();
    expect(console.error).not.toHaveBeenCalled();
  });
});
