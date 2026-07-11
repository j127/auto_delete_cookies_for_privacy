/**
 * @jest-environment jsdom
 */

/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2017-2022 Kenny Do and CAD Team; fork changes (c) 2026 j127.
 * Licensed under MIT (see LICENSE).
 */
import * as React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { when } from "jest-when";
import { HOST_PERMISSIONS_SESSION_KEY } from "@/services/permission-service";
import HostPermissionsBanner from "@/ui/common-components/HostPermissionsBanner";

const sessionGranted = (granted: boolean) => {
  when(global.browser.storage.session.get)
    .calledWith({ [HOST_PERMISSIONS_SESSION_KEY]: true })
    .mockResolvedValue({
      [HOST_PERMISSIONS_SESSION_KEY]: granted,
    } as never);
};

describe("HostPermissionsBanner", () => {
  beforeEach(() => {
    global.browser.i18n.getMessage.mockImplementation((key: string) => key);
  });

  it("renders nothing while permissions are granted (the Chrome norm)", async () => {
    sessionGranted(true);
    const { container } = render(<HostPermissionsBanner />);
    // The state resolves asynchronously; the banner must never appear.
    await waitFor(() =>
      expect(global.browser.storage.session.get).toHaveBeenCalled()
    );
    expect(container.querySelector("#hostPermissionsBanner")).toBeNull();
  });

  it("shows the warning with a grant button when revoked", async () => {
    sessionGranted(false);
    const { getByText } = render(<HostPermissionsBanner />);
    await waitFor(() =>
      expect(getByText("hostPermissionsMissingText")).toBeTruthy()
    );
    expect(getByText("hostPermissionsGrantButtonText")).toBeTruthy();
  });

  it("requests permissions from the click handler and clears on success", async () => {
    sessionGranted(false);
    global.browser.permissions.request.mockResolvedValue(true as never);
    const { container, getByText } = render(<HostPermissionsBanner />);
    await waitFor(() =>
      expect(getByText("hostPermissionsGrantButtonText")).toBeTruthy()
    );
    fireEvent.click(getByText("hostPermissionsGrantButtonText"));
    expect(global.browser.permissions.request).toHaveBeenCalledWith({
      origins: ["<all_urls>"],
    });
    await waitFor(() =>
      expect(container.querySelector("#hostPermissionsBanner")).toBeNull()
    );
  });

  it("keeps warning when the request is declined", async () => {
    sessionGranted(false);
    global.browser.permissions.request.mockResolvedValue(false as never);
    const { container, getByText } = render(<HostPermissionsBanner />);
    await waitFor(() =>
      expect(getByText("hostPermissionsGrantButtonText")).toBeTruthy()
    );
    fireEvent.click(getByText("hostPermissionsGrantButtonText"));
    await waitFor(() =>
      expect(global.browser.permissions.request).toHaveBeenCalled()
    );
    expect(container.querySelector("#hostPermissionsBanner")).not.toBeNull();
  });
});
