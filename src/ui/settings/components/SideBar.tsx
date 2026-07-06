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
import * as React from "react";

interface OwnProps {
  activeTab: string;
  switchTabs: (id: string) => void;
}

const SideBar: React.FunctionComponent<OwnProps> = ({
  activeTab,
  switchTabs,
}) => {
  // The tab list is built during render rather than at module load so that
  // browser.i18n.getMessage is only called once the message catalog is ready.
  const sideBarTabs = [
    {
      tabId: "tabWelcome",
      tabText: browser.i18n.getMessage("welcomeText"),
    },
    {
      tabId: "tabSettings",
      tabText: browser.i18n.getMessage("settingsText"),
    },
    {
      tabId: "tabExpressionList",
      tabText: browser.i18n.getMessage("expressionListText"),
    },
    {
      tabId: "tabCleanupLog",
      tabText: browser.i18n.getMessage("cleanupLogText"),
    },
    {
      tabId: "tabAbout",
      tabText: browser.i18n.getMessage("aboutText"),
    },
  ];

  return (
    <aside className="min-h-full w-64 bg-base-200">
      <div className="border-b border-base-300 px-4 py-5 text-center">
        <div className="text-sm opacity-70">
          {browser.i18n.getMessage("versionNumberText", ["ADCP"])}
        </div>
        <div className="font-mono text-lg font-bold">
          {browser.runtime.getManifest().version}
        </div>
      </div>
      <ul className="menu w-full gap-1 p-2">
        {sideBarTabs.map((element) => (
          <li key={element.tabId}>
            <button
              type="button"
              id={`${element.tabId}`}
              onClick={() => switchTabs(element.tabId)}
              className={activeTab === element.tabId ? "menu-active" : ""}
            >
              {element.tabText}
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
};

export default SideBar;
