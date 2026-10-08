import assert from "node:assert/strict";
import test from "node:test";
import { melhorEnvioSenderFiscalFields } from "./melhor-envio-shipment.service";

test("identifies Bispo as a company without sending the owner's CPF", () => {
  const fields = melhorEnvioSenderFiscalFields({
    companyDocument: "13.008.726/0001-12",
    personalDocument: "123.456.789-09",
    stateRegister: "90.123.456-78",
  });

  assert.deepEqual(fields, {
    company_document: "13008726000112",
    state_register: "9012345678",
  });
  assert.equal("document" in fields, false);
});

test("uses a personal document only when no company document is configured", () => {
  const fields = melhorEnvioSenderFiscalFields({
    companyDocument: "",
    personalDocument: "123.456.789-09",
  });

  assert.deepEqual(fields, { document: "12345678909" });
  assert.equal("company_document" in fields, false);
});

test("rejects an incomplete company registration", () => {
  assert.throws(
    () =>
      melhorEnvioSenderFiscalFields({
        companyDocument: "13.008.726/0001-12",
        stateRegister: "",
      }),
    /SHIPPING_SENDER_STATE_REGISTER não configurado/,
  );
});
