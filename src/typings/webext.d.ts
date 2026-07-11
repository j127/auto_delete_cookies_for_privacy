/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2017-2022 Kenny Do and CAD Team; fork changes (c) 2026 j127.
 * Licensed under MIT (see LICENSE).
 */

/**
 * Bridges webextension-polyfill's module-scoped types onto the ambient
 * `browser` global that src/init-globals.ts creates at runtime (and that
 * __tests__/setup.js stubs for jest).
 *
 * The polyfill's Browser interface types every VALUE access
 * (browser.cookies.getAll, browser.action.setIcon, ...). The namespace
 * declarations below only re-expose the handful of names this codebase uses
 * in TYPE positions (browser.tabs.Tab, browser.cookies.Cookie, ...), plus
 * the few things the Firefox-schema-generated types don't know about.
 */
import type {
  Browser,
  BrowsingData,
  ContextualIdentities,
  Cookies,
  Menus,
  Tabs,
} from "webextension-polyfill";

/**
 * Every function in the tree keeps its ORIGINAL polyfill signature (an
 * intersection, not a mock wrapper, so overloads and callback-parameter
 * inference in src stay intact) and additionally carries vi's MockInstance
 * methods (.mockImplementation, .mock.calls, ...), which is what
 * __tests__/setup.js's jest.fn() tree really provides at test time.
 * MockInstance rather than Mock on purpose: Mock adds its own loose call
 * signature to the intersection, which degrades contextual typing.
 */
type MockAugmented<T> = T extends (...args: any[]) => any
  ? T & import("vitest").MockInstance
  : T extends object
    ? { [K in keyof T]: MockAugmented<T[K]> }
    : T;

declare global {
  /**
   * `var`, not `const`: only var declarations become properties of
   * `typeof globalThis`, and the specs reach this object as `global.browser`
   * (modern @types/node has no augmentable NodeJS.Global interface anymore).
   */
  var browser: MockAugmented<Browser>;

  namespace browser {
    namespace browsingData {
      /**
       * The polyfill's Firefox-schema RemovalOptions carries the
       * Firefox-only `hostnames` and `cookieStoreId` keys but not Chrome's
       * `origins` (absent from the Firefox schema — Firefox rejects it at
       * runtime, too). Cross-browser code needs to express both scoping
       * shapes, so the Chrome key is intersected in here.
       */
      type RemovalOptions = BrowsingData.RemovalOptions & {
        origins?: string[];
      };
    }

    namespace contextualIdentities {
      type ContextualIdentity = ContextualIdentities.ContextualIdentity;
    }

    namespace cookies {
      /**
       * The polyfill types are generated from Firefox schemas, where the
       * firstPartyDomain property is REQUIRED on every cookie. Chrome
       * cookies never carry it while Firefox always does, so cross-browser
       * code treats it as optional. (The fork originally Omit-ed it away
       * entirely; the Firefox port restored it as optional.)
       */
      type Cookie = Omit<Cookies.Cookie, "firstPartyDomain"> & {
        firstPartyDomain?: string;
      };
      type OnChangedCause = Cookies.OnChangedCause;
      type OptionalCookieProperties = Partial<Cookie>;
      /** Partition attribute for TCP/dFPI (Firefox) and CHIPS (Chrome). */
      type PartitionKey = Cookies.PartitionKey;
    }

    namespace contextMenus {
      type OnClickData = Menus.OnClickData;
    }

    namespace runtime {
      type Port = import("webextension-polyfill").Runtime.Port;
    }

    namespace storage {
      type StorageArea = import("webextension-polyfill").Storage.StorageArea;
    }

    namespace tabs {
      type Tab = Tabs.Tab;
      type MutedInfo = Tabs.MutedInfo;
      /**
       * Not a browser type: cookie-events feeds cookie changes through
       * TabEvents.onTabUpdate using this extra field, so the change-info
       * shape is declared here with that extension.
       */
      interface TabChangeInfo {
        attention?: boolean;
        audible?: boolean;
        cookieChanged?: {
          removed: boolean;
          cookie: cookies.Cookie;
          cause: Cookies.OnChangedCause;
        };
        discarded?: boolean;
        favIconUrl?: string;
        hidden?: boolean;
        isArticle?: boolean;
        mutedInfo?: Tabs.MutedInfo;
        pinned?: boolean;
        status?: string;
        title?: string;
        url?: string;
      }
    }
  }
}
