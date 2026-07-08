/**
 * @jest-environment jsdom
 */
import * as React from "react";
import { fireEvent, render } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore } from "redux";
import { initialState } from "@/redux/state";
import { SettingID } from "@/typings/enums";

// App renders SideBar, which resolves its tab labels through browser.i18n at
// module load time, so the mock implementation must be in place before the
// module graph is imported. A static import would run before any test hook.
let App: (typeof import("@/ui/settings/App"))["default"];

beforeAll(async () => {
  global.browser.i18n.getMessage.mockImplementation((key: string) => key);
  App = (await import("@/ui/settings/App")).default;
});

const withSizeSetting = (value: number): State => ({
  ...initialState,
  settings: {
    ...initialState.settings,
    [SettingID.SIZE_SETTING]: { name: SettingID.SIZE_SETTING, value },
  },
});

describe("settings App", () => {
  const renderApp = (state: State = initialState) =>
    render(
      <Provider store={createStore(() => state)}>
        <App />
      </Provider>
    );

  const contentHeading = (container: HTMLElement) =>
    (container.querySelector("main h1") as HTMLElement).textContent;

  const drawerToggle = (container: HTMLElement) =>
    container.querySelector("#settings-drawer") as HTMLInputElement;

  // The sidebar buttons deliberately carry no DOM ids (an id would be an
  // anchor target for the URL hash), so tests find them by their label.
  const sideBarButton = (
    getByRole: ReturnType<typeof renderApp>["getByRole"],
    label: string
  ) => getByRole("button", { name: label });

  beforeEach(() => {
    global.browser.i18n.getMessage.mockImplementation((key: string) => key);
    global.browser.runtime.getManifest.mockReturnValue({ version: "1.0.0" });
    // ThemeSwitcher reads the persisted theme choice on mount.
    global.browser.storage.local.get.mockResolvedValue({});
    // The active tab is read from the URL hash; start each test hash-less.
    window.history.replaceState(null, "", "/");
  });

  it("renders the drawer layout with the sidebar and the welcome tab by default", () => {
    const { container, getByRole } = renderApp();
    expect(drawerToggle(container)).not.toBeNull();
    expect(container.querySelector("aside")).not.toBeNull();
    expect(container.querySelector("#themeSwitcher")).not.toBeNull();
    expect(contentHeading(container)).toBe("overviewText");
    expect(sideBarButton(getByRole, "overviewText").className).toContain(
      "menu-active"
    );
    expect(console.error).not.toHaveBeenCalled();
  });

  it("applies the sizeSetting value as the document font size", () => {
    renderApp(withSizeSetting(20));
    expect(document.documentElement.style.fontSize).toBe("20px");
  });

  it("opens the tab named in the URL hash on mount", () => {
    window.history.replaceState(null, "", "#tabCleanupLog");
    const { container, getByRole } = renderApp();
    expect(contentHeading(container)).toBe("cleanupLogText");
    expect(sideBarButton(getByRole, "cleanupLogText").className).toContain(
      "menu-active"
    );
  });

  it("switches tabs on sidebar clicks and records the hash without navigating", () => {
    const { container, getByRole } = renderApp();

    fireEvent.click(sideBarButton(getByRole, "protectionText"));

    expect(contentHeading(container)).toBe("protectionText");
    expect(sideBarButton(getByRole, "protectionText").className).toContain(
      "menu-active"
    );
    expect(window.location.hash).toBe("#tabSettings");
    // A tabs.update() call here would be a hash navigation, and its native
    // anchor scroll left the page scrolled down past the navbar.
    expect(global.browser.tabs.update).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("keeps the page scrolled to the top on load and on every tab switch", () => {
    const scrollSpy = jest
      .spyOn(window, "scrollTo")
      .mockImplementation(() => undefined);
    window.history.replaceState(null, "", "#tabCleanupLog");
    const { container, getByRole } = renderApp();
    expect(contentHeading(container)).toBe("cleanupLogText");
    expect(scrollSpy).toHaveBeenCalledWith(0, 0);

    scrollSpy.mockClear();
    fireEvent.click(sideBarButton(getByRole, "protectionText"));
    expect(scrollSpy).toHaveBeenCalledWith(0, 0);
    scrollSpy.mockRestore();
  });

  it("closes the mobile drawer when a sidebar tab is clicked", () => {
    const { container, getByRole } = renderApp();

    // Open the drawer (checkbox drives DaisyUI's drawer state).
    fireEvent.click(drawerToggle(container));
    expect(drawerToggle(container).checked).toBe(true);

    fireEvent.click(sideBarButton(getByRole, "supportText"));
    expect(drawerToggle(container).checked).toBe(false);
  });
});
