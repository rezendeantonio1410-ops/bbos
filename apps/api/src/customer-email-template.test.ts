import test from "node:test";
import assert from "node:assert/strict";
import { renderCustomerEmail } from "./customer-email-template";

test("renders the approved Bispo transactional email with escaped order data", () => {
  const html = renderCustomerEmail(
    {
      title: "Pagamento confirmado",
      detail: "Seu pagamento foi aprovado.",
      eventType: "PAYMENT_CONFIRMED",
      orderCode: "WEB-20260919-ABC123",
      trackingUrl: "https://app.bispocoffees.com.br/loja/pedido/1?token=secure",
      customer: { name: "José Rezende" },
      delivery: {
        street: "Rua Caracas",
        number: "1255",
        complement: "ap. 1305",
        district: "Santa Rosa",
        city: "Londrina",
        state: "PR",
        postalCode: "86050070",
      },
      items: [{ name: "Caramelo", quantity: 1, grind: "Grãos", unitPriceCents: 6800, totalCents: 6800, weightGrams: 500 }],
      subtotalCents: 6800,
      shippingCents: 1590,
      totalCents: 8390,
      shippingServiceName: "PAC",
      carrierName: "Correios",
      estimatedDeliveryDays: 4,
    },
    { logoUrl: "https://cdn.example/logo.png", sealUrl: "https://cdn.example/seal.jpg" },
  );

  assert.match(html, /Seu café já começou/);
  assert.match(html, /Selo Bispo True Coffee/);
  assert.match(html, /Caramelo e chocolate/);
  assert.match(html, /R\$&nbsp;83,90|R\$\s83,90/);
  assert.match(html, /86050-070/);
  assert.match(html, /Acompanhar meu pedido/);
  assert.doesNotMatch(html, /undefined/);
});

test("escapes customer-controlled content", () => {
  const html = renderCustomerEmail(
    { title: "Pedido recebido", detail: "<script>alert(1)</script>", orderCode: "WEB-1", customer: { name: "<b>José</b>" } },
    { logoUrl: "https://cdn.example/logo.png", sealUrl: "https://cdn.example/seal.jpg" },
  );
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&lt;b&gt;José&lt;\/b&gt;/);
});
