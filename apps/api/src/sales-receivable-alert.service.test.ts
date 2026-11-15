import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  salesOverdueMessage,
  salesOverdueNotificationType,
} from "./sales-receivable-alert.service";
import {
  deliveryExceptionShipmentId,
  keepCurrentCreditDecisions,
  keepOpenDeliveryExceptions,
  notificationHref,
} from "./notification-links";

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

test("notificações mostram somente a decisão de crédito atual por cliente", () => {
  const items = keepCurrentCreditDecisions([
    { id: "new", type: "CREDIT_DECISION:customer-1:event-new" },
    { id: "other", type: "CREDIT_DECISION:customer-2:event-other" },
    { id: "old", type: "CREDIT_DECISION:customer-1:event-old" },
    { id: "visit", type: "SALES_VISIT:customer-1" },
  ]);

  assert.deepEqual(
    items.map((item) => item.id),
    ["new", "other", "visit"],
  );
});

test("notificações de entrega encerradas deixam de aparecer como críticas", () => {
  const items = [
    {
      id: "open",
      type: "ORDER_DELIVERY_EXCEPTION:shipment-open:ADMIN",
    },
    {
      id: "resolved",
      type: "ORDER_DELIVERY_EXCEPTION:shipment-resolved:ADMIN",
    },
    { id: "credit", type: "CREDIT_REQUEST:customer-1:ADMIN:event-1" },
  ];

  assert.equal(
    deliveryExceptionShipmentId(items[0]!.type),
    "shipment-open",
  );
  assert.deepEqual(
    keepOpenDeliveryExceptions(items, new Set(["shipment-open"])).map(
      (item) => item.id,
    ),
    ["open", "credit"],
  );
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
