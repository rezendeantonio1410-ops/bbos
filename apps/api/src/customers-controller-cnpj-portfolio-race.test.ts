import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const customersSource = readFileSync(
  join(__dirname, "customers.controller.ts"),
  "utf8",
);
const partnersSource = readFileSync(
  join(__dirname, "storefront-partners.controller.ts"),
  "utf8",
);

function section(source: string, start: string, end: string): string {
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

test("confirmação bloqueia e revalida a carteira alvo e as fontes na mesma transação", () => {
  const portfolioLock = section(
    customersSource,
    "private async lockAndAssertSalesPortfolioCustomers",
    "private async lockTaxIdSuggestionCompanyScope",
  );

  assert.match(portfolioLock, /actor\.role !== "SALES"/);
  assert.match(portfolioLock, /targetCustomerId/);
  assert.match(
    portfolioLock,
    /taxIdSuggestionCustomerSourceIds\(scoreReasons\)/,
  );
  assert.match(
    compact(portfolioLock),
    /new Set\(customerIds\.filter\(.*\)\).*\.sort\(\)/,
    "o lock deve incluir o cliente alvo e todas as fontes em ordem estável",
  );
  assert.match(
    compact(portfolioLock),
    /FROM "StorefrontPartnerCustomer" portfolio JOIN "Customer" c ON c\.id=portfolio\."customerId"/,
  );
  assert.match(
    compact(portfolioLock),
    /ORDER BY portfolio\."customerId" FOR SHARE OF portfolio/,
    "FOR SHARE deve disputar o mesmo vínculo que a revogação remove",
  );
  assert.match(
    portfolioLock,
    /new NotFoundException\("Sugestão de CNPJ não encontrada\."\)/,
    "uma carteira revogada não pode revelar se a sugestão ainda existe",
  );
});

test("a revogação remove exatamente as linhas protegidas pelo lock da confirmação", () => {
  const updatePartner = section(
    partnersSource,
    '@Patch(":id/portal-permissions")',
    '@Get(":id/portal-permissions")',
  );

  assert.match(
    compact(updatePartner),
    /DELETE FROM "StorefrontPartnerCustomer" WHERE "partnerId"=\$1/,
  );
  assert.match(updatePartner, /this\.database\.\$transaction/);
  assert.match(
    compact(updatePartner),
    /SELECT pg_advisory_xact_lock\(hashtext\(\$1\)\).*customer-tax-id-suggestions.*DELETE FROM "StorefrontPartnerCustomer"/,
    "a alteração da carteira deve compartilhar o mesmo lock das sugestões antes de remover vínculos",
  );
});

test("a revalidação da carteira acontece antes do retorno idempotente e de qualquer escrita", () => {
  const confirmation = section(
    customersSource,
    '@Post(":id/tax-id-suggestions/:suggestionId/confirm")',
    '@Get(":id/visits")',
  );

  const transactionIndex = position(
    confirmation,
    "this.db.$transaction",
    "transação da confirmação",
  );
  const lockedSuggestionIndex = position(
    confirmation,
    "const lockedSuggestion",
    "sugestão relida sob lock",
  );
  const portfolioLockIndex = position(
    confirmation,
    "this.lockAndAssertTaxIdSuggestionPortfolioScope",
    "lock transacional da carteira",
  );
  const idempotentReturnIndex = position(
    confirmation,
    'lockedSuggestion.status === "CONFIRMED"',
    "retorno idempotente",
  );
  const customerUpdateIndex = position(
    confirmation,
    'UPDATE "Customer"',
    "atualização do CNPJ",
  );

  assert.ok(transactionIndex < lockedSuggestionIndex);
  assert.ok(lockedSuggestionIndex < portfolioLockIndex);
  assert.ok(portfolioLockIndex < idempotentReturnIndex);
  assert.ok(portfolioLockIndex < customerUpdateIndex);

  const portfolioCall = confirmation.slice(
    portfolioLockIndex,
    confirmation.indexOf(";", portfolioLockIndex) + 1,
  );
  assert.match(portfolioCall, /\bactor\b/);
  assert.match(portfolioCall, /\bid\b/);
  assert.match(portfolioCall, /lockedSuggestion\.scoreReasons/);
  assert.match(portfolioCall, /\btx\b/);
});
