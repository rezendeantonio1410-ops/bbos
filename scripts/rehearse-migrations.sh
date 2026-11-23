#!/usr/bin/env bash
# Rehearses `prisma migrate deploy` (the exact command RC1 runs on deploy) on a
# RESTORED COPY of production. Refuses any database not named like a copy.
# Usage (Render cron): REHEARSAL_DATABASE_URL=... scripts/rehearse-migrations.sh
set -euo pipefail
url="${REHEARSAL_DATABASE_URL:?Defina REHEARSAL_DATABASE_URL}"
name="$(psql "$url" -X -A -t -c 'SELECT current_database()')"
case "$name" in
  *rehearsal*|*ensaio*) ;;
  *) echo "REHEARSAL: RECUSADO - '$name' não é um banco de ensaio"; exit 2 ;;
esac
echo "REHEARSAL: banco $name; migrações antes:"
psql "$url" -X -A -t -c "SELECT count(*) || ' aplicadas; última: ' || max(migration_name) FROM \"_prisma_migrations\" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL"
psql "$url" -X -A -t -c "SELECT 'REHEARSAL: PartnerEndCustomer ativos com CNPJ duplicado = ' || count(*) FROM (SELECT 1 FROM \"PartnerEndCustomer\" WHERE active AND \"taxId\" IS NOT NULL AND length(regexp_replace(\"taxId\",'[^0-9]','','g'))=14 GROUP BY \"companyId\",\"partnerId\",regexp_replace(\"taxId\",'[^0-9]','','g') HAVING count(*)>1) d"
started=$(date +%s)
DATABASE_URL="$url" pnpm --filter @bbos/database migrate:deploy
echo "REHEARSAL: migrate deploy em $(( $(date +%s) - started ))s"
DATABASE_URL="$url" pnpm --filter @bbos/database exec prisma migrate status --schema=prisma/schema.prisma || true
psql "$url" -X -A -t -v ON_ERROR_STOP=1 -c "SELECT 'REHEARSAL: tabelas ' || coalesce(to_regclass('public.\"PartnerOrderDraft\"')::text,'AUSENTE') || ', ' || coalesce(to_regclass('public.\"PartnerOrderSubmission\"')::text,'AUSENTE') || ', índice ' || coalesce(to_regclass('public.\"PartnerEndCustomer_active_scoped_cnpj_unique\"')::text,'AUSENTE') || ', coluna IE ' || (SELECT count(*) FROM information_schema.columns WHERE table_name='PartnerEndCustomer' AND column_name='stateRegistration')"
psql "$url" -X -A -t -c "SELECT 'REHEARSAL: pedidos=' || (SELECT count(*) FROM \"SalesOrder\") || ' clientes=' || (SELECT count(*) FROM \"Customer\") || ' recebiveis=' || (SELECT count(*) FROM \"AccountsReceivable\")"
pending=$(DATABASE_URL="$url" pnpm --filter @bbos/database migrate:deploy 2>&1 | grep -c "No pending migrations" || true)
[ "$pending" -ge 1 ] && echo "REHEARSAL_OK: migrações aplicadas e segundo deploy sem pendências" || { echo "REHEARSAL_FAILED"; exit 1; }
