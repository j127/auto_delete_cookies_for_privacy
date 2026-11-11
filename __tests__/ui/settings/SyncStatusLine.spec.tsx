/**
 * @jest-environment jsdom
 */
/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2026 j127. Licensed under MIT (see LICENSE).
 */
import * as React from "react";
import { act, render, waitFor } from "@testing-library/react";
import { SYNC_STATUS_KEY } from "@/services/sync-snapshot";
import SyncStatusLine, {
  describeSyncStatus,
} from "@/ui/settings/components/SyncStatusLine";

describe("SyncStatusLine (#587)", () => {
  beforeEach(() => {
    global.browser.i18n.getMessage.mockImplementation(
      (key: string, subs?: string[]) =>
        subs && subs.length > 0 ? `${key}:${subs.join("|")}` : key
    );
    global.browser.storage.onChanged.addListener.mockClear();
    global.browser.storage.onChanged.removeListener.mockClear();
  });

  describe("describeSyncStatus()", () => {
    it("waits before the first sync", () => {
      expect(describeSyncStatus(undefined)).toEqual({
        text: "syncStatusWaitingText",
        warning: false,
      });
    });

    it("gives the last sync time", () => {
      const at = Date.UTC(2026, 10, 10, 12, 0);
      expect(describeSyncStatus({ state: "ok", at })).toEqual({
        text: `syncStatusOkText:${new Date(at).toLocaleString()}`,
        warning: false,
      });
    });

    it("warns with sizes when the list is too large", () => {
      expect(
        describeSyncStatus({
          state: "tooLarge",
          bytes: 150_000,
          quota: 102_400,
        })
      ).toEqual({
        text: "syncStatusTooLargeText:147 kB|100 kB",
        warning: true,
      });
    });

    it("warns about a newer version elsewhere", () => {
      expect(describeSyncStatus({ state: "newerVersion" })).toEqual({
        text: "syncStatusNewerText",
        warning: true,
      });
    });

    it("passes the browser's error along", () => {
      expect(describeSyncStatus({ state: "error", message: "nope" })).toEqual({
        text: "syncStatusErrorText:nope",
        warning: true,
      });
    });
  });

  it("shows the stored status and follows its changes", async () => {
    global.browser.storage.local.get.mockResolvedValue({
      [SYNC_STATUS_KEY]: { state: "newerVersion" },
    });
    const { container, unmount } = render(<SyncStatusLine />);
    const line = () => container.querySelector("#syncStatus") as HTMLElement;
    await waitFor(() => expect(line().textContent).toBe("syncStatusNewerText"));
    expect(line().className).toContain("text-warning");

    const listener =
      global.browser.storage.onChanged.addListener.mock.calls[0][0];
    act(() => {
      listener({ unrelated: { newValue: 1 } }, "local");
      listener(
        { [SYNC_STATUS_KEY]: { newValue: { state: "error", message: "x" } } },
        "sync"
      );
    });
    expect(line().textContent).toBe("syncStatusNewerText");
    act(() => {
      listener(
        { [SYNC_STATUS_KEY]: { newValue: { state: "error", message: "x" } } },
        "local"
      );
    });
    expect(line().textContent).toBe("syncStatusErrorText:x");

    unmount();
    expect(
      global.browser.storage.onChanged.removeListener
    ).toHaveBeenCalledWith(listener);
  });

  it("keeps the waiting line when the status can't be read", async () => {
    global.browser.storage.local.get.mockRejectedValue(new Error("gone"));
    const { container } = render(<SyncStatusLine />);
    await Promise.resolve();
    expect(
      (container.querySelector("#syncStatus") as HTMLElement).textContent
    ).toBe("syncStatusWaitingText");
  });

  it("ignores a read that finishes after it unmounted", async () => {
    let resolve: (value: unknown) => void = () => undefined;
    global.browser.storage.local.get.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      })
    );
    const { unmount } = render(<SyncStatusLine />);
    unmount();
    await act(async () => {
      resolve({ [SYNC_STATUS_KEY]: { state: "newerVersion" } });
    });
  });
});
