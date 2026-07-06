/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */
import { ListType } from "@/typings/enums";
import * as React from "react";

interface OwnProps {
  cleanDelay: number;
  cookieCount: number;
  hostname: string;
  matchedListType?: ListType;
}

/**
 * Current-site card (05d design): domain, kept / will-be-cleaned badge,
 * cookie count, and the plain-language mechanism line.
 */
const SiteCard: React.FunctionComponent<OwnProps> = ({
  cleanDelay,
  cookieCount,
  hostname,
  matchedListType,
}) => {
  const kept = Boolean(matchedListType);
  let status = browser.i18n.getMessage("siteCleanDelayText", [
    String(cleanDelay),
  ]);
  if (matchedListType === ListType.WHITE) {
    status = browser.i18n.getMessage("siteKeptStatusText");
  } else if (matchedListType === ListType.GREY) {
    status = browser.i18n.getMessage("siteKeptSessionStatusText");
  }

  return (
    <div className="border-b border-base-300 px-4 py-3" id="siteCard">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-lg font-bold">
          {hostname}
        </span>
        <span
          className={`badge badge-sm ${kept ? "badge-success" : "badge-warning"}`}
        >
          {browser.i18n.getMessage(
            kept ? "siteKeptText" : "siteWillBeCleanedText"
          )}
        </span>
        <span className="text-end text-sm whitespace-nowrap text-base-content/70">
          {browser.i18n.getMessage("popupCookieCountText")}:&nbsp;
          <span className="font-bold text-base-content" id="siteCookieCount">
            {cookieCount}
          </span>
        </span>
      </div>
      <div className="mt-1 text-sm text-base-content/70">{status}</div>
    </div>
  );
};

export default SiteCard;
