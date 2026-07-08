#!/usr/bin/env bash
# ============================================================
# Backup script — dumps the database to a timestamped file.
# Usage: ./scripts/backup.sh
# Requires DATABASE_URL to be set (e.g. `source .env` first, or export it).
# ============================================================
set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set. Export it or run: set -a && source .env && set +a && ./scripts/backup.sh"
  exit 1
fi

BACKUP_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
OUTFILE="$BACKUP_DIR/yogesh_advisory_${TIMESTAMP}.dump"

echo "Backing up to $OUTFILE ..."
pg_dump "$DATABASE_URL" -F c -f "$OUTFILE"
echo "Done."

# Keep only the most recent 14 backups in this directory (adjust as needed).
KEEP=14
cd "$BACKUP_DIR"
ls -1t yogesh_advisory_*.dump 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm --
echo "Retention: keeping the most recent $KEEP backups in $BACKUP_DIR."
