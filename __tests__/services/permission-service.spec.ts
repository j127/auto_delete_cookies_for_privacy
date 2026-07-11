/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2017-2022 Kenny Do and CAD Team; fork changes (c) 2026 j127.
 * Licensed under MIT (see LICENSE).
 */
import { when } from "jest-when";
import PermissionService, {
  HOST_PERMISSIONS,
  HOST_PERMISSIONS_SESSION_KEY,
} from "@/services/permission-service";

describe("PermissionService.checkHostPermissions()", () => {
  beforeEach(() => {
    global.browser.storage.session.set.mockResolvedValue(undefined as never);
    global.browser.action.setBadgeText.mockResolvedValue(undefined as never);
    global.browser.action.setBadgeBackgroundColor.mockResolvedValue(
      undefined as never
    );
  });

  it("records the granted state and clears the global badge", async () => {
    when(global.browser.permissions.contains)
      .calledWith(HOST_PERMISSIONS)
      .mockResolvedValue(true as never);
    await expect(PermissionService.checkHostPermissions()).resolves.toBe(true);
    expect(global.browser.storage.session.set).toHaveBeenCalledWith({
      [HOST_PERMISSIONS_SESSION_KEY]: true,
    });
    expect(global.browser.action.setBadgeText).toHaveBeenCalledWith({
      text: "",
    });
  });

  it("flips to the warning state when host permissions are revoked", async () => {
    // The permissions.onRemoved handler is exactly this re-check.
    when(global.browser.permissions.contains)
      .calledWith(HOST_PERMISSIONS)
      .mockResolvedValue(false as never);
    await expect(PermissionService.checkHostPermissions()).resolves.toBe(false);
    expect(global.browser.storage.session.set).toHaveBeenCalledWith({
      [HOST_PERMISSIONS_SESSION_KEY]: false,
    });
    expect(global.browser.action.setBadgeBackgroundColor).toHaveBeenCalledWith({
      color: "red",
    });
    expect(global.browser.action.setBadgeText).toHaveBeenCalledWith({
      text: "!",
    });
  });

  it("clears the warning again when permissions come back", async () => {
    // The permissions.onAdded handler is the same re-check.
    when(global.browser.permissions.contains)
      .calledWith(HOST_PERMISSIONS)
      .mockResolvedValue(false as never);
    await PermissionService.checkHostPermissions();
    when(global.browser.permissions.contains)
      .calledWith(HOST_PERMISSIONS)
      .mockResolvedValue(true as never);
    await expect(PermissionService.checkHostPermissions()).resolves.toBe(true);
    expect(global.browser.storage.session.set).toHaveBeenLastCalledWith({
      [HOST_PERMISSIONS_SESSION_KEY]: true,
    });
    expect(global.browser.action.setBadgeText).toHaveBeenLastCalledWith({
      text: "",
    });
  });

  it("assumes granted when the permissions API itself fails", async () => {
    when(global.browser.permissions.contains)
      .calledWith(HOST_PERMISSIONS)
      .mockRejectedValue(new Error("api unavailable") as never);
    await expect(PermissionService.checkHostPermissions()).resolves.toBe(true);
  });
});

describe("PermissionService.isGrantedForUI()", () => {
  it("reads the persisted flag", async () => {
    when(global.browser.storage.session.get)
      .calledWith({ [HOST_PERMISSIONS_SESSION_KEY]: true })
      .mockResolvedValue({ [HOST_PERMISSIONS_SESSION_KEY]: false } as never);
    await expect(PermissionService.isGrantedForUI()).resolves.toBe(false);
  });

  it("treats unknown as granted", async () => {
    when(global.browser.storage.session.get)
      .calledWith({ [HOST_PERMISSIONS_SESSION_KEY]: true })
      .mockResolvedValue({ [HOST_PERMISSIONS_SESSION_KEY]: true } as never);
    await expect(PermissionService.isGrantedForUI()).resolves.toBe(true);
  });
});
