#!/bin/sh
# Applies apps/api/migrations/*.sql in order, once each, then (re)creates the non-owner runtime role.
# Runs as the database administrator. Every migration file is its own BEGIN/COMMIT transaction.
# Connection comes from the standard PG* environment variables; DB_APP_PASSWORD sets the runtime role's password.
set -eu
: "${DB_APP_PASSWORD:?DB_APP_PASSWORD is required}"

psql -v ON_ERROR_STOP=1 -q -c "CREATE TABLE IF NOT EXISTS schema_migrations (
  filename text PRIMARY KEY, sha256 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())"

for f in $(ls /migrations/*.sql | sort); do
  name=$(basename "$f")
  sum=$(sha256sum "$f" | cut -d' ' -f1)
  # psql variables are only interpolated for stdin / -f input, not for -c, so these statements go through stdin.
  applied=$(printf '%s\n' "SELECT sha256 FROM schema_migrations WHERE filename = :'n'" | psql -At -v ON_ERROR_STOP=1 -v n="$name")
  if [ -n "$applied" ]; then
    if [ "$applied" != "$sum" ]; then
      echo "ERROR: $name was modified after it was applied. Migrations are immutable; add a new one." >&2
      exit 1
    fi
    continue
  fi
  echo "applying $name"
  psql -v ON_ERROR_STOP=1 -q -f "$f"
  printf '%s\n' "INSERT INTO schema_migrations (filename, sha256) VALUES (:'n', :'s')" | psql -v ON_ERROR_STOP=1 -q -v n="$name" -v s="$sum"
done

echo "configuring runtime role"
psql -v ON_ERROR_STOP=1 -q -v app_password="$DB_APP_PASSWORD" -v dbname="$PGDATABASE" -f /docker-db/roles.sql
echo "migrations complete"
