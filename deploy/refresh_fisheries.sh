#!/usr/bin/env bash
# Runs on the server (from cron): pull the latest NOAA SST + VIIRS chlorophyll
# and re-derive the fishing zones, inside the running API container.
# Installed by deploy/install_cron.sh; log at ~/fisheries_refresh.log.
set -euo pipefail
cd "$(dirname "$0")/.."
echo "=== $(date -u +'%Y-%m-%d %H:%M UTC') refresh start"
docker compose -f docker-compose.prod.yml exec -T api python -m ingest.fisheries_fetch --days 14
echo "=== $(date -u +'%Y-%m-%d %H:%M UTC') refresh done"
