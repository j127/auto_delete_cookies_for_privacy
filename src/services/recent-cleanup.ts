/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */

/**
 * Remembers which sites the latest cleanups emptied, so a cookie that a
 * site sets right after its cleanup can schedule another one.
 *
 * Closing a tab can leave requests in flight (keepalive fetches, beacons,
 * the end of a navigation). With a short cleanup delay the cleanup runs
 * before their responses arrive, and the cookies those responses set
 * stayed until the site's next visit: on ebay.com.au with a 1 second delay,
 * five cookies came back within ~5 s of a cleanup that removed all 29.
 *
 * Only sites the user actually left count. A site's main domain is noted
 * when a tab showing it closes or navigates to another site, and a cleanup
 * that removes cookies of a noted site marks it recently cleaned for
 * WINDOW_MS. A third-party domain is never shown in a tab, so a tracker
 * frame in a page that stays open (which re-sets its cookie right after
 * every cleanup) cannot keep scheduling cleanups. A cleanup takes the
 * sites it marks off the noted list, so a re-run cleanup does not extend
 * their window.
 *
 * Both lists live in storage.session as well as in memory: the noted list
 * must survive worker suspension for the whole cleanup delay (up to ~24
 * days), and storage.session clears on browser exit like the tab->domain
 * cache in TabEvents, which already holds the same domains.
 */
export default class RecentCleanup {
  /** How long a cleaned site stays recently cleaned. */
  public static readonly WINDOW_MS = 60000;

  /** storage.session key for both lists. */
  public static readonly SESSION_KEY = "recentCleanup";

  /** Restore both lists on service worker start. */
  public static hydrateFromSession = async (): Promise<void> => {
    if (!browser.storage.session) return;
    const data = await browser.storage.session.get({
      [RecentCleanup.SESSION_KEY]: null,
    });
    const saved = data?.[RecentCleanup.SESSION_KEY] as {
      leftTabDomains?: string[];
      recentlyCleaned?: Record<string, number>;
    } | null;
    RecentCleanup.leftTabDomains = new Set(saved?.leftTabDomains ?? []);
    RecentCleanup.recentlyCleaned = new Map(
      Object.entries(saved?.recentlyCleaned ?? {})
    );
  };

  /** A tab that showed mainDomain closed or moved on to another site. */
  public static noteTabDomainLeft(mainDomain: string | undefined): void {
    if (!mainDomain || RecentCleanup.leftTabDomains.has(mainDomain)) return;
    RecentCleanup.leftTabDomains.add(mainDomain);
    RecentCleanup.persist();
  }

  /** Called when a cleanup starts; pair with cleanupFinished. */
  public static cleanupStarted(): void {
    if (RecentCleanup.running === 0) {
      RecentCleanup.settledPromise = new Promise((resolve) => {
        RecentCleanup.resolveSettled = resolve;
      });
    }
    RecentCleanup.running += 1;
  }

  /**
   * Called when a cleanup ends, with the main domains it removed cookies
   * from (the marker cookie included).
   */
  public static cleanupFinished(
    cleanedMainDomains: Iterable<string>,
    now = Date.now()
  ): void {
    const until = now + RecentCleanup.WINDOW_MS;
    for (const domain of cleanedMainDomains) {
      if (!RecentCleanup.leftTabDomains.delete(domain)) continue;
      RecentCleanup.recentlyCleaned.set(domain, until);
    }
    RecentCleanup.prune(now);
    RecentCleanup.persist();
    RecentCleanup.running = Math.max(0, RecentCleanup.running - 1);
    if (RecentCleanup.running === 0) {
      RecentCleanup.resolveSettled();
    }
  }

  /**
   * Resolves once no cleanup is running. A cookie set while a cleanup runs
   * may arrive after that cleanup read the cookie list, so whether its site
   * was cleaned is only known once the cleanup finishes.
   */
  public static settled(): Promise<void> {
    return RecentCleanup.running === 0
      ? Promise.resolve()
      : RecentCleanup.settledPromise;
  }

  /** Whether a cleanup in the last WINDOW_MS emptied this left site. */
  public static wasRecentlyCleaned(
    mainDomain: string,
    now = Date.now()
  ): boolean {
    const until = RecentCleanup.recentlyCleaned.get(mainDomain);
    return until !== undefined && until > now;
  }

  /** Forget everything; for tests. */
  public static reset(): void {
    RecentCleanup.leftTabDomains = new Set();
    RecentCleanup.recentlyCleaned = new Map();
    RecentCleanup.running = 0;
    RecentCleanup.resolveSettled();
  }

  protected static prune(now: number): void {
    for (const [domain, until] of RecentCleanup.recentlyCleaned) {
      if (until <= now) RecentCleanup.recentlyCleaned.delete(domain);
    }
  }

  /** Write-through persistence, like TabEvents.persistTabToDomain. */
  protected static persist(): void {
    Promise.resolve(
      browser.storage.session?.set({
        [RecentCleanup.SESSION_KEY]: {
          leftTabDomains: Array.from(RecentCleanup.leftTabDomains),
          recentlyCleaned: Object.fromEntries(RecentCleanup.recentlyCleaned),
        },
      })
    ).catch(() => undefined);
  }

  // Main domains of sites a tab left since a cleanup last emptied them.
  protected static leftTabDomains: Set<string> = new Set();

  // Main domain -> time its recently-cleaned window ends.
  protected static recentlyCleaned: Map<string, number> = new Map();

  // Cleanups in progress. In-memory is fine: a cleanup never outlives the
  // worker that runs it.
  protected static running = 0;

  protected static settledPromise: Promise<void> = Promise.resolve();

  protected static resolveSettled: () => void = () => undefined;
}
