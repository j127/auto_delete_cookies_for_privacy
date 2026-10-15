#!/bin/sh

# Starts Firefox through LaunchServices for `just run_firefox` on macOS,
# passed to web-ext's --firefox option. macOS 27 protects each app's data
# folder from other apps, so a Firefox started as a child of another app's
# terminal is refused its own ~/Library/Application Support/Firefox/ and
# fails with "Your Firefox profile cannot be loaded" (#465). Launched by
# `open`, Firefox is responsible for itself. -W keeps web-ext attached until
# Firefox quits, and -n starts a new instance next to any running Firefox.
#
# `just e2e_firefox` and `just store_screenshots_firefox` point FIREFOX_BIN
# at this script on macOS for the same reason (geckodriver spawns Firefox as
# its own child; #465). geckodriver first runs the binary with --version and
# rejects anything whose output is not "Mozilla Firefox <version>", so that
# probe is answered here with the installed Firefox's real version.

# FIREFOX_VIA_OPEN_APP and FIREFOX_VIA_OPEN_OPEN exist for the unit spec.
APP_DIR=${FIREFOX_VIA_OPEN_APP:-/Applications/Firefox.app}
OPEN=${FIREFOX_VIA_OPEN_OPEN:-/usr/bin/open}

case "${1:-}" in
  -v | --version)
    # The binary's own output keeps a suffix such as "esr" and works even
    # from an app's terminal. Info.plist is the fallback.
    if version=$("$APP_DIR/Contents/MacOS/firefox" --version 2>/dev/null) &&
      [ -n "$version" ]; then
      echo "$version"
      exit 0
    fi
    if version=$(/usr/bin/defaults read "$APP_DIR/Contents/Info" CFBundleShortVersionString 2>/dev/null) &&
      [ -n "$version" ]; then
      echo "Mozilla Firefox $version"
      exit 0
    fi
    echo "firefox_via_open.sh: cannot read the version of $APP_DIR" >&2
    exit 1
    ;;
esac

# After a failed attempt, the first launch sometimes exits at once (and a
# retry works), so a Firefox that quit within 3 seconds gets one more try.
# A real session lasts longer than that.
started=$(date +%s)
"$OPEN" -W -n -a Firefox --args "$@"
status=$?
if [ $(($(date +%s) - started)) -lt 3 ]; then
  exec "$OPEN" -W -n -a Firefox --args "$@"
fi
exit "$status"
