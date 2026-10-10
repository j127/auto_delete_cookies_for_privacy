/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */
import RecentCleanup from "@/services/recent-cleanup";

const sessionGet = global.browser.storage.session.get;
const sessionSet = global.browser.storage.session.set;

/** Runs one whole cleanup that removed cookies of the given domains. */
const runCleanup = (domains: string[], now = 1000) => {
  RecentCleanup.cleanupStarted();
  RecentCleanup.cleanupFinished(domains, now);
};

describe("RecentCleanup", () => {
  beforeEach(() => {
    RecentCleanup.reset();
    sessionSet.mockResolvedValue(undefined);
  });

  describe("cleanupFinished()", () => {
    it("marks a left site that the cleanup emptied as recently cleaned", () => {
      RecentCleanup.noteTabDomainLeft("ebay.com.au");
      runCleanup(["ebay.com.au"], 1000);
      expect(RecentCleanup.wasRecentlyCleaned("ebay.com.au", 1000)).toBe(true);
    });

    it("ignores cleaned domains no tab left (third parties)", () => {
      RecentCleanup.noteTabDomainLeft("ebay.com.au");
      runCleanup(["doubleclick.net"], 1000);
      expect(RecentCleanup.wasRecentlyCleaned("doubleclick.net", 1000)).toBe(
        false
      );
    });

    it("ignores a left site the cleanup did not empty", () => {
      RecentCleanup.noteTabDomainLeft("ebay.com.au");
      runCleanup([], 1000);
      expect(RecentCleanup.wasRecentlyCleaned("ebay.com.au", 1000)).toBe(false);
    });

    it("keeps a site only for WINDOW_MS", () => {
      RecentCleanup.noteTabDomainLeft("ebay.com.au");
      runCleanup(["ebay.com.au"], 1000);
      const end = 1000 + RecentCleanup.WINDOW_MS;
      expect(RecentCleanup.wasRecentlyCleaned("ebay.com.au", end - 1)).toBe(
        true
      );
      expect(RecentCleanup.wasRecentlyCleaned("ebay.com.au", end)).toBe(false);
    });

    it("does not extend the window when a later cleanup empties the site again", () => {
      RecentCleanup.noteTabDomainLeft("ebay.com.au");
      runCleanup(["ebay.com.au"], 1000);
      // The rescheduled cleanup: the site is no longer on the left list.
      runCleanup(["ebay.com.au"], 30000);
      const end = 1000 + RecentCleanup.WINDOW_MS;
      expect(RecentCleanup.wasRecentlyCleaned("ebay.com.au", end)).toBe(false);
    });

    it("starts a new window once a tab leaves the site again", () => {
      RecentCleanup.noteTabDomainLeft("ebay.com.au");
      runCleanup(["ebay.com.au"], 1000);
      RecentCleanup.noteTabDomainLeft("ebay.com.au");
      runCleanup(["ebay.com.au"], 50000);
      expect(
        RecentCleanup.wasRecentlyCleaned(
          "ebay.com.au",
          50000 + RecentCleanup.WINDOW_MS - 1
        )
      ).toBe(true);
    });

    it("persists both lists to storage.session", () => {
      RecentCleanup.noteTabDomainLeft("ebay.com.au");
      RecentCleanup.noteTabDomainLeft("other.com");
      expect(sessionSet).toHaveBeenLastCalledWith({
        recentCleanup: {
          leftTabDomains: ["ebay.com.au", "other.com"],
          recentlyCleaned: {},
        },
      });
      runCleanup(["ebay.com.au"], 1000);
      expect(sessionSet).toHaveBeenLastCalledWith({
        recentCleanup: {
          leftTabDomains: ["other.com"],
          recentlyCleaned: { "ebay.com.au": 1000 + RecentCleanup.WINDOW_MS },
        },
      });
    });

    it("drops expired sites when it persists", () => {
      RecentCleanup.noteTabDomainLeft("ebay.com.au");
      runCleanup(["ebay.com.au"], 1000);
      runCleanup([], 1000 + RecentCleanup.WINDOW_MS);
      expect(sessionSet).toHaveBeenLastCalledWith({
        recentCleanup: { leftTabDomains: [], recentlyCleaned: {} },
      });
    });
  });

  describe("noteTabDomainLeft()", () => {
    it("ignores an empty or missing domain", () => {
      RecentCleanup.noteTabDomainLeft("");
      RecentCleanup.noteTabDomainLeft(undefined);
      expect(sessionSet).not.toHaveBeenCalled();
    });

    it("does not write again for a domain it already noted", () => {
      RecentCleanup.noteTabDomainLeft("ebay.com.au");
      RecentCleanup.noteTabDomainLeft("ebay.com.au");
      expect(sessionSet).toHaveBeenCalledTimes(1);
    });

    it("survives a storage.session write that rejects", async () => {
      sessionSet.mockRejectedValue(new Error("quota"));
      expect(() =>
        RecentCleanup.noteTabDomainLeft("ebay.com.au")
      ).not.toThrow();
      await Promise.resolve();
    });
  });

  describe("settled()", () => {
    it("resolves at once when no cleanup runs", async () => {
      await expect(RecentCleanup.settled()).resolves.toBeUndefined();
    });

    it("waits for every running cleanup to finish", async () => {
      let done = false;
      RecentCleanup.cleanupStarted();
      RecentCleanup.cleanupStarted();
      const waiting = RecentCleanup.settled().then(() => {
        done = true;
      });
      RecentCleanup.cleanupFinished([]);
      await Promise.resolve();
      expect(done).toBe(false);
      RecentCleanup.cleanupFinished([]);
      await waiting;
      expect(done).toBe(true);
    });
  });

  describe("hydrateFromSession()", () => {
    it("restores both lists", async () => {
      sessionGet.mockResolvedValue({
        recentCleanup: {
          leftTabDomains: ["left.com"],
          recentlyCleaned: { "ebay.com.au": 5000 },
        },
      });
      await RecentCleanup.hydrateFromSession();
      expect(RecentCleanup.wasRecentlyCleaned("ebay.com.au", 4999)).toBe(true);
      runCleanup(["left.com"], 1000);
      expect(RecentCleanup.wasRecentlyCleaned("left.com", 1000)).toBe(true);
    });

    it("starts empty without a saved record", async () => {
      RecentCleanup.noteTabDomainLeft("left.com");
      sessionGet.mockResolvedValue({ recentCleanup: null });
      await RecentCleanup.hydrateFromSession();
      runCleanup(["left.com"], 1000);
      expect(RecentCleanup.wasRecentlyCleaned("left.com", 1000)).toBe(false);
    });

    it("does nothing without storage.session", async () => {
      const storage = global.browser.storage as { session?: unknown };
      const session = storage.session;
      delete storage.session;
      try {
        await RecentCleanup.hydrateFromSession();
        expect(sessionGet).not.toHaveBeenCalled();
      } finally {
        storage.session = session;
      }
    });
  });
});
