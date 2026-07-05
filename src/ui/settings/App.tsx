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
import { SettingID } from "../../typings/enums";
import * as React from "react";
import { useSelector } from "react-redux";
import ErrorBoundary from "../common-components/ErrorBoundary";
import About from "./components/About";
import ActivityLog from "./components/ActivityLog";
import Expressions from "./components/Expressions";
import Settings from "./components/Settings";
import SideBar from "./components/SideBar";
import Welcome from "./components/Welcome";

const App: React.FunctionComponent = () => {
  const sizeSetting = useSelector(
    (state: State) =>
      (state.settings[SettingID.SIZE_SETTING].value as number) || 16
  );
  const [activeTab, setActiveTab] = React.useState("tabWelcome");
  const [settingsURL, setSettingsURL] = React.useState("");
  const [tabId, setTabId] = React.useState(0);

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
    };
    applyInitialTab();
    // The class component applied the font size and read the URL hash once
    // in componentDidMount, so this effect intentionally runs on mount only.
  }, []);

  // Switch tabs and appends the hash of the tab name in the url
  const switchTabs = (newActiveTab: string) => {
    setActiveTab(newActiveTab);
    const newUrl = new URL(settingsURL);
    newUrl.hash = newActiveTab;
    browser.tabs.update(tabId, {
      url: newUrl.href,
    });
  };

  return (
    <div id="layout" className="layout">
      <SideBar switchTabs={(tab) => switchTabs(tab)} activeTab={activeTab} />
      <ErrorBoundary>
        <div className="container">
          {activeTab === "tabWelcome" ? <Welcome /> : ""}
          {activeTab === "tabSettings" ? <Settings /> : ""}
          {activeTab === "tabExpressionList" ? <Expressions /> : ""}
          {activeTab === "tabCleanupLog" ? <ActivityLog /> : ""}
          {activeTab === "tabAbout" ? <About /> : ""}
        </div>
      </ErrorBoundary>
    </div>
  );
};

export default App;
