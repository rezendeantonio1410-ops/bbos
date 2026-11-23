#!/usr/bin/env bash
# Builds a disposable database from prisma/migrations for the Signa tests.
# Legacy migrations (before 2026-11-22) are replayed tolerantly because the
# historical chain has a known duplicate index after the baseline; every Signa
# migration is applied STRICTLY, one transaction per file.
set -euo pipefail
url="${SIGNA_TEST_DATABASE_URL:?Defina SIGNA_TEST_DATABASE_URL}"
host="$(sed -E 's#^[a-z]+://([^@/]*@)?([^:/?]+).*#\2#' <<<"$url")"
[[ "$host" == "127.0.0.1" || "$host" == "localhost" ]] || { echo "Recusado: host não local." >&2; exit 2; }
dir="$(cd "$(dirname "$0")/.." && pwd)/packages/database/prisma/migrations"
for path in $(ls -d "$dir"/*/ | sort); do
  name="$(basename "$path")"; file="$path/migration.sql"; [[ -f "$file" ]] || continue
  if [[ "$name" < "20261122010000" ]]; then
    psql "$url" -q -f "$file" >/dev/null 2>&1 || true
  else
    psql "$url" -q -v ON_ERROR_STOP=1 -1 -f "$file" >/dev/null
    echo "strict OK $name"
  fi
done
