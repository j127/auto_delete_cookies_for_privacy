/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */
import { ListType } from "@/typings/enums";
import {
  RESUME_NEVER,
  RESUME_ON_RESTART,
  type PauseLength,
} from "@/services/pause-service";
import * as React from "react";

interface OwnProps {
  activeMode: boolean;
  domain: string;
  matchedListType?: ListType;
  /** When a pause ends (#555); see src/services/pause-service.ts. */
  resumeAt?: number;
  onPause: (length: PauseLength) => void;
  onTurnOn: () => void;
}

const PAUSE_CHOICES: { length: PauseLength; text: string }[] = [
  { length: "hour", text: "popupPauseHourText" },
  { length: "restart", text: "popupPauseRestartText" },
  { length: "off", text: "popupPauseOffText" },
];

/**
 * The popup's state hero (05d design). Three states:
 * - auto-delete off (paused for a while, or until turned back on)
 * - on, current site not kept (the resting pair)
 * - on, a keep rule matches (permanent or session wording)
 *
 * Its switch turns automatic cleaning on at once. Turning it off first asks
 * for how long (#555), so a quick pause can't be forgotten.
 */
const PopupHero: React.FunctionComponent<OwnProps> = ({
  activeMode,
  domain,
  matchedListType,
  resumeAt = RESUME_NEVER,
  onPause,
  onTurnOn,
}) => {
  const [choosing, setChoosing] = React.useState(false);
  const firstChoiceRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (choosing) firstChoiceRef.current?.focus();
  }, [choosing]);

  let title = browser.i18n.getMessage("popupHeroOnText");
  let subtitle = browser.i18n.getMessage("popupHeroForgetText");
  if (!activeMode) {
    title = browser.i18n.getMessage("popupHeroOffText");
    if (resumeAt > 0) {
      subtitle = browser.i18n.getMessage("popupHeroResumesAtText", [
        new Date(resumeAt).toLocaleTimeString(browser.i18n.getUILanguage(), {
          hour: "numeric",
          minute: "2-digit",
        }),
      ]);
    } else if (resumeAt === RESUME_ON_RESTART) {
      subtitle = browser.i18n.getMessage("popupHeroResumesOnRestartText");
    } else {
      subtitle = browser.i18n.getMessage("popupHeroOffSubText");
    }
  } else if (matchedListType) {
    title = browser.i18n.getMessage("popupHeroKeepingText");
    subtitle = browser.i18n.getMessage(
      matchedListType === ListType.WHITE
        ? "popupHeroKeepListText"
        : "popupHeroKeepSessionListText",
      [domain]
    );
  }

  const onSwitch = () => {
    if (activeMode) {
      setChoosing(!choosing);
    } else {
      onTurnOn();
    }
  };

  const pause = (length: PauseLength) => {
    setChoosing(false);
    onPause(length);
  };

  return (
    <div
      className="flex flex-col gap-3 border-b border-base-300 bg-primary/10 px-4 py-3"
      id="popupHero"
    >
      <div className="flex items-center gap-3">
        <span
          className="grid size-11 flex-none place-content-center rounded-full"
          style={{
            background: "color-mix(in srgb, #d89b53 20%, transparent)",
          }}
        >
          <img
            alt=""
            className="size-7"
            src={`../icons/icon_48${activeMode ? "" : "_greyscale"}.png`}
          />
        </span>
        {/* Wraps instead of truncating: a cut-off subtitle hid when a
            pause ends ("…when the browser restar…") at phone width, and
            long translations and domains lost more. overflow-wrap:
            anywhere still breaks a domain longer than the line. */}
        <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
          <div className="text-base font-bold" id="popupHeroTitle">
            {title}
          </div>
          <div className="text-sm text-base-content/70" id="popupHeroSubtitle">
            {subtitle}
          </div>
        </div>
        <input
          aria-label={browser.i18n.getMessage("activeModeText")}
          checked={activeMode}
          className="toggle flex-none toggle-primary"
          id="activeModeSwitch"
          onChange={onSwitch}
          title={browser.i18n.getMessage("activeModeText")}
          type="checkbox"
        />
      </div>
      {activeMode && choosing && (
        <div
          aria-labelledby="pauseChoicesLabel"
          className="flex flex-col gap-2"
          id="pauseChoices"
          role="group"
        >
          <div className="text-sm font-semibold" id="pauseChoicesLabel">
            {browser.i18n.getMessage("popupPauseChoicesText")}
          </div>
          <div className="flex flex-wrap gap-2">
            {PAUSE_CHOICES.map(({ length, text }, i) => (
              <button
                className="btn btn-sm"
                key={length}
                onClick={() => pause(length)}
                ref={i === 0 ? firstChoiceRef : undefined}
                type="button"
              >
                {browser.i18n.getMessage(text)}
              </button>
            ))}
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setChoosing(false)}
              type="button"
            >
              {browser.i18n.getMessage("popupPauseCancelText")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PopupHero;
