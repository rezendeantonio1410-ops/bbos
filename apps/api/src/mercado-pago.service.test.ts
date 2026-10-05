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
    process.env.MERCADO_PAGO_ACCESS_TOKEN =
      "APP_USR-fake-production-like-token";
    let payload: any;
    globalThis.fetch = async (_url, init) => {
      payload = JSON.parse(String(init?.body));
      return new Response(
        JSON.stringify({
          id: "ORD-123",
          checkout_url: "https://example.com/pay",
        }),
        { status: 200 },
      );
    };
    await new MercadoPagoService().createCheckout({
      paymentMethod: method,
      idempotencyKey: "test-idempotency-key",
      orderCode: "WEB-TEST",
      totalCents: 5200,
      shippingCents: 0,
      items: [
        {
          externalCode: "cafe",
          title: "Café",
          quantity: 1,
          unitPriceCents: 5200,
        },
      ],
      payer: {
        name: "Cliente Teste",
        email: "cliente@example.com",
        phone: "43999999999",
        cpf: "12345678909",
      },
      delivery: {
        postalCode: "86000000",
        street: "Rua Teste",
        number: "1",
        district: "Centro",
        city: "Londrina",
        state: "PR",
      },
    });
    const excluded = payload.config.payment_method.not_allowed_types;
    assert.equal(excluded.includes("bank_transfer"), method === "CARD");
    assert.equal(excluded.includes("credit_card"), method === "PIX");
    assert.equal(excluded.includes("debit_card"), method === "PIX");
    assert.equal(payload.config.online.callback_url, undefined);
    assert.equal(payload.external_reference, "WEB-TEST");
  });
}

test("Pix direto preserva idempotência e devolve QR Code", async () => {
  process.env.MERCADO_PAGO_ACCESS_TOKEN = "APP_USR-fake-production-like-token";
  let requestUrl = "";
  let requestHeaders: HeadersInit | undefined;
  let payload: any;
  globalThis.fetch = async (url, init) => {
    requestUrl = String(url);
    requestHeaders = init?.headers;
    payload = JSON.parse(String(init?.body));
    return new Response(
      JSON.stringify({
        id: "ORD-PIX-123",
        status: "action_required",
        transactions: {
          payments: [
            {
              id: "PAY-PIX-123",
              status: "pending",
              payment_method: {
                id: "pix",
                type: "bank_transfer",
                ticket_url: "https://example.com/pix",
                qr_code: "00020101021226890014br.gov.bcb.pix",
                qr_code_base64: "cGl4",
              },
            },
          ],
        },
      }),
      { status: 200 },
    );
  };

  const result = await new MercadoPagoService().createPix({
    paymentMethod: "PIX",
    idempotencyKey: "pix-idempotency-key",
    orderCode: "WEB-PIX-TEST",
    totalCents: 6800,
    shippingCents: 0,
    items: [
      {
        externalCode: "caramelo",
        title: "Caramelo",
        quantity: 1,
        unitPriceCents: 6800,
      },
    ],
    payer: {
      name: "Cliente Teste",
      email: "cliente@example.com",
      phone: "43999999999",
      cpf: "12345678909",
    },
    delivery: {
      postalCode: "86000000",
      street: "Rua Teste",
      number: "1",
      district: "Centro",
      city: "Londrina",
      state: "PR",
    },
  });

  assert.equal(requestUrl, "https://api.mercadopago.com/v1/orders");
  assert.equal(
    (requestHeaders as Record<string, string>)["X-Idempotency-Key"],
    "pix-idempotency-key",
  );
  assert.equal(payload.external_reference, "WEB-PIX-TEST");
  assert.equal(payload.transactions.payments[0].payment_method.id, "pix");
  assert.equal(
    payload.transactions.payments[0].payment_method.type,
    "bank_transfer",
  );
  assert.equal(result.pix?.qrCode, "00020101021226890014br.gov.bcb.pix");
  assert.equal(result.pix?.qrCodeBase64, "cGl4");
});

test("cancelamento encerra a order anterior com chave idempotente", async () => {
  process.env.MERCADO_PAGO_ACCESS_TOKEN = "APP_USR-fake-production-like-token";
  let requestUrl = "";
  let requestMethod = "";
  let requestHeaders: HeadersInit | undefined;
  globalThis.fetch = async (url, init) => {
    requestUrl = String(url);
    requestMethod = String(init?.method);
    requestHeaders = init?.headers;
    return new Response(
      JSON.stringify({ id: "ORD-PENDING-123", status: "canceled" }),
      { status: 200 },
    );
  };

  const result = await new MercadoPagoService().cancelOrder(
    "ORD-PENDING-123",
    "cancel-idempotency-key",
  );

  assert.equal(
    requestUrl,
    "https://api.mercadopago.com/v1/orders/ORD-PENDING-123/cancel",
  );
  assert.equal(requestMethod, "POST");
  assert.equal(
    (requestHeaders as Record<string, string>)["X-Idempotency-Key"],
    "cancel-idempotency-key",
  );
  assert.equal(result.status, "canceled");
});

test("credencial de teste continua bloqueada no checkout real", async () => {
  process.env.MERCADO_PAGO_ACCESS_TOKEN = "TEST-blocked-token";
  await assert.rejects(
    () =>
      new MercadoPagoService().createPix({
        paymentMethod: "PIX",
        idempotencyKey: "blocked-key",
        orderCode: "WEB-BLOCKED",
        totalCents: 5200,
        shippingCents: 0,
        items: [
          {
            externalCode: "essencial",
            title: "Essencial",
            quantity: 1,
            unitPriceCents: 5200,
          },
        ],
        payer: {
          name: "Cliente Teste",
          email: "cliente@example.com",
          phone: "43999999999",
          cpf: "12345678909",
        },
        delivery: {
          postalCode: "86000000",
          street: "Rua Teste",
          number: "1",
          district: "Centro",
          city: "Londrina",
          state: "PR",
        },
      }),
    /credencial de teste/i,
  );
});
