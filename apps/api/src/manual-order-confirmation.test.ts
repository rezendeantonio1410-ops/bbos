import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { validateManualConfirmation } from "./manual-order-confirmation";

test("confirmação pelo vendedor exige canal e quem aprovou", () => {
  assert.deepEqual(validateManualConfirmation({ channel: "whatsapp", customerContact: "  Ana  Exemplo ", note: "" }), { channel: "WHATSAPP", customerContact: "Ana Exemplo", note: null });
  assert.throws(() => validateManualConfirmation({ channel: "SMS", customerContact: "Ana" }), /Escolha como o cliente aprovou/);
  assert.throws(() => validateManualConfirmation({ channel: "PHONE", customerContact: " " }), /nome de quem aprovou/);
});

test("confirmação pelo vendedor segue as regras do link e não libera pedido à vista", () => {
  const source = readFileSync(join(__dirname, "sales-order-approvals.controller.ts"), "utf8");
  const route = source.slice(source.indexOf('@Post(":orderId/manual-confirm")'), source.indexOf('@Get(":orderId/history")'));
  assert.match(route, /assertOrderVisibleToActor/);
  assert.match(route, /termApprovals\.assertApproved/);
  assert.match(route, /SalesDiscountRequest/);
  assert.match(route, /policy\.mode === "PIX"/);
  assert.match(route, /status='APPROVED'|'APPROVED'/);
  assert.match(route, /salesOrders\.confirm/);
  assert.match(route, /confirmado por \$\{actor\.name\}/);
});
