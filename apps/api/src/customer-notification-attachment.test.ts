import assert from "node:assert/strict";
import test from "node:test";
import { CustomerNotificationService } from "./customer-notification.service";

test("sends the partner notification with the customer order PDF attached", async () => {
  const previous = {
    apiKey: process.env.RESEND_API_KEY,
    from: process.env.STOREFRONT_FROM_EMAIL,
    enabledAt: process.env.CUSTOMER_NOTIFICATIONS_ENABLED_AT,
    fetch: globalThis.fetch,
  };
  process.env.RESEND_API_KEY = "test-key";
  process.env.STOREFRONT_FROM_EMAIL = "Bispo <pedidos@example.com>";
  process.env.CUSTOMER_NOTIFICATIONS_ENABLED_AT = "2026-01-01T00:00:00.000Z";

  let requestBody: any;
  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    requestBody = JSON.parse(String(init?.body || "{}"));
    return new Response(JSON.stringify({ id: "email-1" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const service = new CustomerNotificationService();
    Object.defineProperty(service, "database", {
      value: {
        $queryRawUnsafe: async () => [
          {
            id: "notification-1",
            channel: "EMAIL",
            destination: "gustavo@example.com",
            template: "PARTNER_ORDER_CONFIRMED",
            attempts: 1,
            payload: {
              partnerName: "Gustavo",
              orderCode: "B-2026-000123",
              customerName: "Cliente Exemplo",
              packageQuantity: 1,
              commissionMode: "PER_PACKAGE",
              commissionPerPackageCents: 250,
              commissionAmountCents: 250,
              subtotalCents: 4200,
              totalCents: 4200,
              items: [
                {
                  name: "Café Gourmet White Label · 500 g",
                  quantity: 1,
                  unitPriceCents: 4200,
                  totalCents: 4200,
                },
              ],
            },
          },
        ],
        $executeRawUnsafe: async () => 1,
      },
    });

    const result = await service.processNext();
    assert.deepEqual(result, {
      processed: true,
      sent: true,
      id: "notification-1",
    });
    assert.equal(requestBody.attachments.length, 1);
    assert.equal(
      requestBody.attachments[0].filename,
      "Pedido-B-2026-000123.pdf",
    );
    const attachment = Buffer.from(requestBody.attachments[0].content, "base64");
    assert.equal(attachment.subarray(0, 8).toString("latin1"), "%PDF-1.4");
  } finally {
    if (previous.apiKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = previous.apiKey;
    if (previous.from === undefined) delete process.env.STOREFRONT_FROM_EMAIL;
    else process.env.STOREFRONT_FROM_EMAIL = previous.from;
    if (previous.enabledAt === undefined)
      delete process.env.CUSTOMER_NOTIFICATIONS_ENABLED_AT;
    else process.env.CUSTOMER_NOTIFICATIONS_ENABLED_AT = previous.enabledAt;
    globalThis.fetch = previous.fetch;
  }
});

