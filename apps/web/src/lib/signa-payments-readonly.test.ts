import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const dashboard = readFileSync(
  new URL("../app/parceiro/SignaEnterpriseDashboard.tsx", import.meta.url),
  "utf8",
);
const page = readFileSync(
  new URL("../app/parceiro/page.tsx", import.meta.url),
  "utf8",
);
const controller = readFileSync(
  new URL("../../../api/src/partner-portal.controller.ts", import.meta.url),
  "utf8",
);

test("Pagamentos usa títulos existentes do Contas a Receber com escopo do portal", () => {
  assert.match(dashboard, /href:"#pagamentos-signa"/);
  assert.match(dashboard, /id="pagamentos-signa"/);
  assert.match(dashboard, /orders\.filter\(o=>Boolean\(o\.receivableStatus\)\)/);
  assert.match(page, /dueDate\?: string \| null/);
  assert.match(page, /receivableAmount\?: number \| string \| null/);
  assert.match(page, /openAmount\?: number \| string \| null/);
  assert.match(controller, /FROM "AccountsReceivable" title/);
  assert.match(controller, /title\."salesOrderId"=so\.id AND title\."companyId"=so\."companyId"/);
});

test("nunca considera ausência de título ou de data como pagamento realizado", () => {
  assert.match(dashboard, /receivableOrders\.length===0/);
  assert.match(dashboard, /Isso não significa que algum pagamento tenha sido realizado/);
  assert.match(dashboard, /o\.receivableAmount!=null/);
  assert.match(dashboard, /o\.openAmount!=null/);
  assert.match(dashboard, /o\.receivableStatus==="PAID"&&o\.paymentDate/);
  assert.match(dashboard, /o\.billingAvailable&&<a/);
});

test("painel responsivo de pagamentos é somente leitura e não autoriza baixas financeiras", () => {
  const start = dashboard.indexOf('id="pagamentos-signa"');
  const end = dashboard.indexOf('<section aria-label="Pedidos em andamento"', start);
  assert.ok(start > 0 && end > start);
  const panel = dashboard.slice(start, end);
  assert.match(panel, /grid gap-3 sm:grid-cols-2 xl:grid-cols-3/);
  assert.match(panel, /o\.receivableStatus==="PAID"/);
  assert.match(panel, /conciliação do financeiro da Bispo/);
  assert.doesNotMatch(panel, /fetch\(|onClick=|onSubmit=|method:"(POST|PATCH|PUT|DELETE)"/);
});
