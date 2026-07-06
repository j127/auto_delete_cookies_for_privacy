/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */
import { ListType } from "@/typings/enums";
import * as React from "react";
import { useDispatch } from "react-redux";
import { addExpressionUI } from "@/redux/actions";
import { localFileToRegex } from "@/services/libs";

interface OwnProps {
  addableHostnames: string[];
  matched?: Expression;
  storeId: string;
}

/**
 * The matched-rule line and the per-expression keep rows, shown only when
 * "Show advanced controls in the popup" is on (05d design). Buttons are in
 * [Keep this session] [Keep] order — the permanent action sits in the
 * far-end primary slot.
 */
const AdvancedControls: React.FunctionComponent<OwnProps> = ({
  addableHostnames,
  matched,
  storeId,
}) => {
  const dispatch = useDispatch<any>();

  const addToList = (expression: string, listType: ListType) => {
    dispatch(
      addExpressionUI({
        expression: localFileToRegex(expression),
        listType,
        storeId,
      })
    );
  };

  return (
    <div id="advancedControls">
      <div className="border-b border-base-300 bg-base-200 px-4 py-2 text-xs text-base-content/70">
        {matched
          ? browser.i18n.getMessage("matchedRuleText", [matched.expression])
          : browser.i18n.getMessage("noRuleMatchText")}
      </div>
      <div className="flex flex-col gap-2 border-b border-base-300 px-4 py-3">
        {addableHostnames.map((expression) => (
          <div className="flex items-center gap-2" key={expression}>
            <span className="min-w-0 flex-1 truncate font-mono text-xs text-base-content/70">
              {expression}
            </span>
            <button
              className="btn btn-xs"
              onClick={() => addToList(expression, ListType.GREY)}
              title={browser.i18n.getMessage("keepSessionButtonTooltipText")}
              type="button"
            >
              {browser.i18n.getMessage("keepSessionButtonText")}
            </button>
            <button
              className="btn btn-primary btn-xs"
              onClick={() => addToList(expression, ListType.WHITE)}
              title={browser.i18n.getMessage("keepButtonTooltipText")}
              type="button"
            >
              {browser.i18n.getMessage("keepButtonText")}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdvancedControls;
