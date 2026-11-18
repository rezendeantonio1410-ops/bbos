import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const source = readFileSync(join(__dirname, "customers.controller.ts"), "utf8");

function section(start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `Seção inicial ausente: ${start}`);
  assert.notEqual(endIndex, -1, `Seção final ausente: ${end}`);
  return source.slice(startIndex, endIndex);
}

test("PATCH usa versão otimista e o mesmo lock transacional da confirmação", () => {
  const patchCustomer = section('@Patch(":id")', '@Patch(":id/credit")');
  const rowLockIndex = patchCustomer.indexOf("FOR UPDATE");
  const advisoryLockIndex = patchCustomer.indexOf("pg_advisory_xact_lock");

  assert.match(patchCustomer, /pg_advisory_xact_lock/);
  assert.match(patchCustomer, /"updatedAt"=\$3::timestamptz\s+FOR UPDATE/);
  assert.ok(rowLockIndex >= 0);
  assert.ok(advisoryLockIndex > rowLockIndex);
  assert.match(patchCustomer, /"updatedAt"=\$26::timestamptz/);
  assert.match(patchCustomer, /if \(!lockedCurrent\[0\]\)/);
  assert.match(patchCustomer, /if \(!updatedRows\[0\]\)/);
  assert.doesNotMatch(
    patchCustomer,
    /status IN \('DRAFT','SELECTED','CONFIRMED'\)/,
  );
});

test("rejeição exige sugestão ativa e preserva verificação alheia", () => {
  const reject = section(
    '@Post(":id/tax-id-suggestions/reject")',
    '@Post(":id/tax-id-suggestions/:suggestionId/confirm")',
  );

  assert.match(reject, /visibleIds\.length === 0/);
  assert.match(reject, /Não há sugestões ativas de CNPJ para rejeitar/);
  assert.doesNotMatch(reject, /"taxIdVerifiedAt"=NULL/);
  assert.doesNotMatch(reject, /SET\s+"taxIdVerificationStatus"/);
});

test("busca só consulta fontes internas com verificação confiável", () => {
  const search = section(
    '@Post(":id/tax-id-suggestions/search")',
    '@Post(":id/tax-id-suggestions/reject")',
  );
  const trustedFilters = search.match(
    /taxIdVerificationStatus"::text IN \('VERIFIED_ACTIVE','CONFIRMED_INTERNAL'\)/g,
  );

  assert.equal(trustedFilters?.length, 2);
  assert.match(search, /isTrustedInternalTaxIdVerificationStatus/);
});

test("snapshot separa o fluxo ativo de confirmações históricas", () => {
  const snapshot = section(
    "private async taxIdSuggestionSnapshot",
    "private async health",
  );

  assert.match(snapshot, /selectTaxIdSuggestionSnapshotRows\(visibleRows, 3\)/);
});
