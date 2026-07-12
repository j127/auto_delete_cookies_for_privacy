/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2017-2022 Kenny Do and CAD Team; fork changes (c) 2026 j127.
 * Licensed under MIT (see LICENSE).
 */

/**
 * Firefox container (contextualIdentities) service. Maintains a
 * cookieStoreId → identity cache (name/color/icon) for the UI, kept fresh
 * by the onCreated/onRemoved/onUpdated events (registered synchronously at
 * top level in src/background.ts — event-page requirement) and persisted
 * in storage.session so an event-page restart does not lose it.
 *
 * On container removal with the autoremove setting on, the removed
 * container's expression list is dropped AND its cookie store is cleaned —
 * upstream only dropped the list, so a deleted container's cookies lived
 * on unreachable forever (audit bug 6b).
 *
 * The whole service is inert on the Chrome build (capability-gated), and
 * every contextualIdentities call degrades gracefully when the user has
 * disabled privacy.userContext.enabled (the API then rejects).
 */

import { SettingID } from "@/typings/enums";
import { ReduxConstants } from "@/typings/redux-constants";
import { browserCapabilities } from "./browser-capabilities";
import {
  adcpLog,
  getSetting,
  prepareCookieDomain,
  withAllPartitions,
  withAnyFirstPartyDomain,
} from "./libs";
import StoreUser from "./store-user";

export interface ContainerInfo {
  name: string;
  color: string;
  colorCode?: string;
  icon?: string;
  iconUrl?: string;
}

export default class ContextualIdentityEvents extends StoreUser {
  public static readonly SESSION_KEY = "containerCache";

  /** Whether containers exist on this build at all. */
  public static isSupported(): boolean {
    return browserCapabilities.supportsContextualIdentities;
  }

  /** Read-only view of the container cache for UI consumers. */
  public static getContainerCache(): Readonly<Record<string, ContainerInfo>> {
    return ContextualIdentityEvents.cache;
  }

  /**
   * Runs on every background start: rehydrates the cache from
   * storage.session first (so a mid-session event-page restart keeps the
   * names even if the live query below rejects), then refreshes from the
   * live API.
   */
  public static async init(): Promise<void> {
    if (!ContextualIdentityEvents.isSupported()) return;
    await ContextualIdentityEvents.hydrateFromSession();
    try {
      const identities = await browser.contextualIdentities.query({});
      ContextualIdentityEvents.cache = {};
      for (const identity of identities) {
        ContextualIdentityEvents.cache[identity.cookieStoreId] =
          ContextualIdentityEvents.toContainerInfo(identity);
      }
      await ContextualIdentityEvents.persistCache();
    } catch (e: unknown) {
      // privacy.userContext.enabled is off: keep whatever the session
      // cache had; the rest of the extension continues without containers.
      adcpLog(
        {
          msg: "ContextualIdentityEvents.init: contextualIdentities.query rejected (containers disabled?). Keeping the session cache.",
          x: e instanceof Error ? e.message : e,
        },
        ContextualIdentityEvents.debug()
      );
    }
  }

  public static async onCreated(changeInfo: {
    contextualIdentity: browser.contextualIdentities.ContextualIdentity;
  }): Promise<void> {
    const identity = changeInfo.contextualIdentity;
    ContextualIdentityEvents.cache[identity.cookieStoreId] =
      ContextualIdentityEvents.toContainerInfo(identity);
    await ContextualIdentityEvents.persistCache();
  }

  public static async onUpdated(changeInfo: {
    contextualIdentity: browser.contextualIdentities.ContextualIdentity;
  }): Promise<void> {
    await ContextualIdentityEvents.onCreated(changeInfo);
  }

  public static async onRemoved(changeInfo: {
    contextualIdentity: browser.contextualIdentities.ContextualIdentity;
  }): Promise<void> {
    const { cookieStoreId } = changeInfo.contextualIdentity;
    delete ContextualIdentityEvents.cache[cookieStoreId];
    await ContextualIdentityEvents.persistCache();

    if (
      getSetting(
        StoreUser.store.getState(),
        SettingID.CONTEXTUAL_IDENTITIES_AUTOREMOVE
      ) !== true
    ) {
      return;
    }
    // Drop the removed container's expression list...
    StoreUser.store.dispatch({
      payload: cookieStoreId,
      type: ReduxConstants.REMOVE_LIST,
    });
    // ...and clean its cookie store. Upstream skipped this, so the
    // deleted container's cookies leaked forever (audit bug 6b). The
    // store id remains queryable after the container is gone.
    await ContextualIdentityEvents.cleanRemovedContainerCookies(cookieStoreId);
  }

  protected static async cleanRemovedContainerCookies(
    cookieStoreId: string
  ): Promise<void> {
    const debug = ContextualIdentityEvents.debug();
    try {
      const cookies = await browser.cookies.getAll(
        withAllPartitions(
          withAnyFirstPartyDomain({
            storeId: cookieStoreId,
          })
        )
      );
      await Promise.allSettled(
        cookies.map((cookie) =>
          browser.cookies.remove({
            name: cookie.name,
            storeId: cookie.storeId,
            url: prepareCookieDomain(cookie),
            ...(cookie.firstPartyDomain !== undefined && {
              firstPartyDomain: cookie.firstPartyDomain,
            }),
            ...(cookie.partitionKey !== undefined && {
              partitionKey: cookie.partitionKey,
            }),
          })
        )
      );
      adcpLog(
        {
          msg: `ContextualIdentityEvents.onRemoved: cleaned ${cookies.length} cookie(s) from removed container ${cookieStoreId}.`,
        },
        debug
      );
    } catch (e: unknown) {
      adcpLog(
        {
          msg: `ContextualIdentityEvents.onRemoved: cleaning cookies of removed container ${cookieStoreId} failed.`,
          type: "error",
          x: e instanceof Error ? e.message : e,
        },
        debug
      );
    }
  }

  protected static async hydrateFromSession(): Promise<void> {
    if (!browser.storage.session) return;
    const data = await browser.storage.session.get({
      [ContextualIdentityEvents.SESSION_KEY]: {},
    });
    ContextualIdentityEvents.cache =
      (data[ContextualIdentityEvents.SESSION_KEY] as Record<
        string,
        ContainerInfo
      >) || {};
  }

  protected static persistCache(): Promise<void> {
    // Promise.resolve guards both a missing storage.session and
    // non-promise returns from test mocks.
    return Promise.resolve(
      browser.storage.session?.set({
        [ContextualIdentityEvents.SESSION_KEY]: ContextualIdentityEvents.cache,
      })
    ).catch(() => undefined);
  }

  protected static toContainerInfo(
    identity: browser.contextualIdentities.ContextualIdentity
  ): ContainerInfo {
    return {
      name: identity.name,
      color: identity.color,
      colorCode: identity.colorCode,
      icon: identity.icon,
      iconUrl: identity.iconUrl,
    };
  }

  protected static debug(): boolean {
    return getSetting(
      StoreUser.store.getState(),
      SettingID.DEBUG_MODE
    ) as boolean;
  }

  protected static cache: Record<string, ContainerInfo> = {};
}
