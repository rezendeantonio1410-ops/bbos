import assert from "node:assert/strict";
import test from "node:test";
import { PartnerPortalController } from "./partner-portal.controller";

const companyId = "company-signa-test";
const customerId = "customer-signa-test";
const partnerId = "partner-signa-test";
const variants = {
  "reserve-500": { sku: "RAR-WLR-500", grams: 500, price: 76.8 },
  "reserve-1000": { sku: "RAR-WLR-1000", grams: 1000, price: 148 },
} as const;
type VariantId = keyof typeof variants;

test("Signa: catálogo isolado, cotação e pedido Reserva 500 g/1 kg", async () => {
  const createdOrders: Array<Record<string, unknown>> = [];
  const writtenSql: string[] = [];
  const lifecycle: string[] = [];
  const fakeDatabase = {
    async $queryRawUnsafe(sql: string, ...args: unknown[]) {
      if (sql.includes('FROM "StorefrontPartner"') && sql.includes("LIMIT 1")) {
        return [{
          id: partnerId, name: "Signa Coffee", contactName: "Signa",
          email: "comercial@nivov.com.br", active: true,
          portalAccessLevel: "DISTRIBUTOR",
        }];
      }
      if (sql.includes('FROM "Customer" c')) {
        if (sql.includes("LIMIT 1") && args[1] !== customerId) return [];
        return [{ id: customerId, active: true, name: "Signa Coffee" }];
      }
      if (sql.includes('FROM "CustomerCatalogProduct" catalog')) {
        if (sql.includes('catalog."displayLineName"')) {
          return Object.entries(variants).map(([id, v], i) => ({
            productVariantId: id, displayLineName: "Reserva",
            displayProductName: "Reserva", sortOrder: 42 + i,
            catalogPrice: v.price,
          }));
        }
        return Object.keys(variants).map((id) => ({ productVariantId: id }));
      }
      if (sql.includes("WITH distributor_channel AS")) {
        const id = String(args[1]) as VariantId;
        const variant = variants[id];
        if (!variant) return [];
        return [{
          customerProductPriceId: `price-${id}`,
          customerPrice: variant.price, currency: "BRL",
          salesChannelId: "distributor-channel", salesChannelName: "Distribuidor",
          salesChannelType: "DISTRIBUIDOR", productPriceId: null,
        }];
      }
      if (sql.includes('FROM "SalesOrder"') && sql.includes("MAX(RIGHT")) {
        return [{ next: 1 }];
      }
      throw new Error(`Consulta não simulada no teste de pedido Signa: ${sql.slice(0, 120)}`);
    },
    productVariant: {
      async findMany() {
        return Object.entries(variants).map(([id, v]) => ({
          id, sku: v.sku, netWeightGrams: v.grams, salesUnit: "UN", active: true,
          product: {
            name: "White Label Raro",
            productLine: { name: "Raros", code: "RAROS" },
          },
          finishedProducts: [],
        }));
      },
    },
    async $executeRawUnsafe(sql: string) {
      writtenSql.push(sql);
      return 1;
    },
  };
  const fakeSalesOrders = {
    async options() {
      return { variants: [] };
    },
    async create(orderCompanyId: string, input: Record<string, unknown>) {
      assert.equal(orderCompanyId, companyId);
      createdOrders.push(input);
      return { id: "order-signa-test", totalAmount: 224.8 };
    },
  };
  const fakeTermApprovals = {
    async ensureForOrder() {
      throw new Error("Pedido à vista não deve criar aprovação de crédito");
    },
  };
  const fakeLifecycle = {
    async record(_orderId: string, event: string) {
      lifecycle.push(event);
    },
  };
  const controller = new PartnerPortalController(
    fakeSalesOrders as never,
    fakeTermApprovals as never,
    fakeLifecycle as never,
  );
  (controller as unknown as { database: unknown }).database = fakeDatabase;
  const request = {
    user: { role: "PARTNER", companyId, storefrontPartnerId: partnerId },
  };
  const options = await controller.orderOptions(request);
  assert.equal(options.catalog.exclusive, true);
  assert.equal(options.catalog.productCount, 2);
  const catalogVariants = options.variants as Array<{
    sku: string; presentationGrams: number; catalogPrice: number;
  }>;
  assert.deepEqual(
    catalogVariants.map((v) => [v.sku, v.presentationGrams, v.catalogPrice]),
    [["RAR-WLR-500", 500, 76.8], ["RAR-WLR-1000", 1000, 148]],
  );
  const items = [
    { productVariantId: "reserve-500", quantity: 1 },
    { productVariantId: "reserve-1000", quantity: 1 },
  ];
  const quote = await controller.quote(request, { customerId, items });
  assert.equal(quote.totalAmount, 224.8);
  assert.deepEqual(quote.items.map((i) => i.unitPrice), [76.8, 148]);
  const submitted = await controller.createOrder(request, {
    customerId, items, paymentType: "CASH",
  });
  assert.equal(submitted.status, "DRAFT");
  assert.equal(submitted.totalAmount, 224.8);
  assert.equal(createdOrders.length, 1);
  const orderItems = createdOrders[0]!.items as Array<{
    unitPrice: number; pricingSource: string; customerProductPriceId: string;
  }>;
  assert.deepEqual(orderItems.map((i) => i.unitPrice), [76.8, 148]);
  assert.ok(orderItems.every((i) => i.pricingSource === "CUSTOMER"));
  assert.ok(orderItems.every((i) => i.customerProductPriceId.startsWith("price-")));
  assert.ok(writtenSql.some((sql) => sql.includes('"OperationalNotification"')));
  assert.deepEqual(lifecycle, ["ORDER_SUBMITTED"]);
  await assert.rejects(
    controller.quote(request, {
      customerId, items: [{ productVariantId: "sku-not-signa", quantity: 1 }],
    }),
    /Produto não liberado/,
  );
});
