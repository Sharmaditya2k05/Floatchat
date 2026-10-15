#!/usr/bin/env bash
# Run on your laptop: dump the local FloatChat database (ARGO + fisheries tables)
# into deploy/floatchat.dump, ready to copy to the server.
set -euo pipefail
cd "$(dirname "$0")"
docker exec floatchat-db pg_dump -U floatchat_admin -d floatchat -Fc --no-owner --no-acl > floatchat.dump
ls -lh floatchat.dump
echo "Now copy it up:  scp deploy/floatchat.dump ubuntu@<VM_PUBLIC_IP>:~/FloatChat/deploy/"
