import { initialState } from "@/redux/state";
import { CONNECTION_NAME, DISPATCH, UPDATE_STATE } from "@/redux/store-bridge";
import { createUIStore } from "@/redux/ui-store-bridge";

type FakePort = {
  name: string;
  onMessage: { addListener: jest.Mock };
  onDisconnect: { addListener: jest.Mock };
  postMessage: jest.Mock;
  disconnect: jest.Mock;
  pushMessage: (msg: unknown) => void;
  triggerDisconnect: () => void;
};

const makePort = (name: string): FakePort => {
  const messageListeners: ((msg: unknown) => void)[] = [];
  const disconnectListeners: (() => void)[] = [];
  return {
    name,
    onMessage: {
      addListener: jest.fn((listener: (msg: unknown) => void) => {
        messageListeners.push(listener);
      }),
    },
    onDisconnect: {
      addListener: jest.fn((listener: () => void) => {
        disconnectListeners.push(listener);
      }),
    },
    postMessage: jest.fn(),
    disconnect: jest.fn(),
    pushMessage: (msg) => messageListeners.forEach((l) => l(msg)),
    triggerDisconnect: () => disconnectListeners.forEach((l) => l()),
  };
};

const stateA: State = { ...initialState, cookieDeletedCounterTotal: 1 };
const stateB: State = { ...initialState, cookieDeletedCounterTotal: 2 };

describe("createUIStore()", () => {
  let ports: FakePort[];

  beforeEach(() => {
    ports = [];
    global.browser.runtime.connect.mockImplementation(
      (connectInfo: { name: string }) => {
        const port = makePort(connectInfo.name);
        ports.push(port);
        return port;
      }
    );
    global.browser.runtime.sendMessage.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should open a port with the redux-webext name and request the state once", () => {
    createUIStore();
    expect(global.browser.runtime.connect).toHaveBeenCalledWith({
      name: CONNECTION_NAME,
    });
    expect(global.browser.runtime.sendMessage).toHaveBeenCalledWith({
      type: UPDATE_STATE,
    });
    expect(ports[0].onMessage.addListener).toHaveBeenCalledTimes(1);
    expect(ports[0].onDisconnect.addListener).toHaveBeenCalledTimes(1);
  });

  it("should resolve once the port pushes the first state snapshot", async () => {
    const promise = createUIStore();
    ports[0].pushMessage({ type: UPDATE_STATE, data: stateA });
    const store = await promise;
    expect(store.getState()).toBe(stateA);
  });

  it("should resolve from the one-shot response when the port stays silent", async () => {
    global.browser.runtime.sendMessage.mockResolvedValue(stateA);
    const store = await createUIStore();
    expect(store.getState()).toBe(stateA);
  });

  it("should ignore malformed and unrelated port messages", async () => {
    const promise = createUIStore();
    ports[0].pushMessage(null);
    ports[0].pushMessage({ type: "SOMETHING_ELSE", data: stateB });
    ports[0].pushMessage({ type: UPDATE_STATE, data: stateA });
    const store = await promise;
    expect(store.getState()).toBe(stateA);
  });

  it("should apply a late one-shot response as a regular update", async () => {
    global.browser.runtime.sendMessage.mockResolvedValue(stateB);
    const promise = createUIStore();
    ports[0].pushMessage({ type: UPDATE_STATE, data: stateA });
    const store = await promise;
    expect(store.getState()).toBe(stateB);
  });

  it("should notify subscribers and update state on later snapshots", async () => {
    const promise = createUIStore();
    ports[0].pushMessage({ type: UPDATE_STATE, data: stateA });
    const store = await promise;
    const listener = jest.fn();
    store.subscribe(listener);
    ports[0].pushMessage({ type: UPDATE_STATE, data: stateB });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getState()).toBe(stateB);
  });

  it("should stop notifying a listener after unsubscribe", async () => {
    const promise = createUIStore();
    ports[0].pushMessage({ type: UPDATE_STATE, data: stateA });
    const store = await promise;
    const listener = jest.fn();
    const unsubscribe = store.subscribe(listener);
    unsubscribe();
    ports[0].pushMessage({ type: UPDATE_STATE, data: stateB });
    expect(listener).not.toHaveBeenCalled();
    // State still tracks the latest snapshot.
    expect(store.getState()).toBe(stateB);
  });

  it("should send dispatched actions as one-shot DISPATCH messages", async () => {
    const promise = createUIStore();
    ports[0].pushMessage({ type: UPDATE_STATE, data: stateA });
    const store = await promise;
    store.dispatch({
      payload: { greyCleanup: false, ignoreOpenTabs: false },
      type: "COOKIE_CLEANUP",
    });
    expect(global.browser.runtime.sendMessage).toHaveBeenCalledWith({
      type: DISPATCH,
      action: {
        payload: { greyCleanup: false, ignoreOpenTabs: false },
        type: "COOKIE_CLEANUP",
      },
    });
  });

  it("should swallow sendMessage failures from the initial request and dispatch", async () => {
    global.browser.runtime.sendMessage.mockRejectedValue(
      new Error("Could not establish connection")
    );
    const promise = createUIStore();
    ports[0].pushMessage({ type: UPDATE_STATE, data: stateA });
    const store = await promise;
    expect(() => store.dispatch({ type: "RESET_ALL" })).not.toThrow();
    // Flush the rejected promises; an unhandled rejection would fail here.
    await Promise.resolve();
    await Promise.resolve();
    expect(store.getState()).toBe(stateA);
  });

  it("should reconnect after the delay when the port disconnects", async () => {
    const promise = createUIStore();
    ports[0].pushMessage({ type: UPDATE_STATE, data: stateA });
    const store = await promise;

    jest.useFakeTimers();
    ports[0].triggerDisconnect();
    expect(ports).toHaveLength(1);

    jest.advanceTimersByTime(249);
    expect(ports).toHaveLength(1);

    jest.advanceTimersByTime(1);
    expect(ports).toHaveLength(2);
    expect(ports[1].name).toBe(CONNECTION_NAME);
    expect(global.browser.runtime.connect).toHaveBeenCalledTimes(2);

    // The new port revives the push channel.
    ports[1].pushMessage({ type: UPDATE_STATE, data: stateB });
    expect(store.getState()).toBe(stateB);
  });
});
