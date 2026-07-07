/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */
import * as React from "react";
import Icon from "@/ui/common-components/Icon";

interface OwnProps {
  style?: React.CSSProperties;
}

/**
 * The in-app user guide: collapsed sections that together are the only
 * user documentation the project ships. Nothing here links out of the
 * extension.
 */
const HELP_SECTIONS: { titleKey: string; bodyKey: string }[] = [
  { titleKey: "helpGettingStartedTitle", bodyKey: "helpGettingStartedBody" },
  { titleKey: "helpCleaningTitle", bodyKey: "helpCleaningBody" },
  { titleKey: "helpSiteDataTitle", bodyKey: "helpSiteDataBody" },
  { titleKey: "helpPatternsTitle", bodyKey: "helpPatternsBody" },
  { titleKey: "helpImportExportTitle", bodyKey: "helpImportExportBody" },
  { titleKey: "helpLogTitle", bodyKey: "helpLogBody" },
  { titleKey: "helpPermissionsTitle", bodyKey: "helpPermissionsBody" },
  { titleKey: "helpTroubleshootingTitle", bodyKey: "helpTroubleshootingBody" },
];

const Help: React.FunctionComponent<OwnProps> = ({ style }) => (
  <div style={style}>
    <h1 className="mb-1 text-2xl font-bold">
      {browser.i18n.getMessage("helpText")}
    </h1>
    <p className="mb-4 text-sm text-base-content/70">
      {browser.i18n.getMessage("helpSubText")}
    </p>
    <div className="overflow-hidden rounded-box border border-base-300 bg-base-100">
      <div className="divide-y divide-base-300">
        {HELP_SECTIONS.map(({ titleKey, bodyKey }) => (
          <details className="group/help" key={titleKey}>
            <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 font-semibold">
              <Icon
                className="group-open/help:rotate-90 rtl:-scale-x-100"
                name="chevron-right"
                size="sm"
              />
              {browser.i18n.getMessage(titleKey)}
            </summary>
            <div className="px-4 pb-4 text-sm whitespace-pre-line text-base-content/80">
              {browser.i18n.getMessage(bodyKey)}
            </div>
          </details>
        ))}
      </div>
    </div>
  </div>
);

export default Help;
