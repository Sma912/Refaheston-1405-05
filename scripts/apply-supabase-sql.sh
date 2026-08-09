#!/usr/bin/env bash
# Print (or apply) all Supabase SQL migrations in order.
# Usage:
#   ./scripts/apply-supabase-sql.sh           # print combined SQL
#   ./scripts/apply-supabase-sql.sh --psql    # apply via $DATABASE_URL
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MIG="$ROOT/supabase/migrations"

if [[ ! -d "$MIG" ]]; then
  echo "migrations folder not found: $MIG" >&2
  exit 1
fi

combined="$(mktemp)"
trap 'rm -f "$combined"' EXIT

{
  echo "-- Refahestoon schema migrations (generated $(date -u +%Y-%m-%dT%H:%MZ))"
  echo "-- Apply in order on a fresh Supabase project (SQL Editor is fine)."
  echo
  for f in "$MIG"/*.sql; do
    echo
    echo "-- >>> $(basename "$f")"
    echo
    cat "$f"
    echo
  done
} >"$combined"

if [[ "${1:-}" == "--psql" ]]; then
  if [[ -z "${DATABASE_URL:-}" ]]; then
    echo "DATABASE_URL is not set. Get it from Supabase → Settings → Database." >&2
    exit 1
  fi
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$combined"
  echo "Migrations applied."
  exit 0
fi

cat "$combined"
echo >&2
echo "Tip: copy the SQL above into Supabase SQL Editor, or run:" >&2
echo "  DATABASE_URL='postgresql://...' ./scripts/apply-supabase-sql.sh --psql" >&2
