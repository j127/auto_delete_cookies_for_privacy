/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */
import { ListType } from "@/typings/enums";
import * as React from "react";
import { useDispatch } from "react-redux";
import {
  addExpressionUI,
  cookieCleanupUI,
  removeExpressionUI,
} from "@/redux/actions";
import { localFileToRegex } from "@/services/libs";
import { animateFlash } from "@/ui/popup/popup-lib";

interface OwnProps {
  /** The broadest addable expression, e.g. `*.example.com`. */
  keepExpression: string;
  /** The plain domain shown in the caption, e.g. `example.com`. */
  domain: string;
  matched?: Expression;
  storeId: string;
}

/**
 * The popup's action block (05d design). Simple mode offers one honest
 * primary action — keep the site (whitelist `*.domain`) — plus the session
 * variant and Clean now. When a rule already matches, the keep actions are
 * replaced by a remove-rule action so clicks never stack duplicate rules.
 */
const KeepActions: React.FunctionComponent<OwnProps> = ({
  keepExpression,
  domain,
  matched,
  storeId,
}) => {
  const dispatch = useDispatch<any>();

  const addToList = (listType: ListType) => {
    dispatch(
      addExpressionUI({
        expression: localFileToRegex(keepExpression),
        listType,
        storeId,
      })
    );
  };

  const cleanNow = () => {
    dispatch(
      cookieCleanupUI({
        greyCleanup: false,
        ignoreOpenTabs: false,
      })
    );
    animateFlash(document.getElementById("popupActions"), true);
  };

  return (
    <div className="flex flex-col gap-2 px-4 py-3" id="popupActions">
      {matched ? (
        <button
          className="btn btn-outline"
          onClick={() => dispatch(removeExpressionUI(matched))}
          type="button"
        >
          {browser.i18n.getMessage("stopKeepingButtonText")}
        </button>
      ) : (
        <>
          <button
            className="btn btn-primary"
            onClick={() => addToList(ListType.WHITE)}
            type="button"
          >
            {browser.i18n.getMessage("keepCookiesButtonText")}
          </button>
          <div className="text-center text-xs text-base-content/70">
            {browser.i18n.getMessage("keepCookiesCaptionText", [domain])}
          </div>
        </>
      )}
      <div className="flex gap-2">
        {!matched && (
          <button
            className="btn flex-1 btn-sm"
            onClick={() => addToList(ListType.GREY)}
            title={browser.i18n.getMessage("keepSessionButtonTooltipText")}
            type="button"
          >
            {browser.i18n.getMessage("keepUntilCloseButtonText")}
          </button>
        )}
        <button
          className="btn flex-1 btn-sm"
          id="cleanButtonContainer"
          onClick={cleanNow}
          title={browser.i18n.getMessage("cleanNowTooltipText")}
          type="button"
        >
          {browser.i18n.getMessage("cleanNowText")}
        </button>
      </div>
    </div>
  );
};

export default KeepActions;
