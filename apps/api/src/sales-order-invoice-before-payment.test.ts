import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = join(__dirname, "../../..");
const source = (path: string) => readFileSync(join(root, path), "utf8");

test("customer acceptance releases production even when Pix is still pending", () => {
  const approvals = source("apps/api/src/sales-order-approvals.controller.ts");
  assert.match(approvals, /SET status='CONFIRMED'::"SalesOrderStatus"/);
  assert.match(approvals, /orderStatus: "CONFIRMED"/);
  assert.ok(
    approvals.indexOf("await this.salesOrders.confirm") <
      approvals.indexOf("if (result.requiresPix)"),
    "bulk reservation must run before returning the pending Pix response",
  );
  assert.match(approvals, /a emissão da NF-e podem avançar/);
});

test("invoice remains independent from payment while cash shipping is protected", () => {
  const controller = source("apps/api/src/sales-orders.controller.ts");
  const service = source("apps/api/src/sales-orders.service.ts");
  assert.match(
    controller,
    /\["READY_TO_SHIP", "INVOICED"\]\.includes\(orderStatus\)/,
  );
  assert.match(service, /SalesOrderPaymentAttempt/);
  assert.match(service, /AccountsReceivable/);
  assert.match(
    service,
    /A NF-e pode ser emitida antes do pagamento, mas a expedição de uma venda à vista exige a baixa financeira/,
  );
});

test("the orders screen keeps payment pending visible without blocking fiscal preparation", () => {
  const page = source("apps/web/src/app/(system)/pedidos/page.tsx");
  assert.match(page, /A produção, a reserva e a emissão da NF-e podem avançar/);
  assert.match(page, /Liberar produção e NF-e/);
  assert.match(page, /A expedição permanece/);
  assert.doesNotMatch(
    page,
    /order\.status === "DRAFT" &&\s*\["CREATING", "AWAITING_PAYMENT"/,
  );
});

test("a late Pix confirmation preserves the operational order status", () => {
  const payments = source("apps/api/src/sales-order-payments.service.ts");
  assert.match(
    payments,
    /status=CASE WHEN status='DRAFT' THEN 'CONFIRMED'::"SalesOrderStatus" ELSE status END/,
  );
  assert.match(payments, /WHERE id=\$1 AND status<>'CANCELLED'/);
});

test("order cards receive the confirmed payment date from every financial route", () => {
  const service = source("apps/api/src/sales-orders.service.ts");
  const page = source("apps/web/src/app/(system)/pedidos/page.tsx");
  assert.match(service, /receivable\.status='PAID'/);
  assert.match(service, /attempt\.status='PAID'/);
  assert.match(
    service,
    /COALESCE\(receivable\."paymentDate",attempt\."paidAt"\) AS "paidAt"/,
  );
  assert.match(page, /Pagamento feito em/);
  assert.match(page, /formatPaymentDate\(order\.payment\?\.paidAt\)/);
  assert.match(page, /bg-emerald-50/);
});
