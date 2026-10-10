#!/usr/bin/env bash
# psql on the live Supabase database, password read from .env and never echoed [tools/psql.sh -c "select 1"].
set -euo pipefail
cd "$(dirname "$0")/.."
PGPASSWORD="$(node -e "const t=require('fs').readFileSync('.env','utf8');process.stdout.write(((t.match(/^SUPABASE_DB_PASSWORD=(.*)$/m)||[])[1]||'').trim())")" \
  exec psql "host=db.yxlnctholuytypulojjj.supabase.co port=5432 user=postgres dbname=postgres sslmode=require" "$@"
