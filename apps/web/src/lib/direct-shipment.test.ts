import assert from "node:assert/strict";
import test from "node:test";
import { directShipmentAddress, directShipmentStatus, fileSize, formatPostalCode } from "./direct-shipment";

test("CEP e endereço legíveis", () => {
  assert.equal(formatPostalCode("01310100"), "01310-100");
  assert.deepEqual(
    directShipmentAddress({ street: "Av. Exemplo", number: "100", complement: "Sala 2", district: "Centro", city: "São Paulo", state: "SP", postalCode: "01310100" }),
    ["Av. Exemplo, 100 · Sala 2", "Centro · São Paulo/SP", "CEP 01310-100"],
  );
});

test("situação do envio direto", () => {
  assert.equal(directShipmentStatus({ status: "AWAITING_POST", postedAt: null, documents: [] }).label, "Falta a etiqueta");
  assert.equal(directShipmentStatus({ status: "AWAITING_POST", postedAt: null, hasLabel: true }).tone, "ready");
  assert.equal(directShipmentStatus({ status: "POSTED", postedAt: "2026-11-27T15:00:00Z" }).tone, "done");
});

test("tamanho de arquivo", () => {
  assert.equal(fileSize(300 * 1024), "300 KB");
  assert.equal(fileSize(2.5 * 1024 * 1024), "2,5 MB");
});
