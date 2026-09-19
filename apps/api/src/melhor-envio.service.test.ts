import assert from "node:assert/strict";
import test from "node:test";
import { MelhorEnvioService } from "./melhor-envio.service";

const environment = { ...process.env };

test.afterEach(() => {
  process.env = { ...environment };
  delete (globalThis as any).fetch;
});

test("maps and orders valid Melhor Envio quotes", async () => {
  process.env.MELHOR_ENVIO_API_URL = "https://shipping.example";
  process.env.MELHOR_ENVIO_ACCESS_TOKEN = "secret-token";
  process.env.MELHOR_ENVIO_ORIGIN_POSTAL_CODE = "86010-010";
  let request: { url?: string; init?: RequestInit } = {};
  (globalThis as any).fetch = async (url: string, init: RequestInit) => {
    request = { url, init };
    return new Response(
      JSON.stringify([
        {
          id: 2,
          name: "SEDEX",
          custom_price: "31.40",
          custom_delivery_time: 2,
          company: { name: "Correios" },
        },
        {
          id: 1,
          name: "PAC",
          price: "18.90",
          delivery_time: 6,
          company: { name: "Correios" },
        },
        { id: 99, name: "Indisponível", error: "sem cobertura" },
      ]),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  const result = await new MelhorEnvioService().calculate({
    postalCode: "01310-100",
    subtotalCents: 13600,
    weightGrams: 1000,
  });

  assert.equal(
    request.url,
    "https://shipping.example/api/v2/me/shipment/calculate",
  );
  assert.match(
    String((request.init?.headers as any).Authorization),
    /^Bearer /,
  );
  assert.deepEqual(
    result.map((quote) => [
      quote.providerServiceId,
      quote.commercialPriceCents,
    ]),
    [
      [1, 1890],
      [2, 3140],
    ],
  );
  const sent = JSON.parse(String(request.init?.body));
  assert.equal(sent.from.postal_code, "86010010");
  assert.equal(sent.to.postal_code, "01310100");
  assert.equal(sent.products[0].weight, 1);
});

test("creates, purchases, generates and prints a shipment in order", async () => {
  process.env.MELHOR_ENVIO_API_URL = "https://shipping.example";
  process.env.MELHOR_ENVIO_ACCESS_TOKEN = "secret-token";
  process.env.MELHOR_ENVIO_SENDER_JSON = JSON.stringify({
    name: "Bispo Coffees Ltda",
    email: "pedidos@example.com",
    phone: "43999999999",
    company_document: "13008726000112",
    state_register: "9120194892",
    address: "Rua Exemplo",
    number: "1",
    district: "Centro",
    city: "Londrina",
    postal_code: "86010010",
    state_abbr: "PR",
  });
  const calls: Array<{ path: string; body: any }> = [];
  (globalThis as any).fetch = async (url: string, init: RequestInit) => {
    const path = new URL(url).pathname;
    calls.push({ path, body: JSON.parse(String(init.body)) });
    if (path.endsWith("/cart"))
      return new Response(JSON.stringify({ id: "shipment-1" }), {
        status: 201,
      });
    if (path.endsWith("/print"))
      return new Response(JSON.stringify({ url: "https://label.example/1" }), {
        status: 200,
      });
    return new Response(JSON.stringify({}), { status: 200 });
  };

  const service = new MelhorEnvioService();
  const created = await service.createShipment({
    serviceId: 1,
    orderCode: "WEB-1",
    invoiceKey: "1".repeat(44),
    recipient: {
      name: "Cliente",
      email: "cliente@example.com",
      phone: "11999999999",
      document: "12345678909",
      address: "Avenida Cliente",
      number: "10",
      district: "Centro",
      city: "São Paulo",
      postal_code: "01310100",
      state_abbr: "SP",
    },
    products: [{ name: "Caramelo", quantity: 2, unitaryValueCents: 6800 }],
    weightGrams: 1000,
    insuredValueCents: 13600,
  });
  const completed = await service.completeShipment(created.providerShipmentId);

  assert.equal(created.providerShipmentId, "shipment-1");
  assert.equal(completed.labelUrl, "https://label.example/1");
  assert.deepEqual(
    calls.map((call) => call.path),
    [
      "/api/v2/me/cart",
      "/api/v2/me/shipment/checkout",
      "/api/v2/me/shipment/generate",
      "/api/v2/me/shipment/print",
    ],
  );
  assert.equal(calls[0]?.body.options.invoice.key, "1".repeat(44));
  assert.equal(calls[0]?.body.from.company_document, "13008726000112");
});
