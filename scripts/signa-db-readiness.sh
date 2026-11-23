#!/usr/bin/env bash
# Read-only gate before staging migrations for the Signa portal.
# Usage: DATABASE_URL=... bash scripts/signa-db-readiness.sh /secure/path/backup.dump
# Never applies migrations, restores data, or prints the database URL.
set -euo pipefail

fail() { printf 'BLOQUEADO: %s\n' "$*" >&2; exit 2; }

[[ $# -eq 1 ]] || fail "Informe o caminho para o backup pg_dump -Fc."
[[ -n "\${DATABASE_URL:-}" ]] || fail "Defina DATABASE_URL no ambiente (nao imprima a URL)."
backup="$1"
[[ -s "$backup" ]] || fail "Backup inexistente ou vazio."
for bin in psql pg_restore find sort comm grep diff wc mktemp; do
  command -v "$bin" >/dev/null 2>&1 || fail "Comando ausente: $bin"
done

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

# This confirms archive readability and expected catalog content, NOT
# recoverability. A restore test in an isolated database is still mandatory.
pg_restore -l "$backup" > "$tmp/toc" || fail "Arquivo nao e um dump custom valido."
grep -Eq ' TABLE public SalesOrder( |$)' "$tmp/toc" ||
  fail "Backup sem a tabela estrutural SalesOrder; inspecione origem e escopo."
printf 'Backup legivel: %s bytes (restauracao ainda nao testada).\n' "$(wc -c < "$backup" | tr -d ' ')"

root="$(cd "$(dirname "$0")/.." && pwd)"
migration_dir="$root/packages/database/prisma/migrations"
[[ -d "$migration_dir" ]] || fail "Diretorio de migracoes nao encontrado."
find "$migration_dir" -type f -name migration.sql |
  while IFS= read -r path; do basename "$(dirname "$path")"; done |
  LC_ALL=C sort -u > "$tmp/local"

# Query only. Ignore historical failed migrations that have been rolled back.
psql "$DATABASE_URL" -X -A -t -q -v ON_ERROR_STOP=1 \
  -c 'SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name;' \
  > "$tmp/applied" || fail "Falha ao consultar historico de migracoes."
LC_ALL=C sort -u "$tmp/applied" -o "$tmp/applied"

unresolved="$(psql "$DATABASE_URL" -X -A -t -q -v ON_ERROR_STOP=1 \
  -c 'SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL;')" ||
  fail "Falha ao consultar migracoes incompletas."
[[ "$unresolved" == "0" ]] || fail "$unresolved migracoes incompletas sem rollback."

cat > "$tmp/expected" <<'EOF'
20261123030000_signa_order_drafts
20261123124000_signa_end_customer_address
20261123150000_signa_order_submission_claims
20261123180000_signa_end_customer_unique_cnpj
EOF

# Include PR #116's CNPJ constraint before allowing staging migration.
while IFS= read -r migration; do
  grep -Fxq "$migration" "$tmp/local" ||
    fail "Migracao $migration nao existe no checkout; integre PR #116 se necessario."
done < "$tmp/expected"

comm -23 "$tmp/local" "$tmp/applied" > "$tmp/pending"
if ! diff -u "$tmp/expected" "$tmp/pending"; then
  fail "Lista de migracoes pendentes difere das quatro revisadas; nao executar deploy."
fi

missing_tables="$(psql "$DATABASE_URL" -X -A -t -q -v ON_ERROR_STOP=1 \
  -c 'SELECT count(*) FROM (VALUES ('\''Company'\''),('\''StorefrontPartner'\''),('\''User'\''),('\''SalesOrder'\''),('\''PartnerEndCustomer'\'')) AS r(name) WHERE to_regclass('\''public."'\'' || name || '\''"'\'') IS NULL;')" ||
  fail "Falha ao conferir tabelas de referencia."
[[ "$missing_tables" == "0" ]] || fail "$missing_tables tabelas estruturais ausentes."

duplicates="$(psql "$DATABASE_URL" -X -A -t -q -v ON_ERROR_STOP=1 \
  -c 'SELECT count(*) FROM (SELECT "companyId","partnerId",regexp_replace("taxId",'\''[^0-9]'\'','\'''\'','\''g'\'') AS cnpj FROM "PartnerEndCustomer" WHERE active = true AND "taxId" IS NOT NULL AND length(regexp_replace("taxId",'\''[^0-9]'\'','\'''\'','\''g'\'')) = 14 GROUP BY 1,2,3 HAVING count(*) > 1) d;')" ||
  fail "Falha ao verificar duplicidade de CNPJ."
[[ "$duplicates" == "0" ]] || fail "$duplicates carteiras com CNPJ comercial duplicado."

printf 'PRE-FLIGHT OK: quatro migracoes Signa pendentes, sem colisoes; banco intocado.\n'
printf 'IMPORTANTE: ensaie o restore em PostgreSQL isolado e aprove o backup antes de aplicar qualquer migracao.\n'
