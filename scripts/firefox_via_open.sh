#!/bin/sh

# Starts Firefox through LaunchServices for `just run_firefox` on macOS,
# passed to web-ext's --firefox option. macOS 27 protects each app's data
# folder from other apps, so a Firefox started as a child of another app's
# terminal is refused its own ~/Library/Application Support/Firefox/ and
# fails with "Your Firefox profile cannot be loaded" (#465). Launched by
# `open`, Firefox is responsible for itself. -W keeps web-ext attached until
# Firefox quits, and -n starts a new instance next to any running Firefox.
exec /usr/bin/open -W -n -a Firefox --args "$@"
