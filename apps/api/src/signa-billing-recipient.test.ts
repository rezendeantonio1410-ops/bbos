import assert from "node:assert/strict";
import test from "node:test";
import { selectSignaFiscalRecipient } from "./signa-billing-recipient";

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
