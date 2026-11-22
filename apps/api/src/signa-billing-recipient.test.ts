import assert from "node:assert/strict";
import test from "node:test";
import { selectSignaFiscalRecipient } from "./signa-billing-recipient";
import { parseBillableUnitPrice } from "./partner-price-validation";

const recipients = [
  { id: "signa-cnpj", documentType: "CNPJ" as const },
  { id: "rodrigo-cpf", documentType: "CPF" as const },
];

test("mantém Signa como conta exclusiva de preços quando a NF-e é para Signa", () => {
  const pricingCustomerId = "signa-cnpj";
  assert.equal(
    selectSignaFiscalRecipient(pricingCustomerId, "signa-cnpj", recipients),
    pricingCustomerId,
  );
});

test("permite Rodrigo como destinatário fiscal sem trocar a conta de preços", () => {
  const pricingCustomerId = "signa-cnpj";
  const recipient = selectSignaFiscalRecipient(
    pricingCustomerId,
    "rodrigo-cpf",
    recipients,
  );
  assert.equal(recipient, "rodrigo-cpf");
  assert.equal(pricingCustomerId, "signa-cnpj");
});

test("rejeita IDs arbitrários, ausência de escolha e contas de preços externas", () => {
  assert.equal(selectSignaFiscalRecipient("signa-cnpj", "", recipients), null);
  assert.equal(
    selectSignaFiscalRecipient("signa-cnpj", "other-company", recipients),
    null,
  );
  assert.equal(
    selectSignaFiscalRecipient("other-pricing-account", "rodrigo-cpf", recipients),
    null,
  );
  assert.equal(
    selectSignaFiscalRecipient("rodrigo-cpf", "rodrigo-cpf", recipients),
    null,
  );
  assert.equal(
    selectSignaFiscalRecipient("signa-cnpj", "rodrigo-cpf", []),
    null,
  );
});

test("preços exclusivos válidos do Reserva são aceitos a partir do valor do banco", () => {
  assert.equal(parseBillableUnitPrice("38.00"), 38);
  assert.equal(parseBillableUnitPrice("76.80"), 76.8);
  assert.equal(parseBillableUnitPrice("148.00"), 148);
});

test("não permite pedidos ou cotações com preços nulos, gratuitos ou inválidos", () => {
  for (const value of [null, undefined, "", "  ", 0, "0", -1, "-1.00", "NaN", NaN, Infinity, -Infinity, "Infinity", "wrong", {}, 0.001]) {
    assert.equal(parseBillableUnitPrice(value), null, String(value));
  }
  assert.equal(parseBillableUnitPrice("0.01"), 0.01);
});

test("preços privados exigem valores em centavos, sem arredondamento implícito", () => {
  for (const invalid of [
    0.011, 76.801, "76.805", "76.8001", "7.68e1", "0x4c",
    "76,80", "76.80abc", "0.009", "999999999999999.99",
  ]) {
    assert.equal(parseBillableUnitPrice(invalid), null, String(invalid));
  }
  for (const [value, expected] of [
    ["76.8000", 76.8],
    [" 76.80 ", 76.8],
    [76.8, 76.8],
    [148, 148],
    [0.29, 0.29],
  ] as const) {
    assert.equal(parseBillableUnitPrice(value), expected, String(value));
  }
});
