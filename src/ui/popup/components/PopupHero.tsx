/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */
import { ListType } from "@/typings/enums";
import * as React from "react";

interface OwnProps {
  activeMode: boolean;
  domain: string;
  matchedListType?: ListType;
}

/**
 * The popup's state hero (05d design). Three states:
 * - auto-delete off
 * - on, current site not kept (the resting pair)
 * - on, a keep rule matches (permanent or session wording)
 */
const PopupHero: React.FunctionComponent<OwnProps> = ({
  activeMode,
  domain,
  matchedListType,
}) => {
  let title = browser.i18n.getMessage("popupHeroOnText");
  let subtitle = browser.i18n.getMessage("popupHeroForgetText");
  if (!activeMode) {
    title = browser.i18n.getMessage("popupHeroOffText");
    subtitle = browser.i18n.getMessage("popupHeroOffSubText");
  } else if (matchedListType) {
    title = browser.i18n.getMessage("popupHeroKeepingText");
    subtitle = browser.i18n.getMessage(
      matchedListType === ListType.WHITE
        ? "popupHeroKeepListText"
        : "popupHeroKeepSessionListText",
      [domain]
    );
  }

  return (
    <div
      className="flex items-center gap-3 border-b border-base-300 bg-primary/10 px-4 py-3"
      id="popupHero"
    >
      <span
        className="grid size-11 flex-none place-content-center rounded-full"
        style={{ background: "color-mix(in srgb, #d89b53 20%, transparent)" }}
      >
        <img alt="" className="size-7" src="../icons/icon_48.png" />
      </span>
      <div className="min-w-0">
        <div className="truncate text-base font-bold">{title}</div>
        <div className="truncate text-sm text-base-content/70">{subtitle}</div>
      </div>
    </div>
  );
};

export default PopupHero;
