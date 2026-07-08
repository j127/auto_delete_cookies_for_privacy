import { updateSetting } from "@/redux/actions";
import { initialState } from "@/redux/state";
// tslint:disable-next-line: import-name
import createStore, { type AppStore } from "@/redux/store";
import StoreUser from "@/services/store-user";
import { SettingID } from "@/typings/enums";

class FirstUser extends StoreUser {
  public static getStore(): AppStore {
    return StoreUser.store;
  }
}

class SecondUser extends StoreUser {
  public static getStore(): AppStore {
    return StoreUser.store;
  }
}

describe("StoreUser", () => {
  describe("init()", () => {
    it("should expose the given store to subclasses", () => {
      const store = createStore(initialState);
      StoreUser.init(store);
      expect(FirstUser.getStore()).toBe(store);
    });

    it("should share a single store across all subclasses", () => {
      const store = createStore(initialState);
      StoreUser.init(store);
      expect(FirstUser.getStore()).toBe(SecondUser.getStore());
    });

    it("should replace a previously initialized store on re-init", () => {
      const firstStore = createStore(initialState);
      const secondStore = createStore(initialState);
      StoreUser.init(firstStore);
      StoreUser.init(secondStore);
      expect(FirstUser.getStore()).toBe(secondStore);
      expect(FirstUser.getStore()).not.toBe(firstStore);
    });

    it("should hand out a live store usable for dispatch and getState", () => {
      const store = createStore(initialState);
      StoreUser.init(store);
      FirstUser.getStore().dispatch(
        updateSetting({ name: SettingID.ACTIVE_MODE, value: true })
      );
      expect(
        FirstUser.getStore().getState().settings[SettingID.ACTIVE_MODE].value
      ).toBe(true);
    });
  });
});
