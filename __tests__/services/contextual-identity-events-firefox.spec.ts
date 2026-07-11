/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2017-2022 Kenny Do and CAD Team; fork changes (c) 2026 j127.
 * Licensed under MIT (see LICENSE).
 */
import { when } from "jest-when";
import { SettingID } from "@/typings/enums";
import { ReduxConstants } from "@/typings/redux-constants";

vi.stubGlobal("__BROWSER__", "firefox");
vi.resetModules();
const { initialState } = await import("@/redux/state");
const { updateSetting } = await import("@/redux/actions");
const { default: createStore } = await import("@/redux/store");
const { default: StoreUser } = await import("@/services/store-user");
const { default: ContextualIdentityEvents } =
  await import("@/services/contextual-identity-events");

const store = createStore(initialState);
StoreUser.init(store);

const workContainer: browser.contextualIdentities.ContextualIdentity = {
  cookieStoreId: "firefox-container-7",
  color: "orange",
  colorCode: "#ff9f00",
  icon: "briefcase",
  iconUrl: "resource://usercontext-content/briefcase.svg",
  name: "Work",
};

const SESSION_KEY = ContextualIdentityEvents.SESSION_KEY;

describe("ContextualIdentityEvents on Firefox", () => {
  beforeEach(() => {
    store.dispatch({ type: ReduxConstants.RESET_SETTINGS });
    when(global.browser.storage.session.get)
      .calledWith({ [SESSION_KEY]: {} })
      .mockResolvedValue({ [SESSION_KEY]: {} } as never);
    global.browser.storage.session.set.mockResolvedValue(undefined as never);
    when(global.browser.contextualIdentities.query)
      .calledWith(expect.any(Object))
      .mockResolvedValue([workContainer] as never);
    global.browser.cookies.getAll.mockResolvedValue([] as never);
    global.browser.cookies.remove.mockResolvedValue({} as never);
  });

  it("is supported and builds the cache from the live query on init", async () => {
    await ContextualIdentityEvents.init();
    expect(ContextualIdentityEvents.isSupported()).toBe(true);
    expect(ContextualIdentityEvents.getContainerCache()).toEqual({
      "firefox-container-7": {
        name: "Work",
        color: "orange",
        colorCode: "#ff9f00",
        icon: "briefcase",
        iconUrl: "resource://usercontext-content/briefcase.svg",
      },
    });
    expect(global.browser.storage.session.set).toHaveBeenCalledWith({
      [SESSION_KEY]: ContextualIdentityEvents.getContainerCache(),
    });
  });

  it("keeps the session cache when the query rejects (containers disabled)", async () => {
    // Simulates the event-page-restart-while-pref-off case: the session
    // still knows the containers even though the live API refuses.
    when(global.browser.storage.session.get)
      .calledWith({ [SESSION_KEY]: {} })
      .mockResolvedValue({
        [SESSION_KEY]: {
          "firefox-container-2": { name: "Banking", color: "blue" },
        },
      } as never);
    when(global.browser.contextualIdentities.query)
      .calledWith(expect.any(Object))
      .mockRejectedValue(
        new Error("Contextual identities are currently disabled") as never
      );
    await expect(ContextualIdentityEvents.init()).resolves.toBeUndefined();
    expect(ContextualIdentityEvents.getContainerCache()).toEqual({
      "firefox-container-2": { name: "Banking", color: "blue" },
    });
  });

  it("tracks created and updated containers in the cache", async () => {
    await ContextualIdentityEvents.init();
    await ContextualIdentityEvents.onCreated({
      contextualIdentity: {
        ...workContainer,
        cookieStoreId: "firefox-container-8",
        name: "Shopping",
      },
    });
    expect(
      ContextualIdentityEvents.getContainerCache()["firefox-container-8"].name
    ).toBe("Shopping");
    await ContextualIdentityEvents.onUpdated({
      contextualIdentity: {
        ...workContainer,
        cookieStoreId: "firefox-container-8",
        name: "Errands",
      },
    });
    expect(
      ContextualIdentityEvents.getContainerCache()["firefox-container-8"].name
    ).toBe("Errands");
  });

  it("cleans the removed container's cookies and list with autoremove on (audit bug 6b)", async () => {
    store.dispatch(
      updateSetting({
        name: SettingID.CONTEXTUAL_IDENTITIES_AUTOREMOVE,
        value: true,
      })
    );
    store.dispatch({
      payload: {
        expression: "keep.example",
        listType: "WHITE",
        storeId: "firefox-container-7",
      },
      type: ReduxConstants.ADD_EXPRESSION,
    });
    const orphanCookie: browser.cookies.Cookie = {
      domain: "orphan.example",
      firstPartyDomain: "",
      hostOnly: true,
      httpOnly: false,
      name: "leftover",
      path: "/",
      sameSite: "no_restriction",
      secure: true,
      session: false,
      storeId: "firefox-container-7",
      value: "x",
    };
    when(global.browser.cookies.getAll)
      .calledWith({
        storeId: "firefox-container-7",
        firstPartyDomain: null,
        partitionKey: {},
      })
      .mockResolvedValue([orphanCookie] as never);

    await ContextualIdentityEvents.init();
    await ContextualIdentityEvents.onRemoved({
      contextualIdentity: workContainer,
    });

    // Cache entry gone, expression list gone, cookies cleaned.
    expect(
      ContextualIdentityEvents.getContainerCache()["firefox-container-7"]
    ).toBeUndefined();
    expect(store.getState().lists["firefox-container-7"]).toBeUndefined();
    expect(global.browser.cookies.remove).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "leftover",
        storeId: "firefox-container-7",
        firstPartyDomain: "",
      })
    );
  });

  it("leaves the removed container's cookies and list alone with autoremove off", async () => {
    store.dispatch({
      payload: {
        expression: "keep.example",
        listType: "WHITE",
        storeId: "firefox-container-7",
      },
      type: ReduxConstants.ADD_EXPRESSION,
    });
    await ContextualIdentityEvents.init();
    await ContextualIdentityEvents.onRemoved({
      contextualIdentity: workContainer,
    });
    expect(store.getState().lists["firefox-container-7"]).toBeDefined();
    expect(global.browser.cookies.remove).not.toHaveBeenCalled();
  });

  it("survives a cookie-cleaning failure on container removal", async () => {
    store.dispatch(
      updateSetting({
        name: SettingID.CONTEXTUAL_IDENTITIES_AUTOREMOVE,
        value: true,
      })
    );
    when(global.browser.cookies.getAll)
      .calledWith({
        storeId: "firefox-container-7",
        firstPartyDomain: null,
        partitionKey: {},
      })
      .mockRejectedValue(new Error("store gone") as never);
    await ContextualIdentityEvents.init();
    await expect(
      ContextualIdentityEvents.onRemoved({ contextualIdentity: workContainer })
    ).resolves.toBeUndefined();
  });
});
