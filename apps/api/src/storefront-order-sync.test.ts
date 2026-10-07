import assert from "node:assert/strict";
import test from "node:test";
import {
  ensureBispoStoreSalesChannel,
  storefrontCustomerProfile,
  storefrontShippingSalesOrderData,
} from "./storefront-order-sync";

test("pedido da Loja Bispo não reutiliza o canal Mercado Livre", async () => {
  const mercadoLivre = {
    id: "channel-ml",
    code: "MERCADO_LIVRE",
    platformCode: "MERCADO_LIVRE",
  };
  const bispoStore = {
    id: "channel-bispo",
    code: "ECOMMERCE",
    platformCode: "BISPO_STORE",
  };
  let fallbackConsulted = false;
  const transaction = {
    salesChannel: {
      findFirst: async (query: any) => {
        assert.equal(query.where.platformCode, "BISPO_STORE");
        return query.where.platformCode === mercadoLivre.platformCode
          ? mercadoLivre
          : bispoStore;
      },
      findUnique: async () => {
        fallbackConsulted = true;
        return mercadoLivre;
      },
      update: async () => mercadoLivre,
      upsert: async () => mercadoLivre,
    },
  };

  const channel = await ensureBispoStoreSalesChannel(
    transaction as any,
    "company-1",
  );

  assert.equal(channel.id, "channel-bispo");
  assert.equal(fallbackConsulted, false);
});

test("canal legado da loja recebe identidade BISPO_STORE", async () => {
  const updates: any[] = [];
  const transaction = {
    salesChannel: {
      findFirst: async () => null,
      findUnique: async () => ({ id: "channel-legacy", code: "ECOMMERCE" }),
      update: async (query: any) => {
        updates.push(query);
        return { id: query.where.id, ...query.data };
      },
      upsert: async () => {
        throw new Error("upsert não deveria ser chamado");
      },
    },
  };

  const channel = await ensureBispoStoreSalesChannel(
    transaction as any,
    "company-1",
  );

  assert.equal(channel.platformCode, "BISPO_STORE");
  assert.equal(channel.name, "Loja Bispo");
  assert.equal(updates.length, 1);
});

test("checkout da loja preserva o endereço fiscal no cliente", () => {
  const profile = storefrontCustomerProfile(
    {
      name: "José Rezende",
      email: " jose@example.com ",
      phone: "+55 (43) 99999-9999",
      cpf: "123.456.789-09",
    },
    {
      postalCode: "86010-000",
      street: "Rua Bispo",
      number: "100",
      complement: "Sala 2",
      district: "Centro",
      city: "Londrina",
      state: "pr",
    },
  );

  assert.deepEqual(profile, {
    name: "José Rezende",
    taxId: "12345678909",
    segment: "E-commerce",
    email: "jose@example.com",
    phone: "5543999999999",
    postalCode: "86010000",
    address: "Rua Bispo",
    addressNumber: "100",
    addressComplement: "Sala 2",
    district: "Centro",
    city: "Londrina",
    state: "PR",
    stateRegistrationType: "NON_TAXPAYER",
  });
});

test("checkout da loja preserva a cotação usada para despachar", () => {
  const shipping = storefrontShippingSalesOrderData({
    shippingCents: 1379,
    shippingQuoteId: "quote-1",
    shippingProvider: "MELHOR_ENVIO",
    shippingServiceId: "2",
    shippingServiceName: "SEDEX",
    carrierName: "Correios",
    estimatedDeliveryDays: 4,
  });

  assert.deepEqual(shipping, {
    freight: 13.79,
    freightResponsibility: "CUSTOMER",
    shippingQuoteId: "quote-1",
    shippingProvider: "MELHOR_ENVIO",
    shippingServiceId: "2",
    shippingServiceName: "SEDEX",
    carrierName: "Correios",
    estimatedDeliveryDays: 4,
  });
});
