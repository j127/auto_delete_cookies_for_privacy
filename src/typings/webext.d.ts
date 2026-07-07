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
import type { Browser, Cookies, Menus, Tabs } from "webextension-polyfill";

declare global {
  const browser: Browser;

  namespace browser {
    namespace cookies {
      /**
       * The polyfill types are generated from Firefox schemas, where the
       * firstPartyDomain property is REQUIRED on every cookie. Chrome
       * cookies never carry it (the fork stripped all First-Party-Isolation
       * handling), so it is omitted from the type this codebase uses.
       */
      type Cookie = Omit<Cookies.Cookie, "firstPartyDomain">;
      type OnChangedCause = Cookies.OnChangedCause;
      type OptionalCookieProperties = Partial<Cookie>;
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
