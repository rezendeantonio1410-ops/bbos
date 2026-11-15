import assert from "node:assert/strict";
import test from "node:test";
import { resolveSalesOrderDeliveryPolicy } from "./sales-order-delivery-policy";
import { assessMelhorEnvioRecipient } from "./melhor-envio-recipient-policy";

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
  assert.equal(
    policy.valid && policy.shippingServiceName,
    "Retirada na Bispo Coffees",
  );
});

const validRecipient = {
  name: "Alexandre Campanholi",
  phone: "(41) 99918-8623",
  email: "a.campanholi@example.com",
  document: "030.477.839-77",
  address: "Professor João Duck Filho",
  number: "107",
  complement: "Sobrado marrom",
  district: "Xaxim",
  city: "Curitiba",
  state: "PR",
  postalCode: "81830-250",
  quotedPostalCode: "81830250",
};

test("prepares a structured recipient without losing the address number", () => {
  const result = assessMelhorEnvioRecipient(validRecipient);

  assert.equal(result.ready, true);
  assert.equal(result.recipient.address, "Professor João Duck Filho");
  assert.equal(result.recipient.number, "107");
  assert.equal(result.recipient.postal_code, "81830250");
});

test("blocks missing or placeholder numbers before calling Melhor Envio", () => {
  for (const number of ["", "S/N", "SN", "Sem número", "0"]) {
    const result = assessMelhorEnvioRecipient({ ...validRecipient, number });
    assert.equal(result.ready, false);
    assert.ok(result.issues.includes("número real do endereço (não use S/N)"));
  }
});

test("blocks a destination CEP that differs from the freight quote", () => {
  const result = assessMelhorEnvioRecipient({
    ...validRecipient,
    postalCode: "81830-250",
    quotedPostalCode: "86027-750",
  });

  assert.equal(result.ready, false);
  assert.ok(
    result.issues.includes("CEP diferente daquele usado na cotação do frete"),
  );
});

test("blocks conflicting numbers instead of guessing which one is correct", () => {
  const result = assessMelhorEnvioRecipient({
    ...validRecipient,
    address: "Professor João Duck Filho, 109",
    number: "107",
  });

  assert.equal(result.ready, false);
  assert.ok(
    result.issues.includes("número divergente entre logradouro e campo Número"),
  );
});
