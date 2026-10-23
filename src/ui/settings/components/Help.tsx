/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */
import * as React from "react";
import Icon from "@/ui/common-components/Icon";
import MessageWithLink, {
  BRAVE_LINK,
  type MessageLink,
} from "@/ui/common-components/MessageWithLink";
import { pinStepKeys } from "@/ui/settings/pin-step";

interface OwnProps {
  style?: React.CSSProperties;
}

/**
 * The in-app user guide: collapsed sections that together are the only
 * user documentation the project ships. Nothing here links out of the
 * extension, except the Brave link in "What gets deleted" (#529), which
 * the Firefox site-data note carries.
 */
const HELP_SECTIONS: {
  titleKey: string;
  bodyKey: string;
  link?: MessageLink;
  /** Message keys whose text fills the body's placeholders, in order. */
  substitutionKeys?: () => string[];
}[] = [
  {
    titleKey: "helpGettingStartedTitle",
    bodyKey: "helpGettingStartedBody",
    // Item 4 says how to pin the extension, which differs per browser (#536).
    substitutionKeys: () => [pinStepKeys().help],
  },
  { titleKey: "helpCleaningTitle", bodyKey: "helpCleaningBody" },
  {
    titleKey: "helpSiteDataTitle",
    bodyKey: "helpSiteDataBody",
    link: BRAVE_LINK,
  },
  { titleKey: "helpPatternsTitle", bodyKey: "helpPatternsBody" },
  { titleKey: "helpCookieNamesTitle", bodyKey: "helpCookieNamesBody" },
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
        {HELP_SECTIONS.map(({ titleKey, bodyKey, link, substitutionKeys }) => (
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
              {link ? (
                <MessageWithLink link={link} messageKey={bodyKey} />
              ) : substitutionKeys ? (
                browser.i18n.getMessage(
                  bodyKey,
                  substitutionKeys().map((key) => browser.i18n.getMessage(key))
                )
              ) : (
                browser.i18n.getMessage(bodyKey)
              )}
            </div>
          </details>
        ))}
      </div>
    </div>
  </div>
);

export default Help;
