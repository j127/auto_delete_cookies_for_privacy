/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2017-2022 Kenny Do and CAD Team; fork changes (c) 2026 j127.
 * Licensed under MIT (see LICENSE).
 */

import { CONNECTION_NAME, DISPATCH, UPDATE_STATE } from "./store-bridge";

/**
 * UI half of the store bridge (popup and settings pages). Drop-in for
 * redux-webext's createUIStore: resolves to a Redux-store-shaped object once
 * the first state snapshot arrives.
 *
 * Unlike redux-webext, the port RECONNECTS after a disconnect. In Manifest
 * V3 the background service worker idles out after ~30s without events; when
 * it dies, every port closes and a long-lived settings tab would otherwise
 * freeze on stale state forever. Reconnecting both revives the push channel
 * and wakes the service worker.
 */

type UIStore = {
  subscribe: (listener: () => void) => () => void;
  dispatch: (action: { type: string; payload?: unknown }) => void;
  getState: () => State;
};

const RECONNECT_DELAY_MS = 250;

export function createUIStore(): Promise<UIStore> {
  let state: State | undefined;
  let listeners: (() => void)[] = [];

  const notify = () => listeners.forEach((l) => l());

  return new Promise((resolve) => {
    let resolved = false;

    const onState = (data: State) => {
      state = data;
      if (!resolved) {
        resolved = true;
        resolve({
          subscribe(listener: () => void) {
            listeners.push(listener);
            return () => {
              listeners = listeners.filter((l) => l !== listener);
            };
          },
          dispatch(action) {
            // The response (if any) is irrelevant; sending the message also
            // wakes the service worker if it was suspended.
            Promise.resolve(
              browser.runtime.sendMessage({ type: DISPATCH, action })
            ).catch(() => undefined);
          },
          getState() {
            return state as State;
          },
        });
      } else {
        notify();
      }
    };

    const connect = () => {
      const port = browser.runtime.connect({ name: CONNECTION_NAME });
      port.onMessage.addListener((msg: any) => {
        if (msg && msg.type === UPDATE_STATE) onState(msg.data as State);
      });
      port.onDisconnect.addListener(() => {
        // Either the page is going away (timer dies with it, harmless) or
        // the service worker idled out and must be reconnected to.
        setTimeout(connect, RECONNECT_DELAY_MS);
      });
    };

    // Belt and suspenders: the connection push should arrive first, but a
    // one-shot request also covers any port/message ordering surprises.
    Promise.resolve(browser.runtime.sendMessage({ type: UPDATE_STATE }))
      .then((res) => {
        if (res) onState(res as State);
      })
      .catch(() => undefined);

    connect();
  });
}
