import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  salesOverdueMessage,
  salesOverdueNotificationType,
} from "./sales-receivable-alert.service";
import { notificationHref } from "./notification-links";

test("alerta de atraso direciona o vendedor ao cadastro do cliente", () => {
  const type = salesOverdueNotificationType("customer-1", "receivable-1");
  assert.equal(type, "SALES_RECEIVABLE_OVERDUE:customer-1:receivable-1");
  assert.equal(notificationHref(type, null), "/clientes?cliente=customer-1");
});

test("mensagem informa cliente, pedido, valor e dias de atraso", () => {
  const message = salesOverdueMessage({
    customerName: "Cafeteria Central",
    orderNumber: "B-2026-42",
    openAmount: 1250,
    daysOverdue: 4,
  });
  assert.match(message, /Cafeteria Central/);
  assert.match(message, /B-2026-42/);
  assert.match(message, /1\.250,00/);
  assert.match(message, /4 dia/);
});

test("varredura considera somente recebíveis realmente vencidos e notifica SALES", () => {
  const source = readFileSync(
    join(__dirname, "sales-receivable-alert.service.ts"),
    "utf8",
  );
  assert.match(source, /ar\.status NOT IN \('PAID','CANCELLED'\)/);
  assert.match(source, /ar\."dueDate" < CURRENT_DATE/);
  assert.match(source, /'SALES'/);
  assert.match(source, /ON CONFLICT DO NOTHING/);
});
