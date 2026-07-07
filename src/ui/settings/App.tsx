/**
 * Copyright (c) 2017-2022 Kenny Do and CAD Team (https://github.com/Cookie-AutoDelete/Cookie-AutoDelete/graphs/contributors)
 * Licensed under MIT (https://github.com/Cookie-AutoDelete/Cookie-AutoDelete/blob/3.X.X-Branch/LICENSE)
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import { SettingID } from "@/typings/enums";
import * as React from "react";
import { useSelector } from "react-redux";
import ErrorBoundary from "@/ui/common-components/ErrorBoundary";
import Icon from "@/ui/common-components/Icon";
import ActivityLog from "./components/ActivityLog";
import Expressions from "./components/Expressions";
import ImportExport from "./components/ImportExport";
import Settings from "./components/Settings";
import Support from "./components/Support";
import SideBar from "./components/SideBar";
import ThemeSwitcher from "./components/ThemeSwitcher";
import Welcome from "./components/Welcome";

const App: React.FunctionComponent = () => {
  const sizeSetting = useSelector(
    (state: State) =>
      (state.settings[SettingID.SIZE_SETTING].value as number) || 16
  );
  const [activeTab, setActiveTab] = React.useState("tabWelcome");
  const [settingsURL, setSettingsURL] = React.useState("");
  const [tabId, setTabId] = React.useState(0);
  // DaisyUI's drawer is checkbox-driven; controlling the checkbox lets tab
  // clicks close the drawer on small screens (lg+ keeps it statically open).
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  // Gets the url hash and switches to that sidebar tab
  React.useEffect(() => {
    document.documentElement.style.fontSize = `${sizeSetting || 16}px`;
    const applyInitialTab = async () => {
      const tab = await browser.tabs.getCurrent();
      const tabURL = new URL(tab.url || "");
      setActiveTab(
        tabURL.hash !== "" || undefined ? tabURL.hash.slice(1) : "tabWelcome"
      );
      setSettingsURL(tab.url || "");
      setTabId(tab.id ?? 0);
      // The hash names an element ID (the sidebar button), so the browser
      // anchor-scrolls past the navbar on load; undo that.
      window.scrollTo(0, 0);
    };
    applyInitialTab();
    // The class component applied the font size and read the URL hash once
    // in componentDidMount, so this effect intentionally runs on mount only.
  }, []);

  // Switch tabs and appends the hash of the tab name in the url
  const switchTabs = (newActiveTab: string) => {
    setActiveTab(newActiveTab);
    setDrawerOpen(false);
    const newUrl = new URL(settingsURL);
    newUrl.hash = newActiveTab;
    browser.tabs.update(tabId, {
      url: newUrl.href,
    });
    // Same anchor-jump on every hash update: a new page starts at the top.
    window.scrollTo(0, 0);
  };

  return (
    <div className="flex min-h-screen flex-col">
      {/* The brand lives in this full-width bar (05d feedback): the name
          gets the whole page width instead of wrapping inside the sidebar. */}
      <header className="navbar border-b border-base-300 bg-base-100">
        <div className="navbar-start gap-1">
          <label
            htmlFor="settings-drawer"
            className="drawer-button btn btn-ghost lg:hidden"
            aria-label={browser.i18n.getMessage("menuText")}
          >
            <Icon size="lg" name="bars" />
          </label>
          <img alt="" className="size-7 flex-none" src="../icons/icon_48.png" />
          <span className="px-2 text-lg font-semibold whitespace-nowrap">
            {browser.i18n.getMessage("extensionName")}
          </span>
        </div>
        <div className="navbar-end pe-2">
          <ThemeSwitcher />
        </div>
      </header>
      <div className="drawer flex-1 lg:drawer-open">
        <input
          id="settings-drawer"
          type="checkbox"
          className="drawer-toggle"
          checked={drawerOpen}
          onChange={(e) => setDrawerOpen(e.target.checked)}
        />
        <div className="drawer-content">
          <ErrorBoundary>
            <main className="mx-auto w-full max-w-3xl p-4 pb-16 lg:p-8">
              {activeTab === "tabWelcome" ? <Welcome /> : ""}
              {activeTab === "tabSettings" ? <Settings /> : ""}
              {activeTab === "tabExpressionList" ? <Expressions /> : ""}
              {activeTab === "tabCleanupLog" ? <ActivityLog /> : ""}
              {activeTab === "tabImportExport" ? <ImportExport /> : ""}
              {activeTab === "tabSupport" ? <Support /> : ""}
            </main>
          </ErrorBoundary>
        </div>
        <div className="drawer-side z-20">
          <label
            htmlFor="settings-drawer"
            aria-label={browser.i18n.getMessage("menuText")}
            className="drawer-overlay"
          ></label>
          <SideBar
            switchTabs={(tab) => switchTabs(tab)}
            activeTab={activeTab}
          />
        </div>
      </div>
    </div>
  );
};

export default App;
