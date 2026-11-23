import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const source = readFileSync(
  join(__dirname, "partner-portal.controller.ts"),
  "utf8",
);

test("distribuidor somente herda pedido legado sem parceiro de origem", () => {
  // Three entry points: billing/invoice authorization, orders list and events.
  // A linked customer is NOT enough to see orders made by another partner.
  const safeLegacyClauses = source.match(
    /WHERE link\."partnerId"=\$[12] AND link\."customerId"=so\."customerId"\s+AND so\."createdByStorefrontPartnerId" IS NULL/g,
  ) ?? [];
  assert.equal(safeLegacyClauses.length, 3);
  assert.doesNotMatch(
    source,
    /WHERE link\."partnerId"=\$[12] AND link\."customerId"=so\."customerId"\s*\)\)/,
  );
});

test("PDF fiscal passa pela mesma autorização de pedido", () => {
  for (const route of [
    '@Get("orders/:orderId/billing/pdf")',
    '@Get("orders/:orderId/invoice/pdf")',
  ]) {
    const start = source.indexOf(route);
    assert.ok(start >= 0, route);
    // Parameter decorators (@Req, @Param, @Res) are inside the method.
    // End only at the next controller route, not at a parameter decorator.
    const rest = source.slice(start + route.length);
    const nextRoute = rest.search(/\n {2}@(Get|Post|Patch|Put|Delete)\(/);
    const segment = rest.slice(0, nextRoute === -1 ? undefined : nextRoute);
    assert.match(segment, /await this\.assertPartnerOrder\(partner, actor\.companyId, orderId\)/);
  }
});

test("edição de cliente comercial tem escopo de empresa/parceiro e não altera cadastro fiscal", () => {
  const start = source.indexOf('@Patch("end-customers/:customerId")');
  const end = source.indexOf('  @Post("orders")', start);
  assert.ok(start >= 0 && end > start);
  const segment = source.slice(start, end);
  assert.match(segment, /portalAccessLevel !== "DISTRIBUTOR"/);
  assert.match(segment, /parsePartnerEndCustomerPatch\(body, "update"\)/);
  assert.match(segment, /assertEndCustomerTaxIdAvailable\(actor\.companyId, partner\.id, changes\.taxId, customerId\)/);
  assert.match(segment, /WHERE id=\$1 AND "companyId"=\$2 AND "partnerId"=\$3 AND active=true/);
  assert.match(segment, /RETURNING id,name,"taxId","postalCode",street,number,district,complement,city,state/);
  assert.doesNotMatch(segment, /UPDATE "Customer"/);
});

test("dados pessoais dos rascunhos da conta Signa não podem ser armazenados em cache HTTP", () => {
  for (const route of ['order-drafts', 'order-drafts/:draftId']) {
    const decorator = `@Get("${route}")`;
    const start = source.indexOf(decorator);
    assert.ok(start >= 0, `Rota ausente: ${route}`);
    const methodStart = source.indexOf("async ", start);
    const declaration = source.slice(start, methodStart);
    assert.match(declaration, /@Header\("Cache-Control", "private, no-store"\)/);
  }
});

test("cadastro de cliente comercial exige ficha completa, impede CNPJ duplicado na carteira e grava somente PartnerEndCustomer", () => {
  const start = source.indexOf('@Post("end-customers")');
  const end = source.indexOf('@Patch("end-customers/:customerId")', start);
  assert.ok(start >= 0 && end > start);
  const segment = source.slice(start, end);
  assert.match(segment, /portalAccessLevel !== "DISTRIBUTOR"/);
  assert.match(segment, /parsePartnerEndCustomerPatch\(body, "create"\)/);
  assert.match(segment, /assertEndCustomerTaxIdAvailable\(actor\.companyId, partner\.id/);
  assert.match(segment, /INSERT INTO "PartnerEndCustomer"/);
  assert.doesNotMatch(segment, /"Customer"|billingRecipient/);
  const guard = source.slice(source.indexOf("private async assertEndCustomerTaxIdAvailable"));
  assert.match(guard, /WHERE "companyId"=\$1 AND "partnerId"=\$2 AND active=true AND "taxId"=\$3/);
});

test("portal do parceiro só lê financeiro: não confirma recebimentos, Pix, NF-e nem Bling", () => {
  const writes = /(INSERT INTO|UPDATE|DELETE FROM)\s+"(AccountsReceivable|AccountsReceivablePayment|Payment|PixCharge|PixPayment|FiscalDocument|BankTransaction|BankReconciliation|BlingSync\w*)"/gi;
  assert.deepEqual(source.match(writes) ?? [], []);
  assert.doesNotMatch(source, /\.(accountsReceivable|fiscalDocument|pixCharge|payment)\.(create|update|upsert|delete)/);
});
