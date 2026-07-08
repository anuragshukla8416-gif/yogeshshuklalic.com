#!/usr/bin/env bash
# ============================================================
# Restore script — restores a pg_dump custom-format backup.
# Usage: ./scripts/restore.sh backups/yogesh_advisory_20260708_120000.dump
# Requires DATABASE_URL to point at the TARGET database you want restored into.
# ============================================================
set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set. Export it first."
  exit 1
fi
if [ -z "${1:-}" ]; then
  echo "Usage: $0 <path-to-dump-file>"
  exit 1
fi
DUMP_FILE="$1"
if [ ! -f "$DUMP_FILE" ]; then
  echo "File not found: $DUMP_FILE"
  exit 1
fi

echo "This will restore '$DUMP_FILE' into:"
echo "  $DATABASE_URL"
echo "Existing data in conflicting tables may be overwritten."
read -rp "Type 'yes' to continue: " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Aborted."
  exit 1
fi

pg_restore --clean --if-exists --no-owner -d "$DATABASE_URL" "$DUMP_FILE"
echo "Restore complete."
