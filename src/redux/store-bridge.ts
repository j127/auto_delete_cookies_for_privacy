/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2017-2022 Kenny Do and CAD Team; fork changes (c) 2026 j127.
 * Licensed under MIT (see LICENSE).
 */

import { Store } from "redux";
import { ReduxAction } from "../typings/redux-constants";

/**
 * Background half of the store bridge that replaces the redux-webext library
 * (whose listener registration happened too late for a Manifest V3 service
 * worker). The wire protocol is kept identical to redux-webext so the UI
 * side stays a drop-in: the UI holds a long-lived port that receives full
 * state snapshots, and dispatches by sending one-shot runtime messages.
 *
 * The actual runtime.onMessage/onConnect listeners live in background.ts so
 * the service worker registers them synchronously at the top level; these
 * helpers only implement the protocol.
 */

export const CONNECTION_NAME = "redux-webext";
export const DISPATCH = "@@STORE_DISPATCH";
export const UPDATE_STATE = "@@STORE_UPDATE_STATE";

// Loose on purpose: the mapped creators have their own specific payload
// types; this map only cares that they are callables keyed by action type.
export type BackgroundActionsMap = {
  [key: string]: (payload?: any) => any;
};

/**
 * Handle a DISPATCH message from the UI: map the serialized action object to
 * the corresponding background action creator (usually a thunk) and dispatch
 * it. Quirk preserved from redux-webext, and load-bearing for actions like
 * cookieCleanupUI/updateSetting: when the incoming action carries no fields
 * besides `type`, the creator is called with `undefined`, otherwise with
 * `payload` (defaulting to `{}` when other fields exist but payload is
 * absent).
 */
export const dispatchBridgeAction = (
  store: Store<State, ReduxAction>,
  actions: BackgroundActionsMap,
  action: { type: string; payload?: unknown }
): void => {
  const { type, ...actionData } = action;
  const creator = actions[type];
  if (!creator) {
    // eslint-disable-next-line no-console
    console.error(
      `StoreBridge: no background action mapped for type "${type}".`
    );
    return;
  }
  const { payload = {} } = actionData as { payload?: unknown };
  store.dispatch<any>(
    creator(Object.keys(actionData).length ? payload : undefined) as any
  );
};

/**
 * Handle a new UI connection: push the current state immediately (redux-webext
 * made the UI fetch it in a separate message, a startup race we remove here),
 * then push a snapshot on every store change until the port disconnects.
 */
export const handleBridgeConnection = (
  store: Store<State, ReduxAction>,
  connection: browser.runtime.Port
): void => {
  const push = () => {
    try {
      connection.postMessage({ type: UPDATE_STATE, data: store.getState() });
    } catch {
      // Port closed mid-notify (popup closed / page navigated); the
      // onDisconnect handler below performs the unsubscribe.
    }
  };
  const unsubscribe = store.subscribe(push);
  connection.onDisconnect.addListener(() => {
    unsubscribe();
  });
  push();
};
