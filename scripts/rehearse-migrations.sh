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
DATABASE_URL="$url" pnpm --filter @bbos/database exec prisma migrate status --schema=prisma/schema.prisma
psql "$url" -X -A -t -v ON_ERROR_STOP=1 -c "SELECT 'REHEARSAL: tabelas ' || coalesce(to_regclass('public.\"PartnerOrderDraft\"')::text,'AUSENTE') || ', ' || coalesce(to_regclass('public.\"PartnerOrderSubmission\"')::text,'AUSENTE') || ', índice ' || coalesce(to_regclass('public.\"PartnerEndCustomer_active_scoped_cnpj_unique\"')::text,'AUSENTE') || ', coluna IE ' || (SELECT count(*) FROM information_schema.columns WHERE table_name='PartnerEndCustomer' AND column_name='stateRegistration')"
# A diagnostic log alone is not a release gate. Fail if required objects are absent.
objects=$(psql "$url" -X -A -t -v ON_ERROR_STOP=1 -c "SELECT CASE WHEN to_regclass('public.\"PartnerOrderDraft\"') IS NOT NULL AND to_regclass('public.\"PartnerOrderSubmission\"') IS NOT NULL AND EXISTS (SELECT 1 FROM pg_index WHERE indexrelid = to_regclass('public.\"PartnerEndCustomer_active_scoped_cnpj_unique\"') AND indisvalid AND indisunique) AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='PartnerEndCustomer' AND column_name='stateRegistration') THEN 'ok' ELSE 'missing' END")
[ "$objects" = "ok" ] || { echo "REHEARSAL_FAILED: objetos obrigatorios ausentes ou invalidos"; exit 1; }
psql "$url" -X -A -t -c "SELECT 'REHEARSAL: pedidos=' || (SELECT count(*) FROM \"SalesOrder\") || ' clientes=' || (SELECT count(*) FROM \"Customer\") || ' recebiveis=' || (SELECT count(*) FROM \"AccountsReceivable\")"
# Preserve the actual exit status; never accept a successful-looking log from a failing command.
if ! second_output=$(DATABASE_URL="$url" pnpm --filter @bbos/database migrate:deploy 2>&1); then
  printf '%s\n' "$second_output"
  echo "REHEARSAL_FAILED: segundo deploy falhou"; exit 1
fi
printf '%s\n' "$second_output"
if ! grep -q "No pending migrations" <<< "$second_output"; then
  echo "REHEARSAL_FAILED: segundo deploy sem confirmacao"; exit 1
fi
echo "REHEARSAL_OK: migrações aplicadas e segundo deploy sem pendências"
