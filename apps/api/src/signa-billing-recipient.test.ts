import assert from "node:assert/strict";
import test from "node:test";
import { selectSignaFiscalRecipient } from "./signa-billing-recipient";
import { parseBillableUnitPrice } from "./partner-price-validation";
import { Prisma } from "@bbos/database";

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

test("preços vindos do banco como Prisma.Decimal (consulta SQL direta) são aceitos", () => {
  assert.equal(parseBillableUnitPrice(new Prisma.Decimal("38.00")), 38);
  assert.equal(parseBillableUnitPrice(new Prisma.Decimal("76.80")), 76.8);
  assert.equal(parseBillableUnitPrice(new Prisma.Decimal("148")), 148);
  for (const invalid of ["0", "-1"]) {
    assert.equal(parseBillableUnitPrice(new Prisma.Decimal(invalid)), null, invalid);
  }
});
