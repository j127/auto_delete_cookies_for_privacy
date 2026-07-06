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
  // Section labels are the 05d keep-family names; the tab IDs stay stable
  // because the popup and bookmarks deep-link to them (#tabSettings etc.).
  const sideBarTabs = [
    {
      tabId: "tabWelcome",
      tabText: browser.i18n.getMessage("overviewText"),
    },
    {
      tabId: "tabSettings",
      tabText: browser.i18n.getMessage("protectionText"),
    },
    {
      tabId: "tabExpressionList",
      tabText: browser.i18n.getMessage("savedSitesText"),
    },
    {
      tabId: "tabCleanupLog",
      tabText: browser.i18n.getMessage("cleanupLogText"),
    },
    {
      tabId: "tabImportExport",
      tabText: browser.i18n.getMessage("importExportText"),
    },
    {
      tabId: "tabAbout",
      tabText: browser.i18n.getMessage("aboutText"),
    },
  ];

  return (
    <aside className="min-h-full w-64 bg-base-200">
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
