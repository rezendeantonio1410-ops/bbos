#!/bin/sh
# Verifiable backup of a PostgreSQL database.
# - SOURCE_DATABASE_URL: database to back up. Only READ (pg_dump + SELECT count).
# - BACKUP_DATABASE_URL: EMPTY database that receives the restore (refused if not empty).
# - REHEARSAL_DATABASE_NAME (optional): extra database created in the backup
#   instance with the same restore, for rehearsing migrations on real data.
# Prints BACKUP_VERIFIED only when counts match across non-system schemas.
# Counts are not a content checksum; retry if concurrent writes change them.
# Connection strings are never printed.
set -eu
: "${SOURCE_DATABASE_URL:?}" "${BACKUP_DATABASE_URL:?}"
SRC="$SOURCE_DATABASE_URL"; DST="$BACKUP_DATABASE_URL"
DUMP=/tmp/source.dump
COUNT_SQL="SELECT format('%I.%I', table_schema, table_name) || '|' || (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text FROM information_schema.tables WHERE table_schema <> 'information_schema' AND left(table_schema, 3) <> 'pg_' AND table_type = 'BASE TABLE' ORDER BY 1"

counts() { psql "$1" -X -A -t -v ON_ERROR_STOP=1 -c "$COUNT_SQL"; }
total() { awk -F'|' '{ s += $2 } END { print s + 0 }' "$1"; }

echo "BACKUP: inicio $(date -u +%FT%TZ)"
if [ "$(psql "$DST" -X -A -t -c "SELECT count(*) FROM pg_tables WHERE schemaname = 'public'")" != "0" ]; then
  echo "BACKUP: RECUSADO - o banco de destino nao esta vazio"; exit 2
fi
psql "$SRC" -X -A -t -c "SELECT 'BACKUP: origem ' || current_database() || ', ' || pg_size_pretty(pg_database_size(current_database())) || ', postgres ' || current_setting('server_version')"
counts "$SRC" > /tmp/before.txt
pg_dump --format=custom --no-owner --no-privileges --dbname="$SRC" --file="$DUMP"
counts "$SRC" > /tmp/after.txt
echo "BACKUP: dump bytes=$(wc -c < "$DUMP") sha256=$(sha256sum "$DUMP" | cut -c1-64)"
if ! diff -q /tmp/before.txt /tmp/after.txt > /dev/null; then
  echo "BACKUP: RECUSADO - contagens da origem mudaram durante o dump; repetir em janela estavel"; exit 1
fi
pg_restore --exit-on-error --single-transaction --no-owner --no-privileges --dbname="$DST" "$DUMP" || { echo "BACKUP: FALHA na restauracao"; exit 1; }
# Compare the restored counts against stable before/after source counts.
# This verifies row counts, not content equality or a shared snapshot.
counts "$DST" > /tmp/copy.txt
echo "BACKUP: tabelas origem=$(wc -l < /tmp/after.txt) copia=$(wc -l < /tmp/copy.txt) linhas origem=$(total /tmp/after.txt) copia=$(total /tmp/copy.txt)"
if diff /tmp/after.txt /tmp/copy.txt > /tmp/diff.txt; then
  echo "BACKUP_VERIFIED: contagem exata de linhas identica em todas as tabelas"
else
  echo "BACKUP_MISMATCH:"; head -20 /tmp/diff.txt; exit 1
fi
if [ -n "${REHEARSAL_DATABASE_NAME:-}" ]; then
  REH="${DST%/*}/${REHEARSAL_DATABASE_NAME}"
  psql "$DST" -X -q -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"${REHEARSAL_DATABASE_NAME}\""
  pg_restore --exit-on-error --single-transaction --no-owner --no-privileges --dbname="$REH" "$DUMP" || { echo "REHEARSAL_COPY_FAILED"; exit 1; }
  counts "$REH" > /tmp/rehearsal.txt
  if diff -q /tmp/after.txt /tmp/rehearsal.txt > /dev/null; then echo "REHEARSAL_COPY_READY: ${REHEARSAL_DATABASE_NAME}"; else echo "REHEARSAL_COPY_MISMATCH"; exit 1; fi
fi
rm -f "$DUMP"
echo "BACKUP: fim $(date -u +%FT%TZ)"
