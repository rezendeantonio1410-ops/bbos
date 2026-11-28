import assert from "node:assert/strict";
import test from "node:test";
import { parseDeliveryDateChange, RESCHEDULABLE_DELIVERY } from "./delivery-date-change";

const now = new Date("2026-11-28T18:00:00Z"); // sábado, 15h em São Paulo

test("remarca para segunda 30/11 com motivo, gravando o dia certo", () => {
  const change = parseDeliveryDateChange({ deliveryDate: "2026-11-30", reason: "Data lançada errada; combinado para segunda." }, now);
  assert.equal(change.deliveryDate.toISOString(), "2026-11-30T00:00:00.000Z");
  assert.equal(change.reason, "Data lançada errada; combinado para segunda.");
});

test("aceita hoje, recusa passado, data inválida, motivo curto e campos extras", () => {
  assert.equal(parseDeliveryDateChange({ deliveryDate: "2026-11-28", reason: "Entrega hoje mesmo à tarde." }, now).deliveryDate.toISOString().slice(0, 10), "2026-11-28");
  assert.throws(() => parseDeliveryDateChange({ deliveryDate: "2026-11-27", reason: "motivo suficiente aqui" }, now), /passado/);
  assert.throws(() => parseDeliveryDateChange({ deliveryDate: "2026-02-30", reason: "motivo suficiente aqui" }, now), /inválida/);
  assert.throws(() => parseDeliveryDateChange({ deliveryDate: "2026-12-01", reason: "curto" }, now), /motivo/);
  assert.throws(() => parseDeliveryDateChange({ deliveryDate: "2026-12-01", reason: "motivo suficiente aqui", status: "X" }, now), /não permitidos/);
});

test("pedido entregue, enviado ou cancelado não é remarcado", () => {
  assert.ok((RESCHEDULABLE_DELIVERY as readonly string[]).includes("READY_TO_SHIP"));
  for (const s of ["DELIVERED", "SHIPPED", "CANCELLED"]) assert.equal((RESCHEDULABLE_DELIVERY as readonly string[]).includes(s), false);
});
