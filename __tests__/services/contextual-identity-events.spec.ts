/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2017-2022 Kenny Do and CAD Team; fork changes (c) 2026 j127.
 * Licensed under MIT (see LICENSE).
 */
import { initialState } from "@/redux/state";
import createStore from "@/redux/store";
import ContextualIdentityEvents from "@/services/contextual-identity-events";
import StoreUser from "@/services/store-user";

StoreUser.init(createStore(initialState));

describe("ContextualIdentityEvents on Chrome (default flavor)", () => {
  it("is unsupported and init is a complete no-op", async () => {
    expect(ContextualIdentityEvents.isSupported()).toBe(false);
    await ContextualIdentityEvents.init();
    expect(global.browser.contextualIdentities.query).not.toHaveBeenCalled();
    expect(global.browser.storage.session.get).not.toHaveBeenCalled();
    expect(ContextualIdentityEvents.getContainerCache()).toEqual({});
  });
});
