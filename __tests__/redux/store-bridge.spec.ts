/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2017-2022 Kenny Do and CAD Team; fork changes (c) 2026 j127.
 * Licensed under MIT (see LICENSE).
 */
import {
  CONNECTION_NAME,
  DISPATCH,
  UPDATE_STATE,
  dispatchBridgeAction,
  handleBridgeConnection,
} from "@/redux/store-bridge";

describe("StoreBridge", () => {
  describe("protocol constants", () => {
    it("should keep the redux-webext wire protocol values", () => {
      // The UI half and any stored user expectations rely on these staying
      // exactly what the redux-webext library used.
      expect(CONNECTION_NAME).toBe("redux-webext");
      expect(DISPATCH).toBe("@@STORE_DISPATCH");
      expect(UPDATE_STATE).toBe("@@STORE_UPDATE_STATE");
    });
  });

  describe("dispatchBridgeAction()", () => {
    const makeStore = () =>
      ({
        dispatch: jest.fn(),
        getState: jest.fn(),
        subscribe: jest.fn(),
      }) as any;

    it("should call the creator with undefined when the action has no fields besides type", () => {
      const store = makeStore();
      const creator = jest.fn().mockReturnValue({ type: "MAPPED" });
      dispatchBridgeAction(store, { TEST: creator }, { type: "TEST" });
      expect(creator).toHaveBeenCalledWith(undefined);
      expect(store.dispatch).toHaveBeenCalledWith({ type: "MAPPED" });
    });

    it("should call the creator with the payload when present", () => {
      const store = makeStore();
      const creator = jest.fn().mockReturnValue({ type: "MAPPED" });
      dispatchBridgeAction(
        store,
        { TEST: creator },
        { type: "TEST", payload: { a: 1 } }
      );
      expect(creator).toHaveBeenCalledWith({ a: 1 });
    });

    it("should call the creator with an empty object when other fields exist but payload is absent", () => {
      // The redux-webext quirk: extra fields force `payload = {}` instead of
      // undefined. Load-bearing for cookieCleanupUI/updateSetting.
      const store = makeStore();
      const creator = jest.fn().mockReturnValue({ type: "MAPPED" });
      dispatchBridgeAction(store, { TEST: creator }, {
        type: "TEST",
        meta: true,
      } as any);
      expect(creator).toHaveBeenCalledWith({});
    });

    it("should log an error and not dispatch for unmapped action types", () => {
      const store = makeStore();
      const consoleError = jest
        .spyOn(console, "error")
        .mockImplementation(() => undefined);
      dispatchBridgeAction(store, {}, { type: "NOPE" });
      expect(store.dispatch).not.toHaveBeenCalled();
      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });
  });

  describe("handleBridgeConnection()", () => {
    const makePort = () => {
      const disconnectListeners: (() => void)[] = [];
      return {
        name: CONNECTION_NAME,
        postMessage: jest.fn(),
        onDisconnect: {
          addListener: (l: () => void) => disconnectListeners.push(l),
        },
        triggerDisconnect: () => disconnectListeners.forEach((l) => l()),
      };
    };

    const makeStore = (state: any) => {
      const subscribers: (() => void)[] = [];
      const unsubscribe = jest.fn();
      return {
        store: {
          getState: () => state,
          subscribe: (l: () => void) => {
            subscribers.push(l);
            return unsubscribe;
          },
          dispatch: jest.fn(),
        } as any,
        emitChange: () => subscribers.forEach((l) => l()),
        unsubscribe,
      };
    };

    it("should push the current state immediately on connect", () => {
      const { store } = makeStore({ v: 1 });
      const port = makePort();
      handleBridgeConnection(store, port as any);
      expect(port.postMessage).toHaveBeenCalledWith({
        type: UPDATE_STATE,
        data: { v: 1 },
      });
    });

    it("should push a snapshot on every store change", () => {
      const { store, emitChange } = makeStore({ v: 1 });
      const port = makePort();
      handleBridgeConnection(store, port as any);
      emitChange();
      expect(port.postMessage).toHaveBeenCalledTimes(2);
    });

    it("should unsubscribe when the port disconnects", () => {
      const { store, unsubscribe } = makeStore({ v: 1 });
      const port = makePort();
      handleBridgeConnection(store, port as any);
      port.triggerDisconnect();
      expect(unsubscribe).toHaveBeenCalled();
    });

    it("should survive postMessage throwing on a closing port", () => {
      const { store, emitChange } = makeStore({ v: 1 });
      const port = makePort();
      port.postMessage.mockImplementation(() => {
        throw new Error("Attempting to use a disconnected port object");
      });
      handleBridgeConnection(store, port as any);
      expect(() => emitChange()).not.toThrow();
    });
  });
});
