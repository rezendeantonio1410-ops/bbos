import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

test("histórico comercial é isolado por empresa e cliente", () => {
  const source = readFileSync(
    join(__dirname, "customers.controller.ts"),
    "utf8",
  );
  assert.match(source, /@Get\(":id\/sales-history"\)/);
  assert.match(source, /WHERE so\."companyId"=\$1 AND so\."customerId"=\$2/);
  assert.match(source, /FROM "SalesOrderItem" item/);
  assert.match(source, /LEFT JOIN "AccountsReceivable" ar/);
});

test("decisão geral de crédito reutiliza a política de José e Suzi", () => {
  const source = readFileSync(
    join(__dirname, "customers.controller.ts"),
    "utf8",
  );
  assert.match(source, /isDesignatedTermCreditApprover\(actor\)/);
  assert.match(
    source,
    /Somente José ou Suzi podem aprovar ou rejeitar crédito/,
  );
});
