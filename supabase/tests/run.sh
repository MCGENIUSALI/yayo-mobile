#!/usr/bin/env bash
# Teste les migrations sur un PostgreSQL jetable (aucune connexion à Supabase).
#   bash supabase/tests/run.sh
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
bin="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)"
[ -x "$bin/initdb" ] || bin="$(dirname "$(command -v initdb)")"
tmp="$(mktemp -d)"
port=55432
trap '"$bin/pg_ctl" -D "$tmp/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$tmp"' EXIT
if [ "$(id -u)" = 0 ]; then chown -R postgres "$tmp"; as=(runuser -u postgres --); else as=(); fi
"${as[@]}" "$bin/initdb" -D "$tmp/data" -U postgres -A trust >/dev/null
"${as[@]}" "$bin/pg_ctl" -D "$tmp/data" -o "-p $port -k $tmp -c listen_addresses=''" -l "$tmp/log" start >/dev/null
psql=(psql -h "$tmp" -p "$port" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X)
"${psql[@]}" -f "$here/supabase_stub.sql"
for f in "$here"/../migrations/*.sql; do "${psql[@]}" -f "$f"; done
"${psql[@]}" -o /dev/null -f "$here/rules.test.sql"
echo "Migrations et tests OK"
