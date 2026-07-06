/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */
import * as React from "react";
import { useSelector } from "react-redux";

interface OwnProps {
  tabIndex: number;
}

const cookieCountOf = (entry: ActivityLog): number =>
  Object.values(entry.storeIds).reduce((sum, list) => sum + list.length, 0);

/**
 * Popup footer (05d design): a one-line summary of the most recent clean
 * and the "More controls…" link into the settings page — the discoverability
 * escape hatch for everything the simple popup hides.
 */
const PopupFooter: React.FunctionComponent<OwnProps> = ({ tabIndex }) => {
  const lastClean = useSelector((s: State) => s.activityLog[0]);

  const openSettings = () => {
    browser.tabs.create({
      index: tabIndex + 1,
      url: "/settings/settings.html#tabSettings",
    });
    window.close();
  };

  return (
    <div className="flex items-center gap-2 bg-base-200 px-4 py-2.5 text-xs text-base-content/70">
      {lastClean && (
        <span className="min-w-0 truncate" id="lastCleanSummary">
          {browser.i18n.getMessage("lastCleanSummaryText", [
            String(cookieCountOf(lastClean)),
            new Date(lastClean.dateTime).toLocaleTimeString(undefined, {
              hour: "2-digit",
              minute: "2-digit",
            }),
          ])}
        </span>
      )}
      <button
        className="ms-auto font-semibold text-primary hover:underline"
        id="moreControls"
        onClick={openSettings}
        title={browser.i18n.getMessage("preferencesText")}
        type="button"
      >
        {browser.i18n.getMessage("moreControlsText")}
      </button>
    </div>
  );
};

export default PopupFooter;
