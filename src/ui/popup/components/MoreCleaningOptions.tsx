/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */
import * as React from "react";
import { useDispatch, useStore } from "react-redux";
import { cookieCleanupUI } from "@/redux/actions";
import {
  clearCookiesForThisDomain,
  clearLocalStorageForThisDomain,
  clearSiteDataForThisDomain,
} from "@/services/cleanup-service";
import { getPort } from "@/services/libs";
import { animateFlash } from "@/ui/popup/popup-lib";

interface OwnProps {
  hostname: string;
  tab: browser.tabs.Tab;
}

/**
 * The scoped clean menu behind the advanced-popup setting (05d design):
 * global clean including open tabs, plus the two current-site one-offs.
 * Every label states its scope; tooltips carry the full explanation.
 */
const MoreCleaningOptions: React.FunctionComponent<OwnProps> = ({
  hostname,
  tab,
}) => {
  const dispatch = useDispatch<any>();
  // The site-scoped actions need the full state at click time only.
  const store = useStore();

  const flash = (result: boolean) =>
    animateFlash(document.getElementById("popupActions"), result);

  const deleteSiteData = async (): Promise<boolean> => {
    const state = store.getState() as State;
    // browsingData removals are origin-scoped; carry the tab's explicit
    // port so non-default-port storage (e.g. localhost:3000) is covered.
    const dataResult = await clearSiteDataForThisDomain(
      state,
      "All",
      hostname,
      getPort(tab.url)
    );
    const cookieResult = await clearCookiesForThisDomain(state, tab);
    const localStorageResult = await clearLocalStorageForThisDomain(state, tab);
    return dataResult || cookieResult || localStorageResult;
  };

  return (
    <details className="border-t border-base-300">
      <summary className="cursor-pointer px-4 py-2 text-center text-sm text-base-content/70">
        {browser.i18n.getMessage("moreCleaningOptionsText")}
      </summary>
      <div className="flex flex-col gap-2 px-4 pb-3" id="moreCleaningOptions">
        <button
          className="btn justify-start btn-sm"
          onClick={() => {
            dispatch(
              cookieCleanupUI({
                greyCleanup: false,
                ignoreOpenTabs: true,
              })
            );
            flash(true);
          }}
          title={browser.i18n.getMessage("cleanIncludeOpenTabsTooltipText")}
          type="button"
        >
          {browser.i18n.getMessage("cleanIncludeOpenTabsText")}
        </button>
        <button
          className="btn justify-start btn-sm"
          onClick={async () => {
            flash(
              await clearCookiesForThisDomain(store.getState() as State, tab)
            );
          }}
          title={browser.i18n.getMessage("deleteSiteCookiesTooltipText", [
            hostname,
          ])}
          type="button"
        >
          {browser.i18n.getMessage("deleteSiteCookiesText")}
        </button>
        <button
          className="btn justify-start btn-sm"
          onClick={async () => {
            flash(await deleteSiteData());
          }}
          title={browser.i18n.getMessage("deleteSiteDataTooltipText", [
            hostname,
          ])}
          type="button"
        >
          {browser.i18n.getMessage("deleteSiteDataText")}
        </button>
      </div>
    </details>
  );
};

export default MoreCleaningOptions;
