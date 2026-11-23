import assert from "node:assert/strict";
import test from "node:test";
import { PartnerPortalController } from "./partner-portal.controller";

const companyId = "company-signa-test";
const customerId = "customer-signa-test";
const partnerId = "partner-signa-test";
const rodrigoId = "customer-rodrigo-test";
const variants = {
  "reserve-500": { sku: "RAR-WLR-500", grams: 500, price: 76.8 },
  "reserve-1000": { sku: "RAR-WLR-1000", grams: 1000, price: 148 },
} as const;
type VariantId = keyof typeof variants;

test("Signa: catálogo isolado, cotação e pedido Reserva 500 g/1 kg", async () => {
  const createdOrders: Array<Record<string, unknown>> = [];
  const writtenSql: string[] = [];
  const lifecycle: string[] = [];
  const lifecycleKeys = new Set<string>();
  const claims = new Map<string, { id: string; requestHash: string; status: string; salesOrderId: string | null }>();
  let transactions = 0;
  const fakeDatabase = {
    async $transaction<T>(callback: (tx: unknown) => Promise<T>) {
      transactions += 1;
      return callback(fakeDatabase);
    },
    async $queryRawUnsafe(sql: string, ...args: unknown[]) {
      if (sql.includes('INSERT INTO "PartnerOrderSubmission"')) {
        const key = String(args[4]);
        if (claims.has(key)) return [];
        const claim = { id: String(args[0]), requestHash: String(args[5]), status: "CLAIMED", salesOrderId: null };
        claims.set(key, claim);
        return [{ id: claim.id }];
      }
      if (sql.includes('FROM "PartnerOrderSubmission"')) {
        const claim = claims.get(String(args[3]));
        return claim ? [{ status: claim.status, requestHash: claim.requestHash, salesOrderId: claim.salesOrderId }] : [];
      }
      if (sql.includes("pg_advisory_xact_lock")) return [{ locked: false }];
      if (sql.includes('"partnerRequestedReadyDate"') && sql.includes('FROM "SalesOrder"')) {
        const order = createdOrders.find((entry) => entry.id === args[0]);
        return order ? [{ id: order.id, code: order.orderNumber, status: "DRAFT", totalAmount: 224.8,
          paymentType: "CASH", paymentTermsSnapshot: "À vista na emissão da NF-e", partnerRequestedReadyDate: null }] : [];
      }
      if (sql.includes('FROM "StorefrontPartner"') && sql.includes("LIMIT 1")) {
        return [{
          id: partnerId, name: "Signa Coffee", contactName: "Signa",
          email: "comercial@nivov.com.br", active: true,
          portalAccessLevel: "DISTRIBUTOR",
        }];
      }
      if (sql.includes('SELECT DISTINCT recipient.*') && sql.includes('"documentType"')) {
        return [
          { id: customerId, name: "Signa Coffee", documentType: "CNPJ", pricingCustomerId: customerId, taxIdVerificationStatus: "NOT_VERIFIED" },
          { id: rodrigoId, name: "Rodrigo Lampert Ribas", documentType: "CPF", pricingCustomerId: customerId, taxIdVerificationStatus: "NOT_VERIFIED" },
        ];
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
    async $executeRawUnsafe(sql: string, ...args: unknown[]) {
      writtenSql.push(sql);
      if (sql.includes('UPDATE "PartnerOrderSubmission"')) {
        const claim = [...claims.values()].find((entry) => entry.id === args[0]);
        if (!claim || claim.status !== "CLAIMED") return 0;
        claim.status = "COMPLETED";
        claim.salesOrderId = String(args[1]);
      }
      return 1;
    },
  };
  const fakeSalesOrders = {
    async options() {
      return { variants: [] };
    },
    async create(orderCompanyId: string, input: Record<string, unknown>, transaction?: unknown) {
      assert.equal(orderCompanyId, companyId);
      assert.equal(transaction, fakeDatabase, "pedido deve ser criado na transação da reserva de envio");
      const id = `order-signa-test-${createdOrders.length + 1}`;
      createdOrders.push({ ...input, id });
      return { id, totalAmount: 224.8 };
    },
  };
  const fakeTermApprovals = {
    async ensureForOrder() {
      throw new Error("Pedido à vista não deve criar aprovação de crédito");
    },
  };
  const fakeLifecycle = {
    async record(_orderId: string, event: string, _title: string, _detail: string, _source: string, key: string) {
      // The real service deduplicates by idempotency key.
      if (!lifecycleKeys.has(key)) lifecycle.push(event);
      lifecycleKeys.add(key);
    },
  };
  const controller = new PartnerPortalController(
    fakeSalesOrders as never,
    fakeTermApprovals as never,
    fakeLifecycle as never,
  );
  (controller as unknown as { database: unknown }).database = fakeDatabase;
  const request = {
    user: { id: "user-signa-test", role: "PARTNER", companyId, storefrontPartnerId: partnerId },
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
  await assert.rejects(
    controller.createOrder(request, { customerId, billingRecipientId: customerId, items, paymentType: "CASH" }),
    /Identificador de envio inválido/,
  );
  const firstBody = {
    customerId, billingRecipientId: customerId, items, paymentType: "CASH" as const,
    submissionKey: "signa-test-key-0000000001",
  };
  const submitted = await controller.createOrder(request, firstBody);
  assert.equal(submitted.status, "DRAFT");
  assert.equal(submitted.totalAmount, 224.8);
  assert.equal(createdOrders.length, 1);
  assert.equal(createdOrders[0]!.customerId, customerId);
  const submittedRodrigo = await controller.createOrder(request, {
    customerId, billingRecipientId: rodrigoId, items, paymentType: "CASH",
    submissionKey: "signa-test-key-0000000002",
  });
  assert.equal(submittedRodrigo.totalAmount, 224.8);
  assert.equal(createdOrders[1]!.customerId, rodrigoId);
  const rodrigoItems = createdOrders[1]!.items as Array<{unitPrice:number}>;
  assert.deepEqual(rodrigoItems.map((i) => i.unitPrice), [76.8, 148]);
  await assert.rejects(
    controller.createOrder(request, {customerId, billingRecipientId:"unapproved", items, submissionKey:"signa-test-key-0000000003"}),
    /Selecione um destinatário fiscal válido/,
  );

  const orderItems = createdOrders[0]!.items as Array<{
    unitPrice: number; pricingSource: string; customerProductPriceId: string;
  }>;
  assert.deepEqual(orderItems.map((i) => i.unitPrice), [76.8, 148]);
  assert.ok(orderItems.every((i) => i.pricingSource === "CUSTOMER"));
  assert.ok(orderItems.every((i) => i.customerProductPriceId.startsWith("price-")));
  assert.ok(writtenSql.some((sql) => sql.includes('"OperationalNotification"')));
  assert.deepEqual(lifecycle, ["ORDER_SUBMITTED", "ORDER_SUBMITTED"]);
  await assert.rejects(
    controller.quote(request, {
      customerId, items: [{ productVariantId: "sku-not-signa", quantity: 1 }],
    }),
    /Produto não liberado/,
  );

  // Retry of the same submission (double click, timeout) returns the original order.
  const replay = await controller.createOrder(request, { ...firstBody });
  assert.equal(replay.id, submitted.id);
  assert.equal(replay.replayed, true);
  assert.equal(createdOrders.length, 2, "reenvio não pode criar outro pedido");
  assert.deepEqual(lifecycle, ["ORDER_SUBMITTED", "ORDER_SUBMITTED"]);
  // Same key with different content is refused.
  await assert.rejects(
    controller.createOrder(request, { ...firstBody, items: [{ productVariantId: "reserve-500", quantity: 2 }] }),
    /outro conteúdo/,
  );
  assert.equal(createdOrders.length, 2);
  assert.equal(transactions, 2);
});
