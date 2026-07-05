/**
 * @jest-environment jsdom
 */
import * as React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore } from "redux";
import { initialState } from "../../../src/redux/state";
import { SettingID } from "../../../src/typings/enums";
import fontAwesomeImports from "../../../src/ui/font-awesome-imports";

// Register the FontAwesome icons the settings entrypoint normally provides.
fontAwesomeImports();

// App renders SideBar, which resolves its tab labels through browser.i18n at
// module load time, so the mock implementation must be in place before the
// module graph is imported. A static import would run before any test hook.
let App: (typeof import("../../../src/ui/settings/App"))["default"];

beforeAll(async () => {
  global.browser.i18n.getMessage.mockImplementation((key: string) => key);
  App = (await import("../../../src/ui/settings/App")).default;
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
    (container.querySelector(".container h1") as HTMLElement).textContent;

  beforeEach(() => {
    global.browser.i18n.getMessage.mockImplementation((key: string) => key);
    global.browser.runtime.getManifest.mockReturnValue({ version: "4.0.0" });
    global.browser.tabs.getCurrent.mockResolvedValue({
      id: TAB_ID,
      url: SETTINGS_URL,
    });
  });

  it("renders the layout with the sidebar and the welcome tab by default", async () => {
    const { container } = renderApp();
    await waitFor(() =>
      expect(global.browser.tabs.getCurrent).toHaveBeenCalled()
    );
    expect(container.querySelector("#layout")).not.toBeNull();
    expect(container.querySelector("#menu")).not.toBeNull();
    expect(contentHeading(container)).toBe("welcomeText");
    expect(
      (container.querySelector("#tabWelcome") as HTMLElement).className
    ).toContain("pure-menu-selected");
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
    ).toContain("pure-menu-selected");
  });

  it("switches tabs on sidebar clicks and records the hash in the tab URL", async () => {
    const { container } = renderApp();
    await waitFor(() =>
      expect(global.browser.tabs.getCurrent).toHaveBeenCalled()
    );

    fireEvent.click(container.querySelector("#tabSettings") as HTMLElement);

    expect(contentHeading(container)).toBe("settingsText");
    expect(
      (container.querySelector("#tabSettings") as HTMLElement).className
    ).toContain("pure-menu-selected");
    expect(global.browser.tabs.update).toHaveBeenCalledWith(TAB_ID, {
      url: `${SETTINGS_URL}#tabSettings`,
    });
    expect(console.error).not.toHaveBeenCalled();
  });
});
