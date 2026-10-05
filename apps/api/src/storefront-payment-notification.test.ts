import assert from "node:assert/strict";
import test from "node:test";
import { StorefrontLifecycleService } from "./storefront-lifecycle.service";

test("pagamento aprovado enfileira um único e-mail transacional", async () => {
  const previousTrackingSecret = process.env.ORDER_TRACKING_SECRET;
  const previousStorefrontUrl = process.env.STOREFRONT_WEB_URL;
  const previousOperationsEmail = process.env.STOREFRONT_OPERATIONS_EMAIL;
  process.env.ORDER_TRACKING_SECRET = "test-tracking-secret";
  process.env.STOREFRONT_WEB_URL = "https://loja.bispocoffees.com.br";
  process.env.STOREFRONT_OPERATIONS_EMAIL =
    "PREPARO@BISPOCOFFEES.COM.BR, logistica@bispocoffees.com.br";

  const outboxWrites: unknown[][] = [];
  let eventAlreadyExists = false;
  const transaction = {
    $queryRawUnsafe: async (query: string) => {
      if (query.includes('FROM "StorefrontOrder"')) {
        return [
          {
            id: "order-1",
            companyId: "company-1",
            code: "WEB-20261004-ABC123",
            customer: {
              name: "José Rezende",
              email: " JOSE@EXAMPLE.COM ",
            },
            delivery: { city: "Londrina", state: "PR" },
            items: [{ name: "Caramelo", quantity: 1 }],
            subtotalCents: 6800,
            shippingCents: 1500,
            totalCents: 8300,
            shippingServiceName: "PAC",
            carrierName: "Correios",
            estimatedDeliveryDays: 4,
          },
        ];
      }
      if (query.includes('INSERT INTO "StorefrontOrderEvent"')) {
        return eventAlreadyExists ? [] : [{ id: "event-1" }];
      }
      throw new Error(`Consulta inesperada no teste: ${query}`);
    },
    $executeRawUnsafe: async (...args: unknown[]) => {
      outboxWrites.push(args);
      return 1;
    },
  };
  const service = new StorefrontLifecycleService();
  Object.defineProperty(service, "database", {
    value: {
      $transaction: async (
        operation: (client: typeof transaction) => unknown,
      ) => operation(transaction),
    },
  });

  try {
    await service.record(
      "order-1",
      "PAYMENT_CONFIRMED",
      "Pagamento confirmado",
      "Seu pagamento foi aprovado e o pedido seguirá para preparação.",
      "MERCADO_PAGO",
      "storefront:payment-confirmed:order-1",
      { externalId: "payment-1", provider: "MERCADO_PAGO" },
    );

    assert.equal(outboxWrites.length, 3);
    const [outboxWrite, preparationWrite, logisticsWrite] = outboxWrites;
    assert.ok(outboxWrite && preparationWrite && logisticsWrite);
    const [, , , , destination, serializedPayload, idempotencyKey] =
      outboxWrite.slice(1);
    assert.equal(destination, "jose@example.com");
    assert.equal(
      idempotencyKey,
      "notify:email:storefront:payment-confirmed:order-1",
    );
    const payload = JSON.parse(String(serializedPayload));
    assert.equal(payload.eventType, "PAYMENT_CONFIRMED");
    assert.equal(payload.title, "Pagamento confirmado");
    assert.equal(payload.orderCode, "WEB-20261004-ABC123");
    assert.match(
      payload.trackingUrl,
      /^https:\/\/loja\.bispocoffees\.com\.br\/loja\/pedido\/order-1\?token=/,
    );
    assert.match(String(preparationWrite[0]), /'ORDER_PREPARATION'/);
    assert.equal(preparationWrite[5], "preparo@bispocoffees.com.br");
    assert.equal(logisticsWrite[5], "logistica@bispocoffees.com.br");
    assert.equal(
      preparationWrite[7],
      "notify:operations:storefront:payment-confirmed:order-1:preparo@bispocoffees.com.br",
    );

    eventAlreadyExists = true;
    await service.record(
      "order-1",
      "PAYMENT_CONFIRMED",
      "Pagamento confirmado",
      "Seu pagamento foi aprovado e o pedido seguirá para preparação.",
      "MERCADO_PAGO",
      "storefront:payment-confirmed:order-1",
      { externalId: "payment-1", provider: "MERCADO_PAGO" },
    );

    assert.equal(outboxWrites.length, 3);
  } finally {
    if (previousTrackingSecret === undefined) {
      delete process.env.ORDER_TRACKING_SECRET;
    } else {
      process.env.ORDER_TRACKING_SECRET = previousTrackingSecret;
    }
    if (previousStorefrontUrl === undefined) {
      delete process.env.STOREFRONT_WEB_URL;
    } else {
      process.env.STOREFRONT_WEB_URL = previousStorefrontUrl;
    }
    if (previousOperationsEmail === undefined) {
      delete process.env.STOREFRONT_OPERATIONS_EMAIL;
    } else {
      process.env.STOREFRONT_OPERATIONS_EMAIL = previousOperationsEmail;
    }
  }
});
