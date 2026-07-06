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
import { SiteDataType } from "@/typings/enums";
import * as React from "react";
import { useStore } from "react-redux";
import {
  clearCookiesForThisDomain,
  clearLocalStorageForThisDomain,
  clearSiteDataForThisDomain,
} from "@/services/cleanup-service";
import { animateFlash } from "@/ui/popup/popup-lib";

interface OwnProps {
  altColor?: boolean;
  btnColor?: string;
  hostname?: string;
  onClick?: () => Promise<boolean>;
  siteData?: SiteDataType | "All";
  tab?: browser.tabs.Tab;
  title?: string;
  text?: string;
}

const cleanSiteDataUI = async (
  state: State,
  siteData: SiteDataType | "All",
  hostname: string,
  tab?: browser.tabs.Tab
): Promise<boolean> => {
  if (!hostname) return false;
  let result = await clearSiteDataForThisDomain(state, siteData, hostname);
  if (siteData === "All") {
    if (!tab) return false;
    const cookieSuccess = await clearCookiesForThisDomain(state, tab);
    const localStorageSuccess = await clearLocalStorageForThisDomain(
      state,
      tab
    );
    result = result || cookieSuccess || localStorageSuccess;
  }
  return result;
};

const CleanDataButton: React.FunctionComponent<OwnProps> = (props) => {
  // The fallback click path needs the full state; it is read from the store
  // at click time instead of through a render subscription.
  const store = useStore();
  // No rest spread here: the props are destructured explicitly so nothing
  // unexpected can land on the <button> as an invalid DOM attribute (which
  // React would warn about).
  const { altColor, btnColor, hostname, onClick, siteData, tab, title, text } =
    props;
  return (
    <button
      className={`btn ${
        btnColor || `btn-${altColor ? "secondary" : "primary"}`
      } btn-block btn-sm`}
      onClick={async () => {
        // The click also bubbles to the popup App's root handler, which
        // closes the options panel (the old Bootstrap data-toggle markup
        // did the same).
        let result = true;
        if (onClick) {
          result = await onClick.apply(this);
        } else if (siteData && hostname) {
          result = await cleanSiteDataUI(
            store.getState() as State,
            siteData,
            hostname,
            tab
          );
        }
        animateFlash(document.getElementById("cleanButtonContainer"), result);
      }}
      title={
        title ||
        (siteData &&
          hostname &&
          browser.i18n.getMessage(`manualCleanSiteData${siteData}Domain`, [
            hostname,
          ])) ||
        ""
      }
      type="button"
    >
      {text || browser.i18n.getMessage(`manualCleanSiteData${siteData}`)}
    </button>
  );
};

export default CleanDataButton;
