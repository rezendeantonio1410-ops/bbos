#!/usr/bin/env bash
# Signa portal — database integration and concurrency tests.
# ONLY for an isolated, disposable PostgreSQL with all migrations applied.
# Usage: SIGNA_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55432/bbos_test scripts/signa-db-integration.sh
set -euo pipefail

url="${SIGNA_TEST_DATABASE_URL:-}"
if [[ -z "$url" ]]; then
  echo "Defina SIGNA_TEST_DATABASE_URL apontando para um banco ISOLADO." >&2; exit 2
fi
host="$(sed -E 's#^[a-z]+://([^@/]*@)?([^:/?]+).*#\2#' <<<"$url")"
if [[ "$host" != "127.0.0.1" && "$host" != "localhost" && "$host" != "::1" ]]; then
  echo "Recusado: host '$host' não é local. Este teste nunca roda em staging/produção." >&2; exit 2
fi
root="$(cd "$(dirname "$0")/.." && pwd)"
psql_q() { psql "$url" -q -v ON_ERROR_STOP=1 "$@"; }

echo "== 1/2 integração SQL (transação com ROLLBACK)"
psql_q -f "$root/packages/database/prisma/tests/signa-portal-db-integration.sql"

echo "== 2/2 concorrência entre sessões"
cleanup() {
  psql "$url" -q <<'SQL' >/dev/null 2>&1 || true
DELETE FROM "PartnerOrderSubmission" WHERE "companyId"='cc-co';
DELETE FROM "PartnerOrderDraft" WHERE "companyId"='cc-co';
DELETE FROM "SalesOrder" WHERE "companyId"='cc-co';
DELETE FROM "Customer" WHERE "companyId"='cc-co';
DELETE FROM "User" WHERE "companyId"='cc-co';
DELETE FROM "StorefrontPartner" WHERE "companyId"='cc-co';
DELETE FROM "Company" WHERE id='cc-co';
SQL
}
trap cleanup EXIT
cleanup
psql_q <<'SQL'
INSERT INTO "Company"(id,name,"tradeName","taxId","updatedAt") VALUES ('cc-co','CC','CC','00000000000353',NOW());
INSERT INTO "StorefrontPartner"(id,"companyId",name,active,"portalAccessLevel") VALUES ('cc-partner','cc-co','CC Signa',true,'DISTRIBUTOR');
INSERT INTO "User"(id,"companyId",name,email,"passwordHash","updatedAt") VALUES ('cc-user','cc-co','CC','cc@example.test','x',NOW());
INSERT INTO "Customer"(id,"companyId",name,"updatedAt") VALUES ('cc-cust','cc-co','CC',NOW());
INSERT INTO "PartnerOrderDraft"(id,"companyId","partnerId","userId",version,payload) VALUES ('cc-draft','cc-co','cc-partner','cc-user',1,'{}');
SQL

# Same statements and order as PartnerPortalController.createOrder's transaction.
submit() { # $1 key  $2 sleep-seconds-inside-tx  $3 COMMIT|FAIL
  psql "$url" -q -At -v ON_ERROR_STOP=1 <<SQL 2>&1
BEGIN;
WITH claimed AS (
  INSERT INTO "PartnerOrderSubmission"(id,"companyId","partnerId","userId","submissionKey","requestHash",status,"createdAt","updatedAt")
  VALUES (gen_random_uuid()::text,'cc-co','cc-partner','cc-user','$1',repeat('c',64),'CLAIMED',NOW(),NOW())
  ON CONFLICT ("companyId","partnerId","userId","submissionKey") DO NOTHING RETURNING id)
SELECT count(*) > 0 AS won FROM claimed \gset
\if :won
  SELECT pg_advisory_xact_lock(hashtextextended('partner-order-number:' || 'cc-co', 0)) IS NULL AS locked \gset
  SELECT pg_sleep($2) \gset
  \if $( [[ "$3" == "FAIL" ]] && echo true || echo false )
    ROLLBACK;
    SELECT 'ROLLED_BACK';
  \else
    WITH so AS (
      INSERT INTO "SalesOrder"(id,"companyId","customerId",code,quantity,"unitPrice","totalAmount","updatedAt","createdByStorefrontPartnerId")
      SELECT gen_random_uuid()::text,'cc-co','cc-cust',
             'P-CC-'||lpad((COALESCE(MAX(RIGHT(code,6)::int),0)+1)::text,6,'0'),1,38,38,NOW(),'cc-partner'
        FROM "SalesOrder" WHERE "companyId"='cc-co' RETURNING id)
    UPDATE "PartnerOrderSubmission" s SET status='COMPLETED',"salesOrderId"=so.id,"completedAt"=NOW(),"updatedAt"=NOW()
      FROM so WHERE s."companyId"='cc-co' AND s."submissionKey"='$1' AND s.status='CLAIMED';
    COMMIT;
    SELECT 'CREATED';
  \endif
\else
  ROLLBACK;
  SELECT 'REPLAY';
\endif
SQL
}
count() { psql "$url" -At -c "$1"; }
fail() { echo "FALHOU: $*" >&2; exit 1; }

# A: 10 simultaneous identical submissions -> exactly one order.
for i in $(seq 1 10); do submit key-cc-concurrent-0001 1 COMMIT > "/tmp/signa-cc-$i.out" & done; wait
created=$(cat /tmp/signa-cc-*.out | grep -c '^CREATED$' || true)
replays=$(cat /tmp/signa-cc-*.out | grep -c '^REPLAY$' || true)
orders=$(count "SELECT count(*) FROM \"SalesOrder\" s JOIN \"PartnerOrderSubmission\" p ON p.\"salesOrderId\"=s.id WHERE p.\"submissionKey\"='key-cc-concurrent-0001'")
[[ "$created" == 1 && "$replays" == 9 && "$orders" == 1 ]] || { cat /tmp/signa-cc-*.out; fail "A: created=$created replays=$replays orders=$orders"; }
echo "A ok: 10 envios simultâneos -> 1 pedido, 9 replays"

# B: first attempt fails inside the transaction; a retry with the same key must create the order.
submit key-cc-rollback-00001 2 FAIL > /tmp/signa-cc-b1.out & sleep 0.5
submit key-cc-rollback-00001 0 COMMIT > /tmp/signa-cc-b2.out; wait
grep -q '^ROLLED_BACK$' /tmp/signa-cc-b1.out && grep -q '^CREATED$' /tmp/signa-cc-b2.out || { cat /tmp/signa-cc-b*.out; fail "B"; }
[[ "$(count "SELECT count(*) FROM \"PartnerOrderSubmission\" WHERE \"submissionKey\"='key-cc-rollback-00001' AND status='COMPLETED'")" == 1 ]] || fail "B: claim"
echo "B ok: falha na 1ª tentativa não deixa reserva órfã; nova tentativa cria 1 pedido"

# C: different keys in parallel -> distinct, sequential order numbers (no unique violation).
for i in 1 2 3 4 5; do submit "key-cc-distinct-0000$i" 0.3 COMMIT > "/tmp/signa-cc-c$i.out" & done; wait
[[ "$(cat /tmp/signa-cc-c*.out | grep -c '^CREATED$')" == 5 ]] || { cat /tmp/signa-cc-c*.out; fail "C"; }
[[ "$(count "SELECT count(DISTINCT code) FROM \"SalesOrder\" WHERE \"companyId\"='cc-co'")" == 7 ]] || fail "C: numbering"
echo "C ok: 5 pedidos diferentes simultâneos -> 5 números distintos"

# D: two sessions saving the same draft version -> exactly one wins.
for i in 1 2; do
  psql "$url" -At -c "UPDATE \"PartnerOrderDraft\" SET payload='{\"notes\":\"s$i\"}',version=version+1,\"updatedAt\"=NOW() WHERE id='cc-draft' AND \"companyId\"='cc-co' AND \"partnerId\"='cc-partner' AND \"userId\"='cc-user' AND version=1 AND status='DRAFT' RETURNING id" > "/tmp/signa-cc-d$i.out" &
done; wait
[[ "$(cat /tmp/signa-cc-d*.out | grep -c cc-draft)" == 1 && "$(count "SELECT version FROM \"PartnerOrderDraft\" WHERE id='cc-draft'")" == 2 ]] || fail "D"
echo "D ok: edição concorrente do rascunho -> uma grava, a outra recebe conflito"

rm -f /tmp/signa-cc-*.out
echo "signa-db-integration: TODOS OS TESTES PASSARAM"
