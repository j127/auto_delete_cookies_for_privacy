/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2017-2022 Kenny Do and CAD Team; fork changes (c) 2026 j127.
 * Licensed under MIT (see LICENSE).
 */

/**
 * Host-permission revocation guard. Since Firefox 127, host_permissions
 * are granted at install but revocable in one click from about:addons —
 * and cookies.getAll then SILENTLY returns only cookies for granted
 * hosts, so the extension looks healthy while cleaning nothing.
 *
 * The guard is event-driven only (permissions.onAdded/onRemoved plus one
 * check per background start — no polling, no timers): the granted state
 * is persisted in storage.session for the popup/settings banners, and a
 * red "!" global badge marks the broken state. Chrome exposes the same
 * permissions API and simply never revokes install-time host permissions
 * this way, so the state stays granted and nothing changes there.
 */

export const HOST_PERMISSIONS = { origins: ["<all_urls>"] };
export const HOST_PERMISSIONS_SESSION_KEY = "hostPermissionsGranted";

export default class PermissionService {
  /**
   * Re-evaluates the granted state, persists it for the UI pages, and
   * paints/clears the warning badge. Runs on background start and from
   * the onAdded/onRemoved events.
   */
  public static async checkHostPermissions(): Promise<boolean> {
    let granted = true;
    try {
      granted = await browser.permissions.contains(HOST_PERMISSIONS);
    } catch {
      // A permissions API hiccup must not brick the badge painters;
      // assume granted (the next event re-evaluates).
      granted = true;
    }
    await Promise.resolve(
      browser.storage.session?.set({
        [HOST_PERMISSIONS_SESSION_KEY]: granted,
      })
    ).catch(() => undefined);
    try {
      if (granted) {
        // Clear only the global (tab-less) badge; per-tab counts repaint
        // through the normal painters.
        await browser.action.setBadgeText({ text: "" });
      } else {
        await browser.action.setBadgeBackgroundColor({ color: "red" });
        await browser.action.setBadgeText({ text: "!" });
      }
    } catch {
      // Badge paint is cosmetic; the session flag above is the signal.
    }
    return granted;
  }

  /** UI-page read of the persisted state; true when unknown. */
  public static async isGrantedForUI(): Promise<boolean> {
    if (!browser.storage.session) return true;
    const data = await browser.storage.session.get({
      [HOST_PERMISSIONS_SESSION_KEY]: true,
    });
    return data[HOST_PERMISSIONS_SESSION_KEY] !== false;
  }
}
