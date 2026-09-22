import assert from "node:assert/strict";
import test from "node:test";
import { selectCustomerShippingOptions } from "./storefront-shipping-selection";

const quote = (serviceId: string, providerPriceCents: number, deliveryDays: number) => ({
  serviceId,
  providerPriceCents,
  deliveryDays,
});

test("returns only the cheapest and the fastest shipping options", () => {
  const result = selectCustomerShippingOptions([
    quote("PAC", 2448, 15),
    quote("SEDEX", 2966, 11),
    quote("PACKAGE", 4375, 8),
    quote("COM", 4434, 7),
    quote("EXPRESSO", 7174, 7),
  ]);

  assert.deepEqual(
    result.map(({ serviceId, customerLabel }) => ({ serviceId, customerLabel })),
    [
      { serviceId: "PAC", customerLabel: "Mais econômico" },
      { serviceId: "COM", customerLabel: "Mais rápido" },
    ],
  );
});

test("uses delivery time to break a price tie", () => {
  const result = selectCustomerShippingOptions([
    quote("SLOW", 2000, 10),
    quote("FAST", 2000, 5),
  ]);

  assert.equal(result.length, 1);
  assert.equal(result[0]?.serviceId, "FAST");
  assert.equal(result[0]?.customerLabel, "Mais econômico e rápido");
});

test("uses price to break a delivery-time tie", () => {
  const result = selectCustomerShippingOptions([
    quote("EXPENSIVE", 3000, 5),
    quote("CHEAP", 2000, 5),
  ]);

  assert.equal(result.length, 1);
  assert.equal(result[0]?.serviceId, "CHEAP");
});

test("returns the single available option once", () => {
  const result = selectCustomerShippingOptions([quote("ONLY", 2500, 6)]);

  assert.equal(result.length, 1);
  assert.equal(result[0]?.serviceId, "ONLY");
  assert.equal(result[0]?.customerLabel, "Mais econômico e rápido");
});

test("returns only the lowest provider cost when shipping is free", () => {
  const result = selectCustomerShippingOptions([
    quote("STANDARD", 1455, 3),
    quote("EXPRESS", 1958, 2),
  ], true);

  assert.equal(result.length, 1);
  assert.equal(result[0]?.serviceId, "STANDARD");
  assert.equal(result[0]?.customerLabel, "Mais econômico");
});
