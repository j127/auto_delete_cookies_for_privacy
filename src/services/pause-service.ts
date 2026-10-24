/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */
import { SettingID } from "@/typings/enums";
import { updateSetting } from "@/redux/actions";
import StoreUser from "./store-user";

/** Not paused: automatic cleaning stays as the user left it. */
export const RESUME_NEVER = 0;

/** Paused until the next browser start (runtime.onStartup). */
export const RESUME_ON_RESTART = -1;

export const PAUSE_HOUR_MS = 60 * 60 * 1000;

/** The manifest `commands` entry that toggles automatic cleaning. */
export const TOGGLE_ACTIVE_MODE_COMMAND = "toggle-active-mode";

/** The popup's three ways to turn automatic cleaning off (#555). */
export type PauseLength = "hour" | "restart" | "off";

/**
 * The setting writes that pause automatic cleaning. The resume time goes
 * first: the background only clears it when cleaning turns back ON, so the
 * order of the two writes never loses the pause.
 */
export const pauseSettings = (
  length: PauseLength,
  now = Date.now()
): Setting[] => {
  let resumeAt = RESUME_NEVER;
  if (length === "hour") resumeAt = now + PAUSE_HOUR_MS;
  if (length === "restart") resumeAt = RESUME_ON_RESTART;
  return [
    { name: SettingID.RESUME_ACTIVE_MODE, value: resumeAt },
    { name: SettingID.ACTIVE_MODE, value: false },
  ];
};

/**
 * Reads the resume setting. It is undefined in a state saved before #555
 * until validateSettings() fills it in.
 */
export const getResumeAt = (state: State): number =>
  Number(state.settings[SettingID.RESUME_ACTIVE_MODE]?.value) || RESUME_NEVER;

/**
 * Background half of the popup's pause (#555). Pausing itself is two plain
 * setting writes (pauseSettings); this turns cleaning back on when the
 * pause ends:
 * - a timed pause has a chrome.alarms alarm, re-armed on every worker start
 *   because Chrome may drop alarms over a browser restart, and ended at
 *   once if its time passed while the browser was closed;
 * - an until-restart pause ends in runtime.onStartup.
 * Turning cleaning on by any other way (settings page, context menu,
 * keyboard shortcut) clears the pause in SettingService.
 */
export default class PauseService extends StoreUser {
  public static readonly RESUME_ALARM = "resumeActiveModeAlarm";

  /**
   * Arms, re-arms or drops the resume alarm to match the setting. Runs on
   * every worker start and whenever the setting changes.
   */
  public static async sync(): Promise<void> {
    const resumeAt = getResumeAt(StoreUser.store.getState());
    if (resumeAt > 0) {
      if (resumeAt <= Date.now()) {
        PauseService.resume();
        return;
      }
      await browser.alarms.create(PauseService.RESUME_ALARM, {
        when: resumeAt,
      });
    } else {
      await browser.alarms.clear(PauseService.RESUME_ALARM);
    }
  }

  /** The resume alarm fired. */
  public static onAlarm(): void {
    if (getResumeAt(StoreUser.store.getState()) > 0) PauseService.resume();
  }

  /** A browser start ends an until-restart pause. */
  public static onStartup(): void {
    if (getResumeAt(StoreUser.store.getState()) === RESUME_ON_RESTART) {
      PauseService.resume();
    }
  }

  /**
   * The keyboard shortcut: off until turned back on, or back on (ending any
   * pause).
   */
  public static toggle(): void {
    if (StoreUser.store.getState().settings[SettingID.ACTIVE_MODE].value) {
      pauseSettings("off").forEach((s) =>
        StoreUser.store.dispatch(updateSetting(s))
      );
    } else {
      PauseService.resume();
    }
  }

  /** Turns automatic cleaning back on and forgets the pause. */
  public static resume(): void {
    StoreUser.store.dispatch(
      updateSetting({ name: SettingID.RESUME_ACTIVE_MODE, value: RESUME_NEVER })
    );
    StoreUser.store.dispatch(
      updateSetting({ name: SettingID.ACTIVE_MODE, value: true })
    );
  }
}
