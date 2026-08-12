#!/usr/bin/env bash
set -euo pipefail

: "${MONGO_URI:?MONGO_URI not set}"

DEFAULT_MONGODUMP="/Users/dietherabad/Documents/mongodb-database-tools-macos-arm64-100.14.0/bin/mongodump"
MONGODUMP_BIN="${MONGODUMP_BIN:-}"
if [[ -z "$MONGODUMP_BIN" ]]; then
  if command -v mongodump >/dev/null 2>&1; then
    MONGODUMP_BIN="$(command -v mongodump)"
  else
    MONGODUMP_BIN="$DEFAULT_MONGODUMP"
  fi
fi

if [[ ! -x "$MONGODUMP_BIN" ]]; then
  echo "mongodump not found. Set MONGODUMP_BIN or install MongoDB Database Tools." >&2
  echo "Tried: $MONGODUMP_BIN" >&2
  exit 1
fi

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

mkdir -p "$BACKUP_DIR"

timestamp="$(date +"%Y%m%d_%H%M%S")"
archive="${BACKUP_DIR}/mongo_${timestamp}.gz"

"$MONGODUMP_BIN" --uri="$MONGO_URI" --archive="$archive" --gzip

find "$BACKUP_DIR" -type f -name "mongo_*.gz" -mtime +"$RETENTION_DAYS" -print -delete
echo "Backup written to ${archive}"
