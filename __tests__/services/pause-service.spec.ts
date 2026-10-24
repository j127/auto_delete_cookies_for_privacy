/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * Pausing automatic cleaning from the popup or the keyboard shortcut
 * (#555): the setting writes, and the background turning cleaning back on
 * when a pause ends.
 */
import { readFileSync } from "fs";
import { SettingID } from "@/typings/enums";
import { resetSettings, updateSetting } from "@/redux/actions";
import { initialState } from "@/redux/state";
// tslint:disable-next-line: import-name
import createStore from "@/redux/store";
import PauseService, {
  getResumeAt,
  PAUSE_HOUR_MS,
  pauseSettings,
  RESUME_NEVER,
  RESUME_ON_RESTART,
  TOGGLE_ACTIVE_MODE_COMMAND,
} from "@/services/pause-service";
import StoreUser from "@/services/store-user";

const store = createStore(initialState);
StoreUser.init(store);

const set = (name: SettingID, value: boolean | number) =>
  store.dispatch(updateSetting({ name, value }));
const active = () => store.getState().settings[SettingID.ACTIVE_MODE].value;
const resumeAt = () => getResumeAt(store.getState());

describe("PauseService", () => {
  afterEach(() => {
    store.dispatch(resetSettings());
    jest.useRealTimers();
  });

  describe("pauseSettings()", () => {
    const now = 1_000_000;

    it("an hour's pause resumes an hour from now", () => {
      expect(pauseSettings("hour", now)).toEqual([
        { name: SettingID.RESUME_ACTIVE_MODE, value: now + PAUSE_HOUR_MS },
        { name: SettingID.ACTIVE_MODE, value: false },
      ]);
    });

    it("an until-restart pause resumes at the next browser start", () => {
      expect(pauseSettings("restart", now)[0]).toEqual({
        name: SettingID.RESUME_ACTIVE_MODE,
        value: RESUME_ON_RESTART,
      });
    });

    it("turning it off sets no resume time", () => {
      expect(pauseSettings("off", now)[0]).toEqual({
        name: SettingID.RESUME_ACTIVE_MODE,
        value: RESUME_NEVER,
      });
    });

    it("writes the resume time before turning cleaning off", () => {
      // The background only forgets a pause when cleaning turns ON, so
      // this order keeps the pause whatever order the writes arrive in.
      expect(pauseSettings("hour", now).map((s) => s.name)).toEqual([
        SettingID.RESUME_ACTIVE_MODE,
        SettingID.ACTIVE_MODE,
      ]);
    });
  });

  describe("getResumeAt()", () => {
    it("reads a state saved before the setting existed as not paused", () => {
      const settings = { ...initialState.settings };
      delete (settings as { [k: string]: Setting })[
        SettingID.RESUME_ACTIVE_MODE
      ];
      expect(getResumeAt({ ...initialState, settings })).toBe(RESUME_NEVER);
    });
  });

  describe("sync()", () => {
    it("arms the resume alarm for a timed pause", async () => {
      const when = Date.now() + PAUSE_HOUR_MS;
      set(SettingID.RESUME_ACTIVE_MODE, when);
      await PauseService.sync();
      expect(global.browser.alarms.create).toHaveBeenCalledWith(
        "resumeActiveModeAlarm",
        { when }
      );
    });

    it("ends a timed pause whose time passed while the browser was closed", async () => {
      set(SettingID.ACTIVE_MODE, false);
      set(SettingID.RESUME_ACTIVE_MODE, Date.now() - 1);
      await PauseService.sync();
      expect(active()).toBe(true);
      expect(resumeAt()).toBe(RESUME_NEVER);
      expect(global.browser.alarms.create).not.toHaveBeenCalled();
    });

    it.each([
      ["not paused", RESUME_NEVER],
      ["paused until restart", RESUME_ON_RESTART],
    ])("drops the alarm when %s", async (_label, value) => {
      set(SettingID.RESUME_ACTIVE_MODE, value);
      await PauseService.sync();
      expect(global.browser.alarms.clear).toHaveBeenCalledWith(
        "resumeActiveModeAlarm"
      );
      expect(global.browser.alarms.create).not.toHaveBeenCalled();
    });
  });

  describe("onAlarm()", () => {
    it("turns cleaning back on when a timed pause ends", () => {
      pauseSettings("hour").forEach((s) => store.dispatch(updateSetting(s)));
      PauseService.onAlarm();
      expect(active()).toBe(true);
      expect(resumeAt()).toBe(RESUME_NEVER);
    });

    it("leaves cleaning off when no pause is left", () => {
      // An alarm from a pause the user already ended, then turned off
      // again with no end time.
      pauseSettings("off").forEach((s) => store.dispatch(updateSetting(s)));
      PauseService.onAlarm();
      expect(active()).toBe(false);
    });
  });

  describe("onStartup()", () => {
    it("ends an until-restart pause", () => {
      pauseSettings("restart").forEach((s) => store.dispatch(updateSetting(s)));
      PauseService.onStartup();
      expect(active()).toBe(true);
      expect(resumeAt()).toBe(RESUME_NEVER);
    });

    it.each(["hour", "off"] as const)("leaves a %s pause alone", (length) => {
      pauseSettings(length).forEach((s) => store.dispatch(updateSetting(s)));
      const before = resumeAt();
      PauseService.onStartup();
      expect(active()).toBe(false);
      expect(resumeAt()).toBe(before);
    });
  });

  describe("toggle() (the keyboard shortcut)", () => {
    it("turns cleaning off with no end time", () => {
      set(SettingID.ACTIVE_MODE, true);
      PauseService.toggle();
      expect(active()).toBe(false);
      expect(resumeAt()).toBe(RESUME_NEVER);
    });

    it("turns cleaning back on and ends any pause", () => {
      pauseSettings("hour").forEach((s) => store.dispatch(updateSetting(s)));
      PauseService.toggle();
      expect(active()).toBe(true);
      expect(resumeAt()).toBe(RESUME_NEVER);
    });
  });

  describe("the manifest shortcut", () => {
    const manifest = JSON.parse(
      readFileSync(
        new URL("../../extension/manifest.json", import.meta.url),
        "utf8"
      )
    );
    const en = JSON.parse(
      readFileSync(
        new URL("../../extension/_locales/en/messages.json", import.meta.url),
        "utf8"
      )
    );

    it("declares the command the background listens for", () => {
      expect(manifest.commands[TOGGLE_ACTIVE_MODE_COMMAND]).toBeDefined();
    });

    it("has a suggested key and a translated description", () => {
      const command = manifest.commands[TOGGLE_ACTIVE_MODE_COMMAND];
      expect(command.suggested_key.default).toBe("Alt+Shift+D");
      const key = /^__MSG_(\w+)__$/.exec(command.description)?.[1];
      expect(key && en[key]?.message).toBeTruthy();
    });
  });
});
