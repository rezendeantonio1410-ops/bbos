import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  MELHOR_ENVIO_FREIGHT_CATEGORY,
  melhorEnvioFreightAmounts,
  reserveMelhorEnvioFreight,
  settleMelhorEnvioFreight,
} from "./storefront-shipping-finance";

function financeTransactionDouble() {
  const state = {
    institutions: new Map<string, any>(),
    accounts: new Map<string, any>(),
    suppliers: new Map<string, any>(),
    payables: new Map<string, any>(),
    payments: new Map<string, any>(),
    transactions: new Map<string, any>(),
  };
  const upsert = (map: Map<string, any>, key: string, input: any) => {
    const current = map.get(key);
    if (current) {
      const updated = { ...current, ...input.update };
      map.set(key, updated);
      return updated;
    }
    map.set(key, input.create);
    return input.create;
  };
  const transaction = {
    financialInstitution: {
      upsert: (input: any) => upsert(state.institutions, input.where.id, input),
    },
    financialAccount: {
      upsert: (input: any) => upsert(state.accounts, input.where.id, input),
    },
    supplier: {
      upsert: (input: any) => upsert(state.suppliers, input.where.id, input),
    },
    accountsPayable: {
      upsert: (input: any) => upsert(state.payables, input.where.id, input),
      update: (input: any) => {
        const current = state.payables.get(input.where.id);
        const updated = { ...current, ...input.data };
        state.payables.set(input.where.id, updated);
        return updated;
      },
    },
    payment: {
      upsert: (input: any) => {
        const current = [...state.payments.values()].find(
          (item) => item.idempotencyKey === input.where.idempotencyKey,
        );
        if (current) return current;
        state.payments.set(input.create.id, input.create);
        return input.create;
      },
    },
    financialTransaction: {
      upsert: (input: any) => {
        const current = input.where.id
          ? state.transactions.get(input.where.id)
          : [...state.transactions.values()].find(
              (item) => item.paymentId === input.where.paymentId,
            );
        if (current) return current;
        state.transactions.set(input.create.id, input.create);
        return input.create;
      },
    },
  };
  return { state, transaction };
}

test("separa o valor recebido do custo real do Melhor Envio", () => {
  assert.deepEqual(
    melhorEnvioFreightAmounts({
      id: "order-1",
      companyId: "company-1",
      code: "WEB-1",
      shippingProvider: "MELHOR_ENVIO",
      shippingCents: 1_500,
      providerPriceCents: 1_379,
    }),
    {
      collectedCents: 1_500,
      providerCents: 1_379,
      logisticsResultCents: 121,
    },
  );
  assert.equal(
    MELHOR_ENVIO_FREIGHT_CATEGORY,
    "Frete / logística · Melhor Envio",
  );
});

test("usa o frete cobrado como custo quando a cotação não informa outro valor", () => {
  assert.deepEqual(
    melhorEnvioFreightAmounts({
      id: "order-2",
      companyId: "company-1",
      code: "WEB-2",
      shippingProvider: "MELHOR_ENVIO",
      shippingCents: 1_379,
    }),
    {
      collectedCents: 1_379,
      providerCents: 1_379,
      logisticsResultCents: 0,
    },
  );
});

test("não cria rubrica para outro provedor ou custo zerado", () => {
  assert.equal(
    melhorEnvioFreightAmounts({
      id: "order-3",
      companyId: "company-1",
      code: "WEB-3",
      shippingProvider: "FIXED",
      shippingCents: 1_379,
    }),
    null,
  );
  assert.equal(
    melhorEnvioFreightAmounts({
      id: "order-4",
      companyId: "company-1",
      code: "WEB-4",
      shippingProvider: "MELHOR_ENVIO",
      shippingCents: 0,
      providerPriceCents: 0,
    }),
    null,
  );
});

test("a reserva e a baixa são idempotentes", async () => {
  const { state, transaction } = financeTransactionDouble();
  const order = {
    id: "order-idempotent",
    companyId: "company-1",
    code: "WEB-IDEMPOTENT",
    shippingProvider: "MELHOR_ENVIO",
    shippingCents: 1_379,
    providerPriceCents: 1_379,
    paidAt: new Date("2026-10-07T20:00:00-03:00"),
  };

  await reserveMelhorEnvioFreight(transaction as any, order);
  await reserveMelhorEnvioFreight(transaction as any, order);
  assert.equal(state.accounts.size, 1);
  assert.equal(state.payables.size, 1);
  assert.equal(state.transactions.size, 1);
  const reserved = [...state.payables.values()][0];
  assert.equal(
    new Date(reserved.dueDate).getTime() -
      new Date(reserved.issueDate).getTime(),
    24 * 60 * 60 * 1000,
  );
  assert.match(reserved.notes, /R\$\s13,79/);

  const settlement = {
    ...order,
    shipmentId: "shipment-1",
    externalId: "melhor-envio-1",
  };
  await settleMelhorEnvioFreight(transaction as any, settlement);
  await settleMelhorEnvioFreight(transaction as any, settlement);
  assert.equal(state.payments.size, 1);
  assert.equal(state.transactions.size, 2);
  assert.equal([...state.payables.values()][0].status, "PAID");
  assert.equal(Number([...state.payables.values()][0].openAmount), 0);
});

test("liga a reserva ao pagamento e a baixa à compra da etiqueta", () => {
  const controller = readFileSync(
    join(__dirname, "storefront-orders.controller.ts"),
    "utf8",
  );
  const shipment = readFileSync(
    join(__dirname, "melhor-envio-shipment.service.ts"),
    "utf8",
  );
  const migration = readFileSync(
    join(
      __dirname,
      "../../../packages/database/prisma/migrations/20261007235000_storefront_freight_finance/migration.sql",
    ),
    "utf8",
  );

  assert.match(controller, /reserveMelhorEnvioFreight\(transaction/);
  assert.equal(
    [...shipment.matchAll(/settleMelhorEnvioFreight\(transaction/g)].length,
    2,
  );
  assert.match(migration, /shipping-payable:storefront:/);
  assert.match(migration, /shipping-allocation:storefront:/);
  assert.match(migration, /MELHOR_ENVIO_WALLET/);
});
