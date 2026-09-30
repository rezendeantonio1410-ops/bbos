import assert from "node:assert/strict";
import test from "node:test";
import { resolveSalesOrderDeliveryPolicy } from "./sales-order-delivery-policy";

test("uses the Bispo platform quote for distributor delivery", () => {
  const policy = resolveSalesOrderDeliveryPolicy({
    salesChannelType: "DISTRIBUIDOR",
    freightResponsibility: "CUSTOMER",
  });

  assert.equal(policy.valid, true);
  assert.equal(policy.valid && policy.usesPlatformShipping, true);
  assert.equal(policy.valid && policy.forceFreightZero, false);
});

test("requires a named carrier when the distributor arranges transport", () => {
  const policy = resolveSalesOrderDeliveryPolicy({
    salesChannelType: "DISTRIBUIDOR",
    freightResponsibility: "CUSTOMER_CARRIER",
  });

  assert.deepEqual(policy, {
    valid: false,
    message: "Informe a transportadora indicada pelo distribuidor.",
  });
});

test("records distributor carrier without adding freight or automatic label", () => {
  const policy = resolveSalesOrderDeliveryPolicy({
    salesChannelType: "DISTRIBUIDOR",
    freightResponsibility: "CUSTOMER_CARRIER",
    carrierName: "  Transportadora Paraná  ",
  });

  assert.equal(policy.valid, true);
  assert.equal(policy.valid && policy.forceFreightZero, true);
  assert.equal(policy.valid && policy.carrierName, "Transportadora Paraná");
  assert.equal(policy.valid && policy.shippingProvider, "CUSTOMER_CARRIER");
});

test("pickup has zero freight and no carrier", () => {
  const policy = resolveSalesOrderDeliveryPolicy({
    salesChannelType: "DISTRIBUIDOR",
    freightResponsibility: "PICKUP",
    carrierName: "should be ignored",
  });

  assert.equal(policy.valid, true);
  assert.equal(policy.valid && policy.forceFreightZero, true);
  assert.equal(policy.valid && policy.carrierName, null);
  assert.equal(policy.valid && policy.shippingProvider, "PICKUP");
  assert.equal(policy.valid && policy.shippingServiceName, "Retirada na Bispo Coffees");
});
