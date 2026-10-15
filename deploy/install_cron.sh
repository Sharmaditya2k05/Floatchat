#!/usr/bin/env bash
# One-time, on the server: schedule the nightly fisheries refresh (03:30 UTC =
# 09:00 IST, after NOAA's overnight updates). Re-running replaces the entry.
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
chmod +x "$DIR/deploy/refresh_fisheries.sh"
{ crontab -l 2>/dev/null | grep -v refresh_fisheries.sh || true
  echo "30 3 * * * $DIR/deploy/refresh_fisheries.sh >> $HOME/fisheries_refresh.log 2>&1"
} | crontab -
echo "installed:"; crontab -l | grep refresh_fisheries.sh
