import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { MercadoPagoService } from "./mercado-pago.service";

const originalFetch = globalThis.fetch;
const originalToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalToken === undefined) delete process.env.MERCADO_PAGO_ACCESS_TOKEN;
  else process.env.MERCADO_PAGO_ACCESS_TOKEN = originalToken;
});

for (const method of ["PIX", "CARD"] as const) {
  test(`Checkout Pro exclui as formas incompatíveis com ${method}`, async () => {
    process.env.MERCADO_PAGO_ACCESS_TOKEN = "test-token";
    let payload: any;
    globalThis.fetch = async (_url, init) => {
      payload = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ id: "ORD-123", checkout_url: "https://example.com/pay" }), { status: 200 });
    };
    await new MercadoPagoService().createCheckout({
      paymentMethod: method,
      idempotencyKey: "test-idempotency-key",
      orderCode: "WEB-TEST",
      totalCents: 5200,
      shippingCents: 0,
      items: [{ externalCode: "cafe", title: "Café", quantity: 1, unitPriceCents: 5200 }],
      payer: { name: "Cliente Teste", email: "cliente@example.com", phone: "43999999999", cpf: "12345678909" },
      delivery: { postalCode: "86000000", street: "Rua Teste", number: "1", district: "Centro", city: "Londrina", state: "PR" },
    });
    const excluded = payload.config.payment_method.not_allowed_types;
    assert.equal(excluded.includes("bank_transfer"), method === "CARD");
    assert.equal(excluded.includes("credit_card"), method === "PIX");
    assert.equal(excluded.includes("debit_card"), method === "PIX");
    assert.equal(payload.config.online.callback_url, undefined);
    assert.equal(payload.external_reference, "WEB-TEST");
  });
}
