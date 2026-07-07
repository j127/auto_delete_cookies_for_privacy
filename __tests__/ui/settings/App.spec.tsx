/**
 * @jest-environment jsdom
 */
import * as React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react";
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

const SETTINGS_URL = "chrome-extension://ext-id/settings/settings.html";
const TAB_ID = 7;

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

  beforeEach(() => {
    global.browser.i18n.getMessage.mockImplementation((key: string) => key);
    global.browser.runtime.getManifest.mockReturnValue({ version: "1.0.0" });
    global.browser.tabs.getCurrent.mockResolvedValue({
      id: TAB_ID,
      url: SETTINGS_URL,
    });
    // ThemeSwitcher reads the persisted theme choice on mount.
    global.browser.storage.local.get.mockResolvedValue({});
  });

  it("renders the drawer layout with the sidebar and the welcome tab by default", async () => {
    const { container } = renderApp();
    await waitFor(() =>
      expect(global.browser.tabs.getCurrent).toHaveBeenCalled()
    );
    expect(drawerToggle(container)).not.toBeNull();
    expect(container.querySelector("aside")).not.toBeNull();
    expect(container.querySelector("#themeSwitcher")).not.toBeNull();
    expect(contentHeading(container)).toBe("overviewText");
    expect(
      (container.querySelector("#tabWelcome") as HTMLElement).className
    ).toContain("menu-active");
    expect(console.error).not.toHaveBeenCalled();
  });

  it("applies the sizeSetting value as the document font size", async () => {
    renderApp(withSizeSetting(20));
    await waitFor(() =>
      expect(global.browser.tabs.getCurrent).toHaveBeenCalled()
    );
    expect(document.documentElement.style.fontSize).toBe("20px");
  });

  it("opens the tab named in the URL hash after mounting", async () => {
    global.browser.tabs.getCurrent.mockResolvedValue({
      id: TAB_ID,
      url: `${SETTINGS_URL}#tabCleanupLog`,
    });
    const { container } = renderApp();
    await waitFor(() =>
      expect(contentHeading(container)).toBe("cleanupLogText")
    );
    expect(
      (container.querySelector("#tabCleanupLog") as HTMLElement).className
    ).toContain("menu-active");
  });

  it("switches tabs on sidebar clicks and records the hash in the tab URL", async () => {
    const { container } = renderApp();
    await waitFor(() =>
      expect(global.browser.tabs.getCurrent).toHaveBeenCalled()
    );
    // The click depends on the mount effect's state (settings URL / tab id)
    // having landed, not just on getCurrent having been called; React 19's
    // stricter act timing exposed that gap.
    await act(async () => {});

    fireEvent.click(container.querySelector("#tabSettings") as HTMLElement);

    expect(contentHeading(container)).toBe("protectionText");
    expect(
      (container.querySelector("#tabSettings") as HTMLElement).className
    ).toContain("menu-active");
    expect(global.browser.tabs.update).toHaveBeenCalledWith(TAB_ID, {
      url: `${SETTINGS_URL}#tabSettings`,
    });
    expect(console.error).not.toHaveBeenCalled();
  });

  it("keeps the page scrolled to the top on load and on every tab switch", async () => {
    // The URL hash names the sidebar button's element ID, so the browser
    // anchor-scrolls to it; the app must undo that jump.
    const scrollSpy = jest
      .spyOn(window, "scrollTo")
      .mockImplementation(() => undefined);
    global.browser.tabs.getCurrent.mockResolvedValue({
      id: TAB_ID,
      url: `${SETTINGS_URL}#tabCleanupLog`,
    });
    const { container } = renderApp();
    await waitFor(() =>
      expect(contentHeading(container)).toBe("cleanupLogText")
    );
    expect(scrollSpy).toHaveBeenCalledWith(0, 0);

    scrollSpy.mockClear();
    await act(async () => {});
    fireEvent.click(container.querySelector("#tabSettings") as HTMLElement);
    expect(scrollSpy).toHaveBeenCalledWith(0, 0);
    scrollSpy.mockRestore();
  });

  it("closes the mobile drawer when a sidebar tab is clicked", async () => {
    const { container } = renderApp();
    await waitFor(() =>
      expect(global.browser.tabs.getCurrent).toHaveBeenCalled()
    );
    await act(async () => {});

    // Open the drawer (checkbox drives DaisyUI's drawer state).
    fireEvent.click(drawerToggle(container));
    expect(drawerToggle(container).checked).toBe(true);

    fireEvent.click(container.querySelector("#tabSupport") as HTMLElement);
    expect(drawerToggle(container).checked).toBe(false);
  });
});
