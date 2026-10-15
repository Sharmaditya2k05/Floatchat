#!/usr/bin/env bash
# Run on the server after `docker compose -f docker-compose.prod.yml up -d`:
# restores deploy/floatchat.dump into the running floatchat-db container.
set -euo pipefail
cd "$(dirname "$0")/.."
DUMP=deploy/floatchat.dump
[ -f "$DUMP" ] || { echo "missing $DUMP — run deploy/dump_db.sh locally and scp it here"; exit 1; }

echo "waiting for database..."
until docker exec floatchat-db pg_isready -U floatchat_admin -d floatchat >/dev/null 2>&1; do sleep 2; done

docker cp "$DUMP" floatchat-db:/tmp/floatchat.dump
# --clean drops the empty tables created by schema.sql; existing rows are replaced.
docker exec floatchat-db pg_restore -U floatchat_admin -d floatchat --clean --if-exists --no-owner --no-acl /tmp/floatchat.dump || true
docker exec floatchat-db rm /tmp/floatchat.dump
# The read-only role must be able to SELECT from the restored tables.
docker exec floatchat-db psql -U floatchat_admin -d floatchat -c "GRANT SELECT ON ALL TABLES IN SCHEMA public TO floatchat_ro;"
docker exec floatchat-db psql -U floatchat_admin -d floatchat -c \
  "SELECT (SELECT COUNT(*) FROM profiles) AS profiles, (SELECT COUNT(*) FROM pfz_advisories) AS pfz, (SELECT COUNT(*) FROM sst_composites) AS sst;"
echo "restore complete"
