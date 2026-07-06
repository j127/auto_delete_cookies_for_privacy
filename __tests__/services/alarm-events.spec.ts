/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2017-2022 Kenny Do and CAD Team; fork changes (c) 2026 j127.
 * Licensed under MIT (see LICENSE).
 */
import { SettingID } from "@/typings/enums";
import { Store } from "redux";
import * as Actions from "@/redux/actions";
import { initialState } from "@/redux/state";
// tslint:disable-next-line: import-name
import createStore from "@/redux/store";
import { ReduxAction } from "@/typings/redux-constants";
import AlarmEvents from "@/services/alarm-events";
import StoreUser from "@/services/store-user";


const store: Store<State, ReduxAction> = createStore(initialState);
StoreUser.init(store);

class TestStore extends StoreUser {
  public static changeSetting(
    name: SettingID,
    value: string | boolean | number
  ) {
    StoreUser.store.dispatch(Actions.updateSetting({ name, value }));
  }

  public static resetSetting() {
    StoreUser.store.dispatch(Actions.resetSettings());
  }
}

const sessionGet = global.browser.storage.session.get;
const sessionSet = global.browser.storage.session.set;
const sessionRemove = global.browser.storage.session.remove;

describe("AlarmEvents", () => {
  afterEach(() => {
    TestStore.resetSetting();
    jest.useRealTimers();
  });

  describe("createActiveModeAlarm()", () => {
    it("should persist a pendingCleanup record and create the backstop alarm", async () => {
      sessionGet.mockResolvedValue({ pendingCleanup: null });
      sessionSet.mockResolvedValue(undefined);
      global.browser.alarms.create.mockResolvedValue(undefined);
      // Default delayBeforeClean is 15s, which also exercises the
      // sub-25s setTimeout fast path.
      jest.useFakeTimers();
      await AlarmEvents.createActiveModeAlarm();
      expect(sessionSet).toHaveBeenCalledWith({
        pendingCleanup: { due: expect.any(Number) },
      });
      expect(global.browser.alarms.create).toHaveBeenCalledWith(
        "activeModeAlarm",
        { when: expect.any(Number) }
      );
      expect(jest.getTimerCount()).toBe(1);
    });

    it("should not schedule when a pendingCleanup already exists", async () => {
      sessionGet.mockResolvedValue({ pendingCleanup: { due: 123 } });
      await AlarmEvents.createActiveModeAlarm();
      expect(sessionSet).not.toHaveBeenCalled();
      expect(global.browser.alarms.create).not.toHaveBeenCalled();
    });
  });

  describe("runPendingCleanup()", () => {
    it("should do nothing when no pendingCleanup record exists", async () => {
      sessionGet.mockResolvedValue({ pendingCleanup: null });
      const dispatchSpy = jest
        .spyOn(store, "dispatch")
        .mockImplementation((() => undefined) as any);
      await AlarmEvents.runPendingCleanup();
      expect(sessionRemove).not.toHaveBeenCalled();
      expect(dispatchSpy).not.toHaveBeenCalled();
      dispatchSpy.mockRestore();
    });

    it("should clear the record and alarm and dispatch the cleanup when ACTIVE_MODE is on", async () => {
      TestStore.changeSetting(SettingID.ACTIVE_MODE, true);
      sessionGet.mockResolvedValue({ pendingCleanup: { due: 1 } });
      sessionRemove.mockResolvedValue(undefined);
      global.browser.alarms.clear.mockResolvedValue(true);
      const dispatchSpy = jest
        .spyOn(store, "dispatch")
        .mockImplementation((() => undefined) as any);
      await AlarmEvents.runPendingCleanup();
      expect(sessionRemove).toHaveBeenCalledWith("pendingCleanup");
      expect(global.browser.alarms.clear).toHaveBeenCalledWith(
        "activeModeAlarm"
      );
      // cookieCleanup is a thunk; the dispatch itself is the observable.
      expect(dispatchSpy).toHaveBeenCalled();
      dispatchSpy.mockRestore();
    });

    it("should clear the record but not dispatch when ACTIVE_MODE is off", async () => {
      sessionGet.mockResolvedValue({ pendingCleanup: { due: 1 } });
      sessionRemove.mockResolvedValue(undefined);
      global.browser.alarms.clear.mockResolvedValue(true);
      const dispatchSpy = jest
        .spyOn(store, "dispatch")
        .mockImplementation((() => undefined) as any);
      await AlarmEvents.runPendingCleanup();
      expect(sessionRemove).toHaveBeenCalledWith("pendingCleanup");
      expect(dispatchSpy).not.toHaveBeenCalled();
      dispatchSpy.mockRestore();
    });
  });

  describe("recoverPendingCleanup()", () => {
    it("should do nothing without a pendingCleanup record", async () => {
      sessionGet.mockResolvedValue({ pendingCleanup: null });
      jest.useFakeTimers();
      await AlarmEvents.recoverPendingCleanup();
      expect(jest.getTimerCount()).toBe(0);
    });

    it("should run an overdue cleanup immediately", async () => {
      TestStore.changeSetting(SettingID.ACTIVE_MODE, true);
      sessionGet.mockResolvedValue({
        pendingCleanup: { due: Date.now() - 1000 },
      });
      sessionRemove.mockResolvedValue(undefined);
      global.browser.alarms.clear.mockResolvedValue(true);
      const dispatchSpy = jest
        .spyOn(store, "dispatch")
        .mockImplementation((() => undefined) as any);
      await AlarmEvents.recoverPendingCleanup();
      expect(sessionRemove).toHaveBeenCalledWith("pendingCleanup");
      expect(dispatchSpy).toHaveBeenCalled();
      dispatchSpy.mockRestore();
    });

    it("should re-arm a short timer for a soon-due cleanup", async () => {
      sessionGet.mockResolvedValue({
        pendingCleanup: { due: Date.now() + 5000 },
      });
      jest.useFakeTimers();
      await AlarmEvents.recoverPendingCleanup();
      expect(jest.getTimerCount()).toBe(1);
    });

    it("should rely on the persisted alarm for far-future cleanups", async () => {
      sessionGet.mockResolvedValue({
        pendingCleanup: { due: Date.now() + 60000 },
      });
      jest.useFakeTimers();
      await AlarmEvents.recoverPendingCleanup();
      expect(jest.getTimerCount()).toBe(0);
    });
  });
});
