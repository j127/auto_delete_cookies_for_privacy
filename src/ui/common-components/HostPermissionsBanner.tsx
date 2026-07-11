/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2017-2022 Kenny Do and CAD Team; fork changes (c) 2026 j127.
 * Licensed under MIT (see LICENSE).
 */
import * as React from "react";
import PermissionService, {
  HOST_PERMISSIONS,
} from "@/services/permission-service";

/**
 * Warning banner for the revoked-host-permissions state (one-click
 * revocable in about:addons since Firefox 127; cookies.getAll then
 * silently filters, so cleanup would no-op while looking healthy). The
 * button calls permissions.request directly from the click handler — the
 * request API requires a user gesture. Renders nothing while permissions
 * are granted, which is the permanent state on Chrome.
 */
const HostPermissionsBanner: React.FunctionComponent = () => {
  const [granted, setGranted] = React.useState(true);

  React.useEffect(() => {
    let live = true;
    PermissionService.isGrantedForUI()
      .then((ok) => {
        if (live) setGranted(ok);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  if (granted) return null;

  return (
    <div
      className="m-2 alert alert-error"
      id="hostPermissionsBanner"
      role="alert"
    >
      <span className="min-w-0 flex-1">
        {browser.i18n.getMessage("hostPermissionsMissingText")}
      </span>
      <button
        className="btn btn-sm"
        onClick={async () => {
          const ok = await browser.permissions
            .request(HOST_PERMISSIONS)
            .catch(() => false);
          if (ok) {
            setGranted(true);
          }
        }}
        type="button"
      >
        {browser.i18n.getMessage("hostPermissionsGrantButtonText")}
      </button>
    </div>
  );
};

export default HostPermissionsBanner;
