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

import { SiteDataType } from "../../../typings/enums";
import * as React from "react";
import { useDispatch, useStore } from "react-redux";
import { cookieCleanupUI } from "../../../redux/actions";
import {
  clearCookiesForThisDomain,
  clearLocalStorageForThisDomain,
} from "../../../services/cleanup-service";
import CleanDataButton from "./CleanDataButton";

interface OwnProps {
  hostname: string;
  tab: browser.tabs.Tab;
}

type CleanCollapseComponentProps = OwnProps;

const CleanCollapseGroup: React.FunctionComponent<
  CleanCollapseComponentProps
> = (props) => {
  const { hostname, tab } = props;
  const dispatch = useDispatch<any>();
  // The clean-service calls only need the state when a button is clicked,
  // so it is read from the store at event time instead of through a
  // render subscription.
  const store = useStore();
  return (
    <div
      className="row justify-content-center collapse"
      id="cleanCollapse"
      role="group"
      style={{
        alignItems: "center",
        backgroundColor: "rgba(0, 0, 0, 0.05)",
        borderBottom: "1px solid rgba(0, 0, 0, 0.1)",
        padding: "4px 4px 8px 4px",
      }}
    >
      <div className="btn-group-vertical">
        <CleanDataButton
          btnColor="btn-warning"
          onClick={async () => {
            dispatch(
              cookieCleanupUI({
                greyCleanup: false,
                ignoreOpenTabs: true,
              })
            );
            return true;
          }}
          title={browser.i18n.getMessage("cookieCleanupIgnoreOpenTabsText")}
          text={browser.i18n.getMessage("cleanIgnoringOpenTabsText")}
        />
        <button
          aria-disabled={true}
          className="btn btn-light btn-block text-danger font-weight-bold px-2"
          disabled={true}
          type="button"
        >
          {browser.i18n.getMessage("cleanupActionsBypass")}
        </button>
        <CleanDataButton siteData="All" hostname={hostname} tab={tab} />
        <CleanDataButton
          altColor
          siteData={SiteDataType.CACHE}
          hostname={hostname}
        />
        <CleanDataButton
          onClick={async () => {
            return await clearCookiesForThisDomain(
              store.getState() as State,
              tab
            );
          }}
          title={browser.i18n.getMessage("manualCleanSiteDataCookiesDomain", [
            hostname,
          ])}
          text={browser.i18n.getMessage("manualCleanSiteDataCookies")}
        />
        <CleanDataButton
          altColor
          siteData={SiteDataType.INDEXEDDB}
          hostname={hostname}
        />
        <CleanDataButton
          onClick={async () => {
            return await clearLocalStorageForThisDomain(
              store.getState() as State,
              tab
            );
          }}
          siteData={SiteDataType.LOCALSTORAGE}
          hostname={hostname}
        />
        <CleanDataButton
          altColor
          siteData={SiteDataType.PLUGINDATA}
          hostname={hostname}
        />
        <CleanDataButton
          siteData={SiteDataType.SERVICEWORKERS}
          hostname={hostname}
        />
      </div>
    </div>
  );
};

export default CleanCollapseGroup;
