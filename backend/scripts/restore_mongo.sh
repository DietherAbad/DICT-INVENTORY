#!/usr/bin/env bash
set -euo pipefail

: "${MONGO_URI:?MONGO_URI not set}"

if [ $# -lt 1 ]; then
  echo "Usage: restore_mongo.sh /path/to/mongo_YYYYmmdd_HHMMSS.gz"
  exit 1
fi

archive="$1"

if [ ! -f "$archive" ]; then
  echo "Archive not found: $archive"
  exit 1
fi

mongorestore --uri="$MONGO_URI" --archive="$archive" --gzip --drop
echo "Restore completed from ${archive}"
