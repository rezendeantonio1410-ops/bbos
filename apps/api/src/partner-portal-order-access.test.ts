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
    const nextRoute = source.indexOf("  @", start + route.length);
    const segment = source.slice(start, nextRoute === -1 ? undefined : nextRoute);
    assert.match(segment, /await this\.assertPartnerOrder\(partner, actor\.companyId, orderId\)/);
  }
});

test("edição de cliente comercial tem escopo de empresa/parceiro e não altera cadastro fiscal", () => {
  const start = source.indexOf('@Patch("end-customers/:customerId")');
  const end = source.indexOf('  @Post("orders")', start);
  assert.ok(start >= 0 && end > start);
  const segment = source.slice(start, end);
  assert.match(segment, /portalAccessLevel !== "DISTRIBUTOR"/);
  assert.match(segment, /parsePartnerEndCustomerPatch\(body\)/);
  assert.match(segment, /WHERE id=\$1 AND "companyId"=\$2 AND "partnerId"=\$3 AND active=true/);
  assert.match(segment, /RETURNING id,name,city,state/);
  assert.doesNotMatch(segment, /UPDATE "Customer"/);
});
