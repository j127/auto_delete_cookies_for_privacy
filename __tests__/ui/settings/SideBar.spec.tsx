/**
 * @jest-environment jsdom
 */
import * as React from "react";
import { fireEvent, render } from "@testing-library/react";
import fontAwesomeImports from "@/ui/font-awesome-imports";

// Register the FontAwesome icons the settings entrypoint normally provides.
fontAwesomeImports();

// SideBar resolves its tab labels through browser.i18n at module load time,
// so the i18n mock implementation must be in place before the module is
// imported. A static import would run before any beforeEach/beforeAll hook.
let SideBar: (typeof import("@/ui/settings/components/SideBar"))["default"];

beforeAll(async () => {
  global.browser.i18n.getMessage.mockImplementation((key: string) => key);
  SideBar = (await import("@/ui/settings/components/SideBar")).default;
});

const TABS: Array<[string, string]> = [
  ["tabWelcome", "welcomeText"],
  ["tabSettings", "settingsText"],
  ["tabExpressionList", "expressionListText"],
  ["tabCleanupLog", "cleanupLogText"],
  ["tabAbout", "aboutText"],
];

describe("SideBar", () => {
  let switchTabs: jest.Mock;

  const renderSideBar = (activeTab = "tabWelcome") =>
    render(<SideBar activeTab={activeTab} switchTabs={switchTabs} />);

  beforeEach(() => {
    switchTabs = jest.fn();
    global.browser.i18n.getMessage.mockImplementation((key: string) => key);
    global.browser.runtime.getManifest.mockReturnValue({ version: "4.0.0" });
  });

  it("renders a menu item for every settings tab", () => {
    const { container } = renderSideBar();
    TABS.forEach(([tabId, tabText]) => {
      const item = container.querySelector(`#${tabId}`) as HTMLElement;
      expect(item).not.toBeNull();
      expect(item.textContent).toBe(tabText);
      expect(item.classList.contains("pure-menu-item")).toBe(true);
    });
  });

  it("shows the ADCP version number from the manifest", () => {
    const { container } = renderSideBar();
    const version = container.querySelector(".sidebar-version") as HTMLElement;
    expect(version.textContent).toContain("versionNumberText");
    expect((version.querySelector("b") as HTMLElement).textContent).toBe(
      "4.0.0"
    );
    expect(global.browser.i18n.getMessage).toHaveBeenCalledWith(
      "versionNumberText",
      ["ADCP"]
    );
  });

  it("marks only the active tab as selected", () => {
    const { container } = renderSideBar("tabSettings");
    TABS.forEach(([tabId]) => {
      const item = container.querySelector(`#${tabId}`) as HTMLElement;
      expect(item.classList.contains("pure-menu-selected")).toBe(
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

  it("renders the hamburger menu link with its i18n label", () => {
    const { container } = renderSideBar();
    const menuLink = container.querySelector("#menuLink") as HTMLElement;
    expect(menuLink.querySelector("svg")).not.toBeNull();
    expect(
      (container.querySelector("#menuLinkText") as HTMLElement).textContent
    ).toBe("menuText");
  });

  it("toggles the active class on the menu elements via the hamburger link", () => {
    const { container } = renderSideBar();
    const menuLink = container.querySelector("#menuLink") as HTMLElement;
    const menu = container.querySelector("#menu") as HTMLElement;

    fireEvent.click(menuLink);
    expect(menuLink.classList.contains("active")).toBe(true);
    expect(menu.classList.contains("active")).toBe(true);

    fireEvent.click(menuLink);
    expect(menuLink.classList.contains("active")).toBe(false);
    expect(menu.classList.contains("active")).toBe(false);
  });

  it("renders without console errors", () => {
    renderSideBar();
    expect(console.error).not.toHaveBeenCalled();
  });
});
