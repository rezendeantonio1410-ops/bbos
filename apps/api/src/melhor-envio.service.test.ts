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
