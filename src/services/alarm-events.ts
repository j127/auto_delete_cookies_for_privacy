/**
 * Copyright (c) 2017-2022 Kenny Do and CAD Team (https://github.com/Cookie-AutoDelete/Cookie-AutoDelete/graphs/contributors)
 * Licensed under MIT (https://github.com/Cookie-AutoDelete/Cookie-AutoDelete/blob/3.X.X-Branch/LICENSE)
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { SettingID } from "@/typings/enums";
import { cookieCleanup } from "@/redux/actions";
import { getSetting } from "./libs";
import StoreUser from "./store-user";

/**
 * Delayed automatic cleanup, rebuilt for the MV3 service worker. The MV2
 * version just slept on a setTimeout, which dies with the worker; the user's
 * cleanup delay ranges from 1 second to ~24 days, so it must survive
 * suspension.
 *
 * Design (fail-safe: a cleanup can fire late, never early):
 * - The pending cleanup is persisted to storage.session as { due } - it must
 *   survive worker restarts within a browser session, and storage.session
 *   clears on browser exit exactly like the old in-memory state did.
 * - A real chrome.alarms alarm is the backstop. Chrome clamps alarms under
 *   30s up to ~30s, so for short delays a setTimeout provides the on-time
 *   path while the worker is alive (it almost always is: the tab event that
 *   scheduled the cleanup just reset the ~30s idle timer).
 * - recoverPendingCleanup() runs on every worker start and fires overdue or
 *   soon-due cleanups whose setTimeout was lost to a suspension.
 */
export default class AlarmEvents extends StoreUser {
  public static readonly ACTIVE_MODE_ALARM = "activeModeAlarm";

  // setTimeout is only trusted below this; longer waits rely on the alarm.
  private static readonly TIMEOUT_SAFE_MS = 25000;

  public static createActiveModeAlarm = async (): Promise<void> => {
    const seconds = parseInt(
      getSetting(StoreUser.store.getState(), SettingID.CLEAN_DELAY) as string,
      10
    );
    // Same floor semantics as the MV2 sleep(): garbage or zero => 500ms.
    const delayMs = (seconds > 0 ? seconds : 0.5) * 1000;
    const existing = await browser.storage.session?.get({
      pendingCleanup: null,
    });
    if (existing && existing.pendingCleanup) {
      // A cleanup is already scheduled; don't stack another one.
      return;
    }
    const due = Date.now() + delayMs;
    await browser.storage.session?.set({ pendingCleanup: { due } });
    await browser.alarms.create(AlarmEvents.ACTIVE_MODE_ALARM, { when: due });
    if (delayMs < AlarmEvents.TIMEOUT_SAFE_MS) {
      setTimeout(() => {
        AlarmEvents.runPendingCleanup();
      }, delayMs);
    }
  };

  public static runPendingCleanup = async (): Promise<void> => {
    // Synchronous latch: the setTimeout fast path and the alarm can race on
    // the same event loop right around the due time.
    if (AlarmEvents.running) return;
    AlarmEvents.running = true;
    try {
      if (browser.storage.session) {
        const data = await browser.storage.session.get({
          pendingCleanup: null,
        });
        if (!data || !data.pendingCleanup) {
          // The other path (timeout vs alarm) already ran this cleanup.
          return;
        }
        await browser.storage.session.remove("pendingCleanup");
      }
      await browser.alarms.clear(AlarmEvents.ACTIVE_MODE_ALARM);
      if (getSetting(StoreUser.store.getState(), SettingID.ACTIVE_MODE)) {
        StoreUser.store.dispatch<any>(
          cookieCleanup({
            greyCleanup: false,
            ignoreOpenTabs: false,
          })
        );
      }
    } finally {
      AlarmEvents.running = false;
    }
  };

  /** Called from background init() on every service worker start. */
  public static recoverPendingCleanup = async (): Promise<void> => {
    const data = await browser.storage.session?.get({ pendingCleanup: null });
    if (!data || !data.pendingCleanup) return;
    const remaining = (data.pendingCleanup as { due: number }).due - Date.now();
    if (remaining <= 0) {
      await AlarmEvents.runPendingCleanup();
    } else if (remaining < AlarmEvents.TIMEOUT_SAFE_MS) {
      setTimeout(() => {
        AlarmEvents.runPendingCleanup();
      }, remaining);
    }
    // else: the persisted alarm is still armed and survives suspension.
  };

  private static running = false;
}
