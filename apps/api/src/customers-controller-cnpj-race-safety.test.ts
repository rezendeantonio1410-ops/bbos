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

function position(
  haystack: string,
  needle: string,
  description: string,
): number {
  const index = haystack.indexOf(needle);
  assert.notEqual(index, -1, `Trecho ausente: ${description}`);
  return index;
}

function compact(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

test("confirmação revalida e bloqueia as fontes internas antes de atualizar o CNPJ", () => {
  const evidenceGuard = section(
    "private async assertTaxIdSuggestionEvidenceCurrent",
    "private async taxIdSuggestionSnapshot",
  );
  const confirmation = section(
    '@Post(":id/tax-id-suggestions/:suggestionId/confirm")',
    '@Get(":id/visits")',
  );

  const customerEvidence = section(
    "const customerRows = customerIds.length",
    "const supplierRows = supplierIds.length",
  );
  const supplierEvidence = section(
    "const supplierRows = supplierIds.length",
    "const currentSources",
  );
  assert.match(
    compact(customerEvidence),
    /FROM "Customer"\s+WHERE "companyId"=\$\d+ AND id = ANY\(\$\d+::text\[\]\)\s+ORDER BY id FOR UPDATE/,
    "as fontes Customer devem ser relidas e bloqueadas",
  );
  assert.match(
    compact(supplierEvidence),
    /FROM "Supplier"\s+WHERE "companyId"=\$\d+ AND id = ANY\(\$\d+::text\[\]\)\s+ORDER BY id FOR UPDATE/,
    "as fontes Supplier devem ser relidas e bloqueadas",
  );
  assert.match(evidenceGuard, /row\.active !== true/);
  assert.match(
    evidenceGuard,
    /!isTrustedInternalTaxIdVerificationStatus\(\s*row\.taxIdVerificationStatus,?\s*\)/,
  );
  assert.match(evidenceGuard, /normalizeCnpj\(row\.taxId\) !== canonicalCnpj/);
  assert.match(
    evidenceGuard,
    /A fonte desta sugestão foi alterada\. Pesquise o CNPJ novamente\./,
  );

  const transactionIndex = position(
    confirmation,
    "this.db.$transaction",
    "transação da confirmação",
  );
  const companyLockIndex = position(
    confirmation,
    "this.lockTaxIdSuggestionCompanyScope(actor, tx)",
    "lock global do fluxo de sugestões",
  );
  const lockedSuggestionIndex = position(
    confirmation,
    "const lockedSuggestion",
    "sugestão relida sob lock",
  );
  const evidenceIndex = position(
    confirmation,
    "this.assertTaxIdSuggestionEvidenceCurrent",
    "revalidação das fontes dentro da transação",
  );
  const customerUpdateIndex = position(
    confirmation,
    'UPDATE "Customer"',
    "atualização do CNPJ do cliente",
  );

  assert.ok(transactionIndex < companyLockIndex);
  assert.ok(companyLockIndex < lockedSuggestionIndex);
  assert.ok(lockedSuggestionIndex < evidenceIndex);
  assert.ok(evidenceIndex < customerUpdateIndex);
  const evidenceCall = confirmation.slice(
    evidenceIndex,
    confirmation.indexOf(";", evidenceIndex) + 1,
  );
  assert.match(evidenceCall, /lockedSuggestion\.taxId/);
  assert.match(evidenceCall, /lockedSuggestion\.scoreReasons/);
  assert.match(evidenceCall, /\bactor\b/);
  assert.match(evidenceCall, /\btx\b/);
  assert.match(
    confirmation.slice(Math.max(0, evidenceIndex - 80), evidenceIndex),
    /const canonicalCnpj\s*=\s*await\s*$/,
    "o CNPJ persistido deve ser o valor canônico retornado pela revalidação",
  );
});

test("confirmação rejeita globalmente as demais sugestões ativas sem inspecionar outra carteira", () => {
  const confirmation = section(
    '@Post(":id/tax-id-suggestions/:suggestionId/confirm")',
    '@Get(":id/visits")',
  );

  assert.doesNotMatch(confirmation, /visibleSiblingIds/);
  assert.doesNotMatch(confirmation, /siblingRows/);
  assert.doesNotMatch(
    confirmation,
    /id\s*=\s*ANY\(\$\d+::text\[\]\)/,
    "a rejeição não pode depender apenas dos IDs que o vendedor consegue visualizar",
  );
  assert.match(
    compact(confirmation),
    /UPDATE "CustomerTaxIdSuggestion" SET status='REJECTED'.* WHERE "companyId"=\$\d+ AND "customerId"=\$\d+ AND id<>\$\d+ AND status IN \('DRAFT','SELECTED'\)/,
  );
  assert.match(
    confirmation,
    /Sugestão de CNPJ não encontrada\./,
    "a falha de visibilidade deve continuar genérica",
  );

  const transactionIndex = position(
    confirmation,
    "this.db.$transaction",
    "transação da confirmação",
  );
  assert.doesNotMatch(
    confirmation.slice(0, transactionIndex),
    /CustomerTaxIdSuggestion|assertTaxIdSuggestionAllowed/,
    "a sugestão escolhida não deve ser inspecionada fora da transação",
  );
  const lockedSuggestionIndex = position(
    confirmation,
    "const lockedSuggestion",
    "sugestão selecionada relida sob lock",
  );
  const evidenceIndex = position(
    confirmation,
    "this.assertTaxIdSuggestionEvidenceCurrent",
    "validação uniforme de visibilidade e evidência",
  );
  assert.ok(transactionIndex < lockedSuggestionIndex);
  assert.ok(lockedSuggestionIndex < evidenceIndex);
});

test("busca calcula e persiste sugestões usando um único retrato transacional", () => {
  const search = section(
    '@Post(":id/tax-id-suggestions/search")',
    '@Post(":id/tax-id-suggestions/reject")',
  );

  const transactionIndex = position(
    search,
    "this.db.$transaction",
    "transação da pesquisa",
  );
  const companyLockIndex = position(
    search,
    "this.lockTaxIdSuggestionCompanyScope(actor, tx)",
    "lock global do fluxo de sugestões",
  );
  const targetIndex = position(
    search,
    "const targets = await tx.$queryRawUnsafe",
    "leitura do cliente pesquisado",
  );
  const customerSourceIndex = position(
    search,
    "const customerRows = await tx.$queryRawUnsafe",
    "leitura das fontes de clientes",
  );
  const supplierSourceIndex = position(
    search,
    "const supplierRows =",
    "leitura das fontes de fornecedores",
  );
  const suggestionIndex = position(
    search,
    "suggestInternalCnpjs(",
    "cálculo das sugestões",
  );
  const insertIndex = position(
    search,
    'INSERT INTO "CustomerTaxIdSuggestion"',
    "persistência do rascunho",
  );

  assert.ok(transactionIndex < companyLockIndex);
  assert.ok(companyLockIndex < targetIndex);
  assert.ok(targetIndex < customerSourceIndex);
  assert.ok(customerSourceIndex < supplierSourceIndex);
  assert.ok(supplierSourceIndex < suggestionIndex);
  assert.ok(suggestionIndex < insertIndex);
  assert.doesNotMatch(
    search.slice(0, transactionIndex),
    /this\.db\.\$(?:queryRawUnsafe|executeRawUnsafe)/,
    "nenhuma leitura ou escrita de sugestões pode usar um retrato anterior à transação",
  );
  assert.match(
    compact(search.slice(targetIndex, customerSourceIndex)),
    /FROM "Customer" c\s+WHERE c\.id=\$\d+ AND c\."companyId"=\$\d+ AND c\.active=true\s+.*FOR UPDATE(?: OF c)?/,
  );
  assert.match(
    compact(search.slice(customerSourceIndex, supplierSourceIndex)),
    /FROM "Customer" c\s+.*ORDER BY c\.id FOR UPDATE(?: OF c)?/,
  );
  assert.match(
    compact(search.slice(supplierSourceIndex, suggestionIndex)),
    /FROM "Supplier" s\s+.*ORDER BY s\.id FOR UPDATE(?: OF s)?/,
  );
  assert.match(
    search.slice(insertIndex - 80, insertIndex),
    /tx\.\$executeRawUnsafe\(\s*`\s*$/,
    "o rascunho deve ser persistido pela mesma transação",
  );
});
