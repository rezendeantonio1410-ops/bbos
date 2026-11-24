import assert from "node:assert/strict";
import test from "node:test";
import { addressLine, directionsUrl, formatCnpj, formatDistance, formatPhone, matchesSearch, rhythmText } from "./prospecting";

test("formats CNPJ, phone and distance for the field team", () => {
  assert.equal(formatCnpj("31536243000172"), "31.536.243/0001-72");
  assert.equal(formatCnpj("123"), "123");
  assert.equal(formatPhone("43988273546"), "(43) 98827-3546");
  assert.equal(formatPhone("4331544030"), "(43) 3154-4030");
  assert.equal(formatDistance(0.234), "230 m");
  assert.equal(formatDistance(0.004), "10 m");
  assert.equal(formatDistance(2.46), "2,5 km");
  assert.equal(formatDistance(12.4), "12 km");
});

test("address, directions and accent-free search", () => {
  assert.equal(addressLine({ address: "Rua Santos", addressNumber: "86", district: "Vila Salomé", city: "Londrina" }), "Rua Santos, 86 · Vila Salomé · Londrina");
  assert.equal(addressLine({ city: "Cambé" }), "Cambé");
  assert.equal(directionsUrl(-23.3, -51.16), "https://www.google.com/maps/dir/?api=1&destination=-23.300000,-51.160000");
  assert.ok(matchesSearch("Natû Funcional · Rua Santos", "natu santos"));
  assert.ok(!matchesSearch("Pane Puro", "padaria"));
});

test("buying rhythm sentence", () => {
  assert.equal(rhythmText(null), "Sem pedidos nos últimos 2 anos");
  assert.equal(rhythmText({ orders: 1, usualIntervalDays: null, daysSinceLastOrder: 9, overdueDays: 0 }), "Último pedido há 9 dias");
  assert.equal(
    rhythmText({ orders: 4, usualIntervalDays: 14, daysSinceLastOrder: 24, overdueDays: 10 }),
    "Compra a cada ~14 dias · último há 24 (10 de atraso)",
  );
});
