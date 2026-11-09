import {
  BadRequestException,
  Injectable,
  NotFoundException,
  type OnModuleDestroy,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import {
  FinishedGoodsMovementType,
  InventoryReservationStatus,
  Prisma,
  prisma,
  SalesOrderStatus,
} from "@bbos/database";
import {
  releaseSalesStock,
  reserveSalesStock,
  salesInventoryBalance,
  shipSalesStock,
} from "@bbos/shared";
import { SalesOrderCustomerLifecycleService } from "./sales-order-customer-lifecycle.service";
import { SalesOrderTermApprovalService } from "./sales-order-term-approval.service";
import {
  resolveSalesOrderType,
  SAMPLE_FISCAL_PACKAGE_VALUE,
  type SalesOrderType,
} from "./sales-order-sample-policy";
import {
  assessCustomerFiscalReadiness,
  customerFiscalReadinessMessage,
} from "./customer-fiscal-readiness";

export type CreateSalesOrderInput = {
  code: string;
  orderNumber?: string;
  orderType?: SalesOrderType;
  customerId: string;
  salesChannelId?: string;
  currency?: string;
  exchangeRateToBrl?: number;
  exchangeRateDate?: string;
  customsDeclaredValue?: number;
  exportDepartureLocation?: string;
  exportDepartureState?: string;
  expectedDeliveryDate?: string;
  discount?: number;
  freight?: number;
  brokerId?: string;
  brokerCommissionMode?: "PERCENTAGE" | "PER_PACKAGE";
  brokerCommissionPercent?: number;
  brokerCommissionPerPackage?: number;
  brokerCommissionAmount?: number;
  notes?: string;
  items: Array<{
    productVariantId: string;
    warehouseId: string;
    quantity: number;
    unitPrice: number;
    pricingSource?: "CHANNEL" | "CUSTOMER" | "SAMPLE";
    baseProductPriceId?: string;
    customerProductPriceId?: string | null;
    priceSnapshot?: Record<string, unknown>;
  }>;
};

type SalesBrokerOption = {
  id: string;
  name: string;
  tradeName: string | null;
  active: boolean;
};

type RoastedWipReservationRow = {
  id: string;
  salesOrderItemId: string;
  packageQuantity: number;
  requestedKg: Prisma.Decimal;
  reservedKg: Prisma.Decimal;
  status: "PENDING" | "PARTIAL" | "RESERVED";
  stockProductName: string;
  stockLineName: string;
};

@Injectable()
export class SalesOrdersService implements OnModuleDestroy {
  readonly database = prisma;

  constructor(
    private readonly customerLifecycle: SalesOrderCustomerLifecycleService,
    private readonly termApprovals?: SalesOrderTermApprovalService,
  ) {}

  private async allocateRoastedWipForOrder(
    transaction: Prisma.TransactionClient,
    companyId: string,
    salesOrderId: string,
  ) {
    const items = await transaction.$queryRawUnsafe<any[]>(
      `WITH item_stock AS (
         SELECT soi.id,soi.quantity,soi."productVariantId",pv."netWeightGrams",
                COALESCE(product."baseCoffeeProductId",pv."productId") AS "stockProductId",
                COALESCE((
                  SELECT MAX(fp."quantityOnHand"-fp."reservedQuantity")
                    FROM "FinishedProduct" fp
                   WHERE fp."companyId"=$1 AND fp."productVariantId"=soi."productVariantId"
                ),0)::int AS "finishedAvailable"
           FROM "SalesOrderItem" soi
           JOIN "ProductVariant" pv ON pv.id=soi."productVariantId"
           JOIN "Product" product ON product.id=pv."productId"
          WHERE soi."salesOrderId"=$2 AND soi."companyId"=$1
       ), distributed AS (
         SELECT item_stock.*,
                COALESCE(SUM(quantity) OVER (
                  PARTITION BY "productVariantId"
                  ORDER BY id
                  ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
                ),0)::int AS "priorDemand"
           FROM item_stock
       )
       SELECT id,quantity,"productVariantId","netWeightGrams","stockProductId",
              GREATEST(0,"finishedAvailable"-"priorDemand")::int AS "finishedAvailable"
         FROM distributed
        ORDER BY id`,
      companyId,
      salesOrderId,
    );
    for (const item of items) {
      const packageQuantity = Math.max(
        0,
        Number(item.quantity) - Number(item.finishedAvailable ?? 0),
      );
      if (packageQuantity <= 0) continue;
      const requestedKg = Number(
        ((packageQuantity * Number(item.netWeightGrams)) / 1000).toFixed(3),
      );
      const existingRows = await transaction.$queryRawUnsafe<any[]>(
        `SELECT * FROM "RoastedWipReservation"
          WHERE "salesOrderItemId"=$1 FOR UPDATE`,
        item.id,
      );
      let reservation = existingRows[0];
      if (!reservation) {
        const created = await transaction.$queryRawUnsafe<any[]>(
          `INSERT INTO "RoastedWipReservation"
            (id,"companyId","salesOrderId","salesOrderItemId","productVariantId","packageQuantity","requestedKg","reservedKg",status,"createdAt","updatedAt")
           VALUES ($1,$2,$3,$4,$5,$6,$7,0,'PENDING',NOW(),NOW())
           RETURNING *`,
          randomUUID(),
          companyId,
          salesOrderId,
          item.id,
          item.productVariantId,
          packageQuantity,
          requestedKg,
        );
        reservation = created[0];
      }
      if (!["PENDING", "PARTIAL"].includes(String(reservation.status)))
        continue;
      let remainingKg = Math.max(
        0,
        Number(reservation.requestedKg) - Number(reservation.reservedKg),
      );
      if (remainingKg <= 0.0005) continue;
      const lots = await transaction.$queryRawUnsafe<any[]>(
        `SELECT w.id,(w."availableKg"-w."reservedKg")::float AS available
           FROM "RoastedWipLot" w
          JOIN "ProductVariant" source_variant ON source_variant.id=w."productVariantId"
          JOIN "Product" source_product ON source_product.id=source_variant."productId"
          JOIN "Product" target_product ON target_product.id=$2
          WHERE w."companyId"=$1
            AND source_product."productLineId"=target_product."productLineId"
            AND source_product.id=target_product.id
            AND w.status IN ('AVAILABLE','PARTIALLY_PACKED')
            AND w."availableKg"-w."reservedKg">0.0005
          ORDER BY w."producedAt",w.id
          FOR UPDATE OF w`,
        companyId,
        item.stockProductId,
      );
      let allocatedKg = 0;
      for (const lot of lots) {
        if (remainingKg <= 0.0005) break;
        const takeKg = Number(
          Math.min(Number(lot.available), remainingKg).toFixed(3),
        );
        if (takeKg <= 0) continue;
        await transaction.$executeRawUnsafe(
          `UPDATE "RoastedWipLot"
              SET "reservedKg"="reservedKg"+$2,"updatedAt"=NOW()
            WHERE id=$1`,
          lot.id,
          takeKg,
        );
        await transaction.$executeRawUnsafe(
          `INSERT INTO "RoastedWipReservationAllocation"
            (id,"companyId","reservationId","wipLotId","quantityKg","consumedKg","createdAt")
           VALUES ($1,$2,$3,$4,$5,0,NOW())
           ON CONFLICT ("reservationId","wipLotId") DO UPDATE
             SET "quantityKg"="RoastedWipReservationAllocation"."quantityKg"+EXCLUDED."quantityKg"`,
          randomUUID(),
          companyId,
          reservation.id,
          lot.id,
          takeKg,
        );
        allocatedKg += takeKg;
        remainingKg = Number((remainingKg - takeKg).toFixed(3));
      }
      const totalReservedKg = Number(
        (Number(reservation.reservedKg) + allocatedKg).toFixed(3),
      );
      await transaction.$executeRawUnsafe(
        `UPDATE "RoastedWipReservation"
            SET "reservedKg"=$2,
                status=CASE
                  WHEN $2 >= "requestedKg"-0.0005 THEN 'RESERVED'
                  WHEN $2 > 0 THEN 'PARTIAL'
                  ELSE 'PENDING'
                END,
                "updatedAt"=NOW()
          WHERE id=$1`,
        reservation.id,
        totalReservedKg,
      );
    }
  }

  private async releaseRoastedWipForOrder(
    transaction: Prisma.TransactionClient,
    companyId: string,
    salesOrderId: string,
  ) {
    const allocations = await transaction.$queryRawUnsafe<any[]>(
      `SELECT allocation.id,allocation."wipLotId",
              (allocation."quantityKg"-allocation."consumedKg")::float AS releasable
         FROM "RoastedWipReservationAllocation" allocation
         JOIN "RoastedWipReservation" reservation ON reservation.id=allocation."reservationId"
        WHERE reservation."companyId"=$1 AND reservation."salesOrderId"=$2
          AND reservation.status IN ('PENDING','PARTIAL','RESERVED')
        ORDER BY allocation."wipLotId"
        FOR UPDATE OF allocation`,
      companyId,
      salesOrderId,
    );
    for (const allocation of allocations) {
      const releasable = Number(allocation.releasable ?? 0);
      if (releasable <= 0) continue;
      await transaction.$executeRawUnsafe(
        `UPDATE "RoastedWipLot"
            SET "reservedKg"=GREATEST(0,"reservedKg"-$2),"updatedAt"=NOW()
          WHERE id=$1`,
        allocation.wipLotId,
        releasable,
      );
    }
    await transaction.$executeRawUnsafe(
      `UPDATE "RoastedWipReservation"
          SET status='RELEASED',"updatedAt"=NOW()
        WHERE "companyId"=$1 AND "salesOrderId"=$2
          AND status IN ('PENDING','PARTIAL','RESERVED')`,
      companyId,
      salesOrderId,
    );
  }

  onModuleDestroy() {
    return this.database.$disconnect();
  }

  async list(companyId: string) {
    const orders = await this.database.salesOrder.findMany({
      where: {
        companyId,
        status: { not: SalesOrderStatus.CANCELLED },
      },
      include: this.orderInclude,
      orderBy: { orderedAt: "desc" },
    });
    if (!orders.length) return orders;
    const [shipments, payments, fiscalDocuments] = await Promise.all([
      this.database.$queryRawUnsafe<
        Array<{
          salesOrderId: string;
          status: string;
          carrierName: string | null;
          serviceName: string | null;
          trackingCode: string | null;
          authorizationCode: string | null;
          updatedAt: Date;
        }>
      >(
        `SELECT DISTINCT ON ("salesOrderId") "salesOrderId",status,"carrierName","serviceName",
              "trackingCode",metadata->>'authorization_code' AS "authorizationCode","updatedAt"
         FROM "Shipment"
        WHERE provider='MELHOR_ENVIO' AND "salesOrderId"=ANY($1::text[])
        ORDER BY "salesOrderId","updatedAt" DESC`,
        orders.map((order) => order.id),
      ),
      this.database.$queryRawUnsafe<
        Array<{
          salesOrderId: string;
          status: string;
          method: string;
          amountCents: number;
          expiresAt: Date | null;
          paidAt: Date | null;
        }>
      >(
        `SELECT DISTINCT ON ("salesOrderId") "salesOrderId",status,method,"amountCents","expiresAt","paidAt"
           FROM "SalesOrderPaymentAttempt"
          WHERE "salesOrderId"=ANY($1::text[])
          ORDER BY "salesOrderId","attemptNumber" DESC`,
        orders.map((order) => order.id),
      ),
      this.database.$queryRawUnsafe<
        Array<{
          salesOrderId: string;
          status: string;
          externalId: string | null;
          number: string | null;
        }>
      >(
        `SELECT DISTINCT ON ("salesOrderId") "salesOrderId",status,"externalId",number
           FROM "FiscalDocument"
          WHERE direction='OUTBOUND' AND "salesOrderId"=ANY($1::text[])
          ORDER BY "salesOrderId","createdAt" DESC`,
        orders.map((order) => order.id),
      ),
    ]);
    const byOrder = new Map(
      shipments.map((shipment) => [shipment.salesOrderId, shipment]),
    );
    const paymentByOrder = new Map(
      payments.map((payment) => [payment.salesOrderId, payment]),
    );
    const fiscalByOrder = new Map(
      fiscalDocuments.map((document) => [document.salesOrderId, document]),
    );
    return orders.map((order) => ({
      ...order,
      shipment: byOrder.get(order.id) ?? null,
      payment: paymentByOrder.get(order.id) ?? null,
      fiscalStatus: fiscalByOrder.get(order.id)?.status ?? null,
      fiscalExternalId: fiscalByOrder.get(order.id)?.externalId ?? null,
      fiscalNumber: fiscalByOrder.get(order.id)?.number ?? null,
    }));
  }

  async get(companyId: string, id: string) {
    const order = await this.database.salesOrder.findFirst({
      where: { id, companyId },
      include: this.orderInclude,
    });
    if (!order) throw new NotFoundException("Pedido não encontrado.");
    if (typeof (this.database as any).$queryRawUnsafe !== "function") {
      return { ...order, payment: null };
    }
    const [payments, fiscalDocuments] = await Promise.all([
      this.database.$queryRawUnsafe<any[]>(
        `SELECT status,method,"amountCents","expiresAt","paidAt"
           FROM "SalesOrderPaymentAttempt"
          WHERE "salesOrderId"=$1 ORDER BY "attemptNumber" DESC LIMIT 1`,
        order.id,
      ),
      this.database.$queryRawUnsafe<any[]>(
        `SELECT status,"externalId",number
           FROM "FiscalDocument"
          WHERE "salesOrderId"=$1 AND direction='OUTBOUND'
          ORDER BY "createdAt" DESC LIMIT 1`,
        order.id,
      ),
    ]);
    return {
      ...order,
      payment: payments[0] ?? null,
      fiscalStatus: fiscalDocuments[0]?.status ?? null,
      fiscalExternalId: fiscalDocuments[0]?.externalId ?? null,
      fiscalNumber: fiscalDocuments[0]?.number ?? null,
    };
  }

  async exportOverview(companyId: string) {
    const orders = await this.database.salesOrder.findMany({
      where: { companyId, salesChannel: { type: "EXPORTACAO" } },
      select: {
        id: true,
        code: true,
        orderNumber: true,
        status: true,
        totalAmount: true,
        quantity: true,
        orderedAt: true,
        expectedDeliveryDate: true,
        incoterm: true,
        incotermLocation: true,
        customerReference: true,
        customer: { select: { name: true } },
        salesChannel: { select: { name: true, currency: true } },
        items: {
          select: {
            id: true,
            sku: true,
            productName: true,
            quantity: true,
          },
        },
      },
      orderBy: { orderedAt: "desc" },
    });
    const active = orders.filter((order) => order.status !== "CANCELLED");
    const currencyFor = (order: (typeof orders)[number]) =>
      order.salesChannel?.currency?.trim().toUpperCase() || "UNSPECIFIED";
    const totalsByCurrency = Array.from(
      active.reduce((totals, order) => {
        const currency = currencyFor(order);
        totals.set(
          currency,
          (totals.get(currency) ?? 0) + Number(order.totalAmount),
        );
        return totals;
      }, new Map<string, number>()),
    ).map(([currency, amount]) => ({ currency, amount }));
    const items = orders.map((order) => {
      const missing = [
        ...(currencyFor(order) === "UNSPECIFIED" ? ["Moeda"] : []),
        ...(!order.incoterm ? ["Incoterm"] : []),
        ...(!order.incotermLocation ? ["Local nomeado"] : []),
        ...(!order.expectedDeliveryDate ? ["Prazo prometido"] : []),
      ];
      return {
        ...order,
        totalAmount: Number(order.totalAmount),
        currency: currencyFor(order),
        readiness: { ready: missing.length === 0, missing },
      };
    });
    return {
      metrics: {
        orders: orders.length,
        open: active.filter(
          (order) => !["DELIVERED", "CANCELLED"].includes(order.status),
        ).length,
        ready: items.filter(
          (order) => order.status !== "CANCELLED" && order.readiness.ready,
        ).length,
        attention: items.filter(
          (order) =>
            !order.readiness.ready &&
            !["DELIVERED", "CANCELLED"].includes(order.status),
        ).length,
        totalsByCurrency,
      },
      items,
      source: "database" as const,
      updatedAt: new Date().toISOString(),
    };
  }

  async options(companyId: string) {
    const [customers, balances, brokers] = await Promise.all([
      this.database.customer.findMany({
        where: { companyId },
        orderBy: { name: "asc" },
      }),
      this.database.finishedProduct.findMany({
        where: {
          productVariantId: { not: null },
          productVariant: { product: { productLine: { companyId } } },
        },
        include: {
          warehouse: true,
          productVariant: {
            include: { product: { include: { productLine: true } } },
          },
        },
      }),
      this.database.$queryRaw<SalesBrokerOption[]>(Prisma.sql`
        SELECT broker.id,
               partner.name,
               partner."tradeName",
               broker.active
          FROM "Broker" broker
          JOIN "StorefrontPartner" partner
            ON partner.id = broker."businessPartnerId"
         WHERE broker."companyId" = ${companyId}
           AND broker.active = TRUE
           AND partner.active = TRUE
           AND partner."isSalesBroker" = TRUE
         ORDER BY partner.name ASC
      `),
    ]);
    return {
      customers: customers.map((customer) => ({
        ...customer,
        fiscalReadiness: assessCustomerFiscalReadiness(customer),
      })),
      brokers,
      variants: balances.map((item) => ({
        productVariantId: item.productVariantId,
        warehouseId: item.warehouseId,
        warehouse: item.warehouse.name,
        line: item.productVariant!.product.productLine.name,
        lineCode: item.productVariant!.product.productLine.code,
        product: item.productVariant!.product.name,
        sku: item.productVariant!.sku,
        presentationGrams: item.productVariant!.netWeightGrams,
        salesUnit: item.productVariant!.salesUnit,
        ...salesInventoryBalance(item.quantityOnHand, item.reservedQuantity),
      })),
    };
  }

  async create(companyId: string, input: CreateSalesOrderInput) {
    const orderType = resolveSalesOrderType(input.orderType);
    if (!input.items.length)
      throw new BadRequestException("O pedido deve possuir ao menos um item.");
    if (
      new Set(input.items.map((item) => item.productVariantId)).size !==
      input.items.length
    )
      throw new BadRequestException(
        "Agrupe quantidades do mesmo SKU em um único item.",
      );
    for (const item of input.items) {
      if (
        !Number.isSafeInteger(item.quantity) ||
        item.quantity <= 0 ||
        item.unitPrice < 0
      )
        throw new BadRequestException(
          "Quantidade e preço do item são inválidos.",
        );
    }
    if (orderType === "SAMPLE" && input.brokerId) {
      throw new BadRequestException(
        "Pedido de amostra não pode gerar comissão comercial.",
      );
    }
    const pricedItems = input.items.map((item) => ({
      ...item,
      unitPrice:
        orderType === "SAMPLE" ? SAMPLE_FISCAL_PACKAGE_VALUE : item.unitPrice,
    }));
    return this.database.$transaction(
      async (transaction) => {
        const customer = await transaction.customer.findFirst({
          where: { id: input.customerId, companyId },
        });
        if (!customer) throw new BadRequestException("Cliente não encontrado.");
        const fiscalError = customerFiscalReadinessMessage(customer);
        if (fiscalError) throw new BadRequestException(fiscalError);
        if (input.brokerId) {
          const brokers = await transaction.$queryRaw<Array<{ id: string }>>(
            Prisma.sql`
              SELECT broker.id
                FROM "Broker" broker
                JOIN "StorefrontPartner" partner
                  ON partner.id = broker."businessPartnerId"
               WHERE broker.id = ${input.brokerId}
                 AND broker."companyId" = ${customer.companyId}
                 AND broker.active = TRUE
                 AND partner.active = TRUE
                 AND partner."isSalesBroker" = TRUE
               LIMIT 1
            `,
          );
          if (!brokers.length)
            throw new BadRequestException(
              "Corretor inválido ou inativo para esta empresa.",
            );
        }
        const salesChannel = input.salesChannelId
          ? await transaction.salesChannel.findFirst({
              where: {
                id: input.salesChannelId,
                companyId: customer.companyId,
                active: true,
              },
            })
          : null;
        if (input.salesChannelId && !salesChannel)
          throw new BadRequestException(
            "Canal de venda inválido para a empresa.",
          );
        const isInternationalSample =
          orderType === "SAMPLE" && salesChannel?.type === "EXPORTACAO";
        const customsDeclaredValue = Number(input.customsDeclaredValue);
        if (
          isInternationalSample &&
          (!Number.isFinite(customsDeclaredValue) || customsDeclaredValue <= 0)
        ) {
          throw new BadRequestException(
            "A amostra internacional exige valor aduaneiro declarado positivo.",
          );
        }
        const variants = await transaction.productVariant.findMany({
          where: {
            id: { in: pricedItems.map((item) => item.productVariantId) },
          },
          include: { product: { include: { productLine: true } } },
        });
        if (variants.length !== pricedItems.length)
          throw new BadRequestException(
            "Um ou mais ProductVariants não foram encontrados.",
          );
        const invalid = variants.find(
          (item) =>
            !item.active ||
            !item.product.active ||
            !item.product.productLine.active,
        );
        if (invalid)
          throw new BadRequestException(`SKU ${invalid.sku} está inativo.`);
        if (
          variants.some(
            (item) => item.product.productLine.companyId !== customer.companyId,
          )
        )
          throw new BadRequestException(
            "Cliente e produtos devem pertencer à mesma empresa.",
          );
        const discount = orderType === "SAMPLE" ? 0 : (input.discount ?? 0);
        const freight = orderType === "SAMPLE" ? 0 : (input.freight ?? 0);
        const totalQuantity = pricedItems.reduce(
          (sum, item) => sum + item.quantity,
          0,
        );
        const totalAmount = pricedItems.reduce(
          (sum, item) => sum + item.quantity * item.unitPrice,
          0,
        );
        return transaction.salesOrder.create({
          data: {
            companyId: customer.companyId,
            customerId: customer.id,
            brokerId: input.brokerId,
            brokerCommissionMode:
              orderType === "SAMPLE" ? undefined : input.brokerCommissionMode,
            brokerCommissionPercent:
              orderType === "SAMPLE"
                ? undefined
                : input.brokerCommissionPercent,
            brokerCommissionPerPackage:
              orderType === "SAMPLE"
                ? undefined
                : input.brokerCommissionPerPackage,
            brokerCommissionAmount:
              orderType === "SAMPLE" ? undefined : input.brokerCommissionAmount,
            salesChannelId: salesChannel?.id,
            currency:
              String(input.currency ?? salesChannel?.currency ?? "BRL")
                .trim()
                .toUpperCase() || "BRL",
            exchangeRateToBrl: input.exchangeRateToBrl,
            exchangeRateDate: input.exchangeRateDate
              ? new Date(input.exchangeRateDate)
              : undefined,
            customsDeclaredValue: isInternationalSample
              ? customsDeclaredValue
              : undefined,
            exportDepartureLocation: input.exportDepartureLocation,
            exportDepartureState: input.exportDepartureState,
            code: input.code,
            orderNumber: input.orderNumber ?? input.code,
            orderType,
            quantity: totalQuantity,
            unitPrice: totalQuantity ? totalAmount / totalQuantity : 0,
            totalAmount: totalAmount - discount + freight,
            subtotal: totalAmount,
            discount,
            freight,
            notes: input.notes,
            orderDate: new Date(),
            expectedDeliveryDate: input.expectedDeliveryDate
              ? new Date(input.expectedDeliveryDate)
              : undefined,
            status: SalesOrderStatus.DRAFT,
            items: {
              create: pricedItems.map((item) => {
                const variant = variants.find(
                  (candidate) => candidate.id === item.productVariantId,
                )!;
                return {
                  companyId: customer.companyId,
                  productVariantId: variant.id,
                  productName: variant.product.name,
                  sku: variant.sku,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  totalAmount: item.quantity * item.unitPrice,
                  pricingSource:
                    orderType === "SAMPLE"
                      ? "SAMPLE"
                      : (item.pricingSource ?? "CHANNEL"),
                  baseProductPriceId:
                    orderType === "SAMPLE"
                      ? undefined
                      : item.baseProductPriceId,
                  customerProductPriceId:
                    orderType === "SAMPLE"
                      ? undefined
                      : item.customerProductPriceId,
                  priceSnapshot: item.priceSnapshot ?? {
                    capturedAt: new Date().toISOString(),
                    source:
                      orderType === "SAMPLE"
                        ? "SAMPLE"
                        : (item.pricingSource ?? "CHANNEL"),
                    effectiveUnitPrice: item.unitPrice,
                    currency:
                      String(input.currency ?? salesChannel?.currency ?? "BRL")
                        .trim()
                        .toUpperCase() || "BRL",
                  },
                };
              }) as Prisma.SalesOrderItemUncheckedCreateWithoutSalesOrderInput[],
            },
          },
          include: this.orderInclude,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  async confirm(companyId: string, id: string) {
    const result = await this.database.$transaction(async (transaction) => {
      const order = await transaction.salesOrder.findFirst({
        where: { id, companyId },
        include: { items: true },
      });
      if (!order) throw new NotFoundException("Pedido não encontrado.");
      await this.termApprovals?.assertApproved(transaction, companyId, id);
      if (order.status === SalesOrderStatus.CONFIRMED) {
        await this.allocateRoastedWipForOrder(transaction, companyId, id);
        return { orderId: id, idempotent: true, status: order.status };
      }
      if (order.status !== SalesOrderStatus.DRAFT)
        throw new BadRequestException(
          "Somente pedidos em rascunho podem ser confirmados.",
        );
      if (!order.items.length)
        throw new BadRequestException(
          "Pedido legado sem itens não pode ser reservado automaticamente.",
        );
      await transaction.salesOrder.update({
        where: { id },
        data: { status: SalesOrderStatus.CONFIRMED },
      });
      await this.allocateRoastedWipForOrder(transaction, companyId, id);
      return {
        orderId: id,
        idempotent: false,
        status: SalesOrderStatus.CONFIRMED,
      };
    });
    await this.customerLifecycle.record(
      id,
      "ORDER_CONFIRMED",
      "Pedido confirmado",
      "O pedido foi confirmado pela equipe Bispo Coffees.",
      "BBOS",
      `sales-order:confirmed:${id}`,
      {},
      false,
    );
    return result;
  }

  async reserve(
    companyId: string,
    id: string,
    warehouseByVariant?: Record<string, string>,
  ) {
    return this.reserveWithStatuses(
      companyId,
      id,
      [SalesOrderStatus.CONFIRMED],
      warehouseByVariant,
    );
  }

  async reserveForPayment(
    companyId: string,
    id: string,
    warehouseByVariant?: Record<string, string>,
  ) {
    return this.reserveWithStatuses(
      companyId,
      id,
      [
        SalesOrderStatus.DRAFT,
        SalesOrderStatus.CONFIRMED,
        SalesOrderStatus.CANCELLED,
      ],
      warehouseByVariant,
    );
  }

  private async reserveWithStatuses(
    companyId: string,
    id: string,
    allowedStatuses: SalesOrderStatus[],
    warehouseByVariant?: Record<string, string>,
  ) {
    return this.database.$transaction(
      async (transaction) => {
        const locked = await transaction.$queryRaw<Array<{ id: string }>>`
          SELECT id
            FROM "SalesOrder"
           WHERE id=${id} AND "companyId"=${companyId}
           FOR UPDATE
        `;
        if (!locked[0]) throw new NotFoundException("Pedido não encontrado.");

        const order = await transaction.salesOrder.findFirst({
          where: { id, companyId },
          include: {
            items: {
              include: {
                productVariant: {
                  include: { product: { include: { productLine: true } } },
                },
              },
            },
            reservations: true,
          },
        });
        if (!order) throw new NotFoundException("Pedido não encontrado.");
        const activeReservations = order.reservations.filter(
          (reservation) =>
            reservation.status === InventoryReservationStatus.ACTIVE,
        );
        if (
          (order.status === SalesOrderStatus.RESERVED ||
            order.status === SalesOrderStatus.PICKING ||
            order.status === SalesOrderStatus.READY_TO_SHIP ||
            order.status === SalesOrderStatus.INVOICED) &&
          activeReservations.length === order.items.length
        )
          return {
            orderId: id,
            idempotent: true,
            reservations: activeReservations,
            status: order.status,
          };
        if (activeReservations.length) {
          throw new BadRequestException(
            "O pedido possui uma reserva de estoque incompleta e requer conferência.",
          );
        }
        if (!allowedStatuses.includes(order.status))
          throw new BadRequestException(
            "Somente pedidos confirmados podem reservar estoque.",
          );
        if (!order.items.length)
          throw new BadRequestException(
            "Pedido legado sem itens não pode ser reservado automaticamente.",
          );
        const unmappedWhiteLabel = order.items.find(
          (item) =>
            item.productVariant.product.commercialKind === "WHITE_LABEL" &&
            !item.productVariant.product.baseCoffeeProductId,
        );
        if (unmappedWhiteLabel)
          throw new BadRequestException(
            `O White Label ${unmappedWhiteLabel.productName} ainda não possui café-base definido. Vincule-o a uma linha e perfil antes de reservar.`,
          );

        await this.allocateRoastedWipForOrder(transaction, companyId, id);
        const bulkReservations = await transaction.$queryRawUnsafe<
          RoastedWipReservationRow[]
        >(
          `SELECT reservation.id,reservation."salesOrderItemId",
                    reservation."packageQuantity",reservation."requestedKg",
                    reservation."reservedKg",reservation.status,
                    stock_product.name AS "stockProductName",
                    stock_line.name AS "stockLineName"
               FROM "RoastedWipReservation" reservation
               JOIN "SalesOrderItem" item ON item.id=reservation."salesOrderItemId"
               JOIN "ProductVariant" variant ON variant.id=item."productVariantId"
               JOIN "Product" sale_product ON sale_product.id=variant."productId"
               JOIN "Product" stock_product
                 ON stock_product.id=COALESCE(sale_product."baseCoffeeProductId",sale_product.id)
               JOIN "ProductLine" stock_line ON stock_line.id=stock_product."productLineId"
              WHERE reservation."companyId"=$1
                AND reservation."salesOrderId"=$2
                AND reservation.status IN ('PENDING','PARTIAL','RESERVED')
              ORDER BY reservation.id
              FOR UPDATE OF reservation`,
          companyId,
          id,
        );
        for (const reservation of bulkReservations) {
          const requestedKg = Number(reservation.requestedKg);
          const reservedKg = Number(reservation.reservedKg);
          if (reservedKg + 0.0005 < requestedKg) {
            const missingKg = Math.max(0, requestedKg - reservedKg);
            throw new BadRequestException(
              `Café torrado a granel insuficiente para ${reservation.stockLineName} · ${reservation.stockProductName}: necessário ${requestedKg.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} kg, reservado ${reservedKg.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} kg, faltante ${missingKg.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} kg.`,
            );
          }
        }
        const bulkByItem = new Map(
          bulkReservations.map((reservation) => [
            reservation.salesOrderItemId,
            reservation,
          ]),
        );
        const requestedBalances = [];
        for (const item of order.items) {
          const warehouseId = warehouseByVariant?.[item.productVariantId];
          const bulkReservation = bulkByItem.get(item.id);
          const finishedQuantity = Math.max(
            0,
            item.quantity - Number(bulkReservation?.packageQuantity ?? 0),
          );
          if (finishedQuantity <= 0) continue;
          const previousReservation = order.reservations.find(
            (reservation) => reservation.salesOrderItemId === item.id,
          );
          if (
            previousReservation?.status === InventoryReservationStatus.CONSUMED
          ) {
            throw new BadRequestException(
              "Estoque já consumido não pode ser reservado novamente.",
            );
          }
          const balance = previousReservation
            ? await transaction.finishedProduct.findFirst({
                where: {
                  id: previousReservation.finishedProductId,
                  companyId,
                  ...(warehouseId ? { warehouseId } : {}),
                },
              })
            : await transaction.finishedProduct.findFirst({
                where: {
                  companyId,
                  productVariantId: item.productVariantId,
                  ...(warehouseId ? { warehouseId } : {}),
                },
              });
          if (!balance) throw this.insufficient(item, 0);
          requestedBalances.push({
            item,
            balance,
            previousReservation,
            reserveQuantity: finishedQuantity,
          });
        }
        requestedBalances.sort((a, b) =>
          a.balance.id.localeCompare(b.balance.id),
        );
        for (const entry of requestedBalances) {
          await transaction.$queryRaw`SELECT id FROM "FinishedProduct" WHERE id = ${entry.balance.id} FOR UPDATE`;
          const current = await transaction.finishedProduct.findUniqueOrThrow({
            where: { id: entry.balance.id },
          });
          const available = current.quantityOnHand - current.reservedQuantity;
          if (entry.reserveQuantity > available)
            throw this.insufficient(entry.item, available);
          reserveSalesStock(
            salesInventoryBalance(
              current.quantityOnHand,
              current.reservedQuantity,
            ),
            entry.reserveQuantity,
          );
          await transaction.finishedProduct.update({
            where: { id: current.id },
            data: { reservedQuantity: { increment: entry.reserveQuantity } },
          });
          if (entry.previousReservation) {
            await transaction.inventoryReservation.update({
              where: { id: entry.previousReservation.id },
              data: {
                productVariantId: entry.item.productVariantId,
                finishedProductId: current.id,
                warehouseId: current.warehouseId,
                quantity: entry.reserveQuantity,
                status: InventoryReservationStatus.ACTIVE,
                releasedAt: null,
              },
            });
          } else {
            await transaction.inventoryReservation.create({
              data: {
                companyId: order.companyId,
                salesOrderId: order.id,
                salesOrderItemId: entry.item.id,
                productVariantId: entry.item.productVariantId,
                finishedProductId: current.id,
                warehouseId: current.warehouseId,
                quantity: entry.reserveQuantity,
                idempotencyKey: `SALES_RESERVATION:${entry.item.id}`,
              },
            });
          }
        }
        const nextStatus = bulkReservations.length
          ? SalesOrderStatus.IN_PRODUCTION
          : SalesOrderStatus.RESERVED;
        await transaction.salesOrder.update({
          where: { id },
          data: { status: nextStatus },
        });
        return {
          orderId: id,
          idempotent: false,
          reservations: await transaction.inventoryReservation.findMany({
            where: { salesOrderId: id },
          }),
          bulkReservations: bulkReservations.map((reservation) => ({
            id: reservation.id,
            salesOrderItemId: reservation.salesOrderItemId,
            packageQuantity: Number(reservation.packageQuantity),
            requestedKg: Number(reservation.requestedKg),
            reservedKg: Number(reservation.reservedKg),
            status: reservation.status,
            line: reservation.stockLineName,
            product: reservation.stockProductName,
          })),
          status: nextStatus,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  async cancel(companyId: string, id: string) {
    return this.database.$transaction(
      async (transaction) => {
        const locked = await transaction.$queryRaw<Array<{ id: string }>>`
          SELECT id
            FROM "SalesOrder"
           WHERE id=${id} AND "companyId"=${companyId}
           FOR UPDATE
        `;
        if (!locked[0]) throw new NotFoundException("Pedido não encontrado.");

        const order = await transaction.salesOrder.findFirst({
          where: { id, companyId },
          include: { reservations: true },
        });
        if (!order) throw new NotFoundException("Pedido não encontrado.");
        const activeReservations = order.reservations.filter(
          (reservation) =>
            reservation.status === InventoryReservationStatus.ACTIVE,
        );
        if (
          order.status === SalesOrderStatus.CANCELLED &&
          activeReservations.length === 0
        )
          return { orderId: id, idempotent: true };
        if (
          order.status === SalesOrderStatus.SHIPPED ||
          order.status === SalesOrderStatus.DELIVERED
        )
          throw new BadRequestException(
            "Pedido expedido não pode ser cancelado por este fluxo.",
          );
        const receivable = await transaction.accountsReceivable.findUnique({
          where: { salesOrderId: order.id },
          select: { status: true, openAmount: true },
        });
        if (
          receivable?.status === "PAID" ||
          (receivable && Number(receivable.openAmount) <= 0)
        ) {
          throw new BadRequestException(
            "Pedido com pagamento confirmado não pode ser cancelado sem estorno financeiro.",
          );
        }
        for (const reservation of activeReservations.sort((a, b) =>
          a.finishedProductId.localeCompare(b.finishedProductId),
        )) {
          await transaction.$queryRaw`SELECT id FROM "FinishedProduct" WHERE id = ${reservation.finishedProductId} FOR UPDATE`;
          const balance = await transaction.finishedProduct.findUniqueOrThrow({
            where: { id: reservation.finishedProductId },
          });
          releaseSalesStock(
            salesInventoryBalance(
              balance.quantityOnHand,
              balance.reservedQuantity,
            ),
            reservation.quantity,
          );
          await transaction.finishedProduct.update({
            where: { id: balance.id },
            data: { reservedQuantity: { decrement: reservation.quantity } },
          });
          await transaction.inventoryReservation.update({
            where: { id: reservation.id },
            data: {
              status: InventoryReservationStatus.RELEASED,
              releasedAt: new Date(),
            },
          });
        }
        await this.releaseRoastedWipForOrder(transaction, companyId, id);
        await transaction.salesOrder.update({
          where: { id },
          data: { status: SalesOrderStatus.CANCELLED },
        });
        return { orderId: id, idempotent: false };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  async ship(companyId: string, id: string) {
    const result = await this.database.$transaction(
      async (transaction) => {
        const order = await transaction.salesOrder.findFirst({
          where: { id, companyId },
          include: {
            reservations: {
              include: { productVariant: true, salesOrderItem: true },
            },
            finishedGoodsMovements: true,
          },
        });
        if (!order) throw new NotFoundException("Pedido não encontrado.");
        if (
          order.status === SalesOrderStatus.SHIPPED &&
          order.finishedGoodsMovements.length
        )
          return {
            orderId: id,
            idempotent: true,
            movements: order.finishedGoodsMovements,
          };
        const shippableStatuses: SalesOrderStatus[] = [
          SalesOrderStatus.CONFIRMED,
          SalesOrderStatus.RESERVED,
          SalesOrderStatus.PICKING,
          SalesOrderStatus.READY_TO_SHIP,
          SalesOrderStatus.INVOICED,
        ];
        if (!shippableStatuses.includes(order.status))
          throw new BadRequestException(
            "Somente pedidos reservados e prontos para expedição podem ser expedidos.",
          );
        const fiscalDocuments = await transaction.$queryRawUnsafe<any[]>(
          `SELECT status FROM "FiscalDocument"
            WHERE "salesOrderId"=$1 AND direction='OUTBOUND'
            ORDER BY "createdAt" DESC LIMIT 1`,
          order.id,
        );
        if (String(fiscalDocuments[0]?.status) !== "AUTHORIZED") {
          throw new BadRequestException(
            "A NF-e vigente precisa estar autorizada pela SEFAZ antes da expedição.",
          );
        }
        const normalizedTerms = String(order.paymentTermsSnapshot ?? "")
          .trim()
          .toLowerCase();
        const cashSale =
          order.paymentType === "CASH" ||
          (order.paymentType === "LEGACY" &&
            (!normalizedTerms ||
              normalizedTerms === "à vista" ||
              normalizedTerms === "a vista" ||
              normalizedTerms === "pix"));
        if (cashSale) {
          const paymentRows = await transaction.$queryRawUnsafe<
            Array<{ paid: boolean }>
          >(
            `SELECT (
                EXISTS (
                  SELECT 1 FROM "SalesOrderPaymentAttempt" attempt
                   WHERE attempt."salesOrderId"=$1 AND attempt.status='PAID'
                ) OR EXISTS (
                  SELECT 1 FROM "AccountsReceivable" receivable
                   WHERE receivable."salesOrderId"=$1 AND receivable.status='PAID'
                )
              ) AS paid`,
            order.id,
          );
          if (!paymentRows[0]?.paid)
            throw new BadRequestException(
              "A NF-e pode ser emitida antes do pagamento, mas a expedição de uma venda à vista exige a baixa financeira.",
            );
        }
        if (order.shippingProvider === "MELHOR_ENVIO") {
          const shipments = await transaction.$queryRawUnsafe<any[]>(
            `SELECT status,"labelUrl" FROM "Shipment" WHERE "salesOrderId"=$1 LIMIT 1`,
            order.id,
          );
          const shipment = shipments[0];
          if (
            !shipment?.labelUrl ||
            ![
              "LABEL_READY",
              "POSTED",
              "IN_TRANSIT",
              "OUT_FOR_DELIVERY",
              "DELIVERED",
            ].includes(String(shipment.status))
          ) {
            throw new BadRequestException(
              "A etiqueta do Melhor Envio precisa estar pronta antes de expedir o pedido.",
            );
          }
        }
        const active = order.reservations
          .filter((item) => item.status === InventoryReservationStatus.ACTIVE)
          .sort((a, b) =>
            a.finishedProductId.localeCompare(b.finishedProductId),
          );
        if (!active.length)
          throw new BadRequestException("Pedido não possui reservas ativas.");
        if (order.status !== SalesOrderStatus.INVOICED) {
          await transaction.salesOrder.update({
            where: { id },
            data: {
              status: SalesOrderStatus.INVOICED,
              invoicedAt: order.invoicedAt ?? new Date(),
            },
          });
        }
        const movementIds: string[] = [];
        for (const reservation of active) {
          await transaction.$queryRaw`SELECT id FROM "FinishedProduct" WHERE id = ${reservation.finishedProductId} FOR UPDATE`;
          const balance = await transaction.finishedProduct.findUniqueOrThrow({
            where: { id: reservation.finishedProductId },
          });
          shipSalesStock(
            salesInventoryBalance(
              balance.quantityOnHand,
              balance.reservedQuantity,
            ),
            reservation.quantity,
          );
          await transaction.finishedProduct.update({
            where: { id: balance.id },
            data: {
              quantityOnHand: { decrement: reservation.quantity },
              reservedQuantity: { decrement: reservation.quantity },
            },
          });
          const movement = await transaction.finishedGoodsMovement.create({
            data: {
              companyId: order.companyId,
              salesOrderId: order.id,
              salesOrderItemId: reservation.salesOrderItemId,
              reservationId: reservation.id,
              productVariantId: reservation.productVariantId,
              finishedProductId: reservation.finishedProductId,
              warehouseId: reservation.warehouseId,
              type: FinishedGoodsMovementType.SALE_OUT,
              packageQuantity: reservation.quantity,
              unit: reservation.productVariant.salesUnit,
              totalWeightKg:
                (reservation.quantity *
                  reservation.productVariant.netWeightGrams) /
                1000,
              sourceType: "SALES_ORDER",
              sourceId: order.id,
              idempotencyKey: `SALE_OUT:${reservation.salesOrderItemId}`,
              reason: `Expedição do pedido ${order.code}`,
            },
          });
          movementIds.push(movement.id);
          await transaction.inventoryReservation.update({
            where: { id: reservation.id },
            data: {
              status: InventoryReservationStatus.CONSUMED,
              consumedAt: new Date(),
            },
          });
        }
        await transaction.salesOrder.update({
          where: { id },
          data: { status: SalesOrderStatus.SHIPPED },
        });
        return { orderId: id, idempotent: false, movementIds };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
    await this.customerLifecycle.record(
      id,
      "SHIPPED",
      "Pedido a caminho",
      "Seu pedido foi expedido pela Bispo Coffees e está a caminho.",
      "BBOS",
      `sales-order:shipped:${id}`,
    );
    return result;
  }

  async transition(
    companyId: string,
    id: string,
    target: "PICKING" | "READY_TO_SHIP" | "INVOICED",
  ) {
    const allowed: Record<string, SalesOrderStatus[]> = {
      PICKING: [SalesOrderStatus.RESERVED],
      READY_TO_SHIP: [SalesOrderStatus.PICKING],
      INVOICED: [SalesOrderStatus.READY_TO_SHIP],
    };
    const status = SalesOrderStatus[target];
    const result = await this.database.$transaction(async (transaction) => {
      const order = await transaction.salesOrder.findFirst({
        where: { id, companyId },
        select: {
          id: true,
          status: true,
          companyId: true,
          customerId: true,
          totalAmount: true,
          orderNumber: true,
          code: true,
          brokerId: true,
          brokerCommissionPercent: true,
          brokerCommissionMode: true,
          brokerCommissionPerPackage: true,
          brokerCommissionAmount: true,
          orderType: true,
        },
      });
      if (!order) throw new NotFoundException("Pedido não encontrado.");
      if (order.status === status)
        return { orderId: id, idempotent: true, status };
      if (!allowed[target]!.includes(order.status))
        throw new BadRequestException(
          `Transição inválida: ${order.status} → ${target}.`,
        );
      await transaction.salesOrder.update({
        where: { id },
        data: {
          status,
          ...(target === "INVOICED" ? { invoicedAt: new Date() } : {}),
        },
      });
      if (target === "INVOICED" && order.orderType !== "SAMPLE") {
        const invoice = await transaction.accountsReceivable.findUnique({
          where: { salesOrderId: id },
        });
        if (!invoice) {
          const issueDate = new Date();
          const dueDate = new Date(issueDate);
          dueDate.setDate(dueDate.getDate() + 30);
          await transaction.accountsReceivable.create({
            data: {
              companyId: order.companyId,
              customerId: order.customerId,
              salesOrderId: id,
              issueDate,
              dueDate,
              amount: order.totalAmount,
              openAmount: order.totalAmount,
              status: "OPEN",
            },
          });
        }
        if (order.brokerId && Number(order.brokerCommissionAmount ?? 0) > 0) {
          const payableKey = `sales-order:${order.id}:broker-commission`;
          const existingPayable = await transaction.accountsPayable.findUnique({
            where: { brokerCommissionPayableKey: payableKey },
          });
          if (!existingPayable) {
            const issueDate = new Date();
            await transaction.accountsPayable.create({
              data: {
                companyId: order.companyId,
                brokerId: order.brokerId,
                supplierId: null,
                brokerCommissionPayableKey: payableKey,
                description: `${order.orderNumber ?? order.code} · comissão de corretagem da venda`,
                issueDate,
                dueDate: issueDate,
                amount: order.brokerCommissionAmount!,
                openAmount: order.brokerCommissionAmount!,
                status: "OPEN",
                category: "COMISSAO_VENDA",
                notes:
                  order.brokerCommissionMode === "PER_PACKAGE"
                    ? `Comissão de R$ ${Number(
                        order.brokerCommissionPerPackage ?? 0,
                      )
                        .toFixed(2)
                        .replace(".", ",")} por pacote vendido.`
                    : `Comissão de ${order.brokerCommissionPercent ?? 0}% sobre os produtos do pedido.`,
              },
            });
          }
        }
      }
      return { orderId: id, idempotent: false, status };
    });
    if (target === "PICKING") {
      await this.customerLifecycle.record(
        id,
        "PREPARING",
        "Pedido em preparação",
        "Seu café entrou na fila de separação e preparação da Bispo Coffees.",
        "BBOS",
        `sales-order:preparing:${id}`,
      );
    }
    return result;
  }

  async confirmPicking(
    companyId: string,
    id: string,
    pickedByItem: Record<string, number>,
  ) {
    return this.database.$transaction(async (transaction) => {
      const order = await transaction.salesOrder.findFirst({
        where: { id, companyId },
        include: { items: { include: { reservations: true } } },
      });
      if (!order) throw new NotFoundException("Pedido não encontrado.");
      if (order.status === SalesOrderStatus.READY_TO_SHIP)
        return { orderId: id, idempotent: true, status: order.status };
      if (order.status !== SalesOrderStatus.PICKING)
        throw new BadRequestException("O pedido precisa estar em separação.");
      for (const item of order.items) {
        const reservation = item.reservations.find(
          (entry) => entry.status === InventoryReservationStatus.ACTIVE,
        );
        const reserved = reservation?.quantity ?? 0;
        const picked = pickedByItem[item.id] ?? -1;
        if (
          !Number.isSafeInteger(picked) ||
          picked < 0 ||
          picked !== reserved
        ) {
          throw new BadRequestException({
            code: "PICKING_DIVERGENCE",
            itemId: item.id,
            reserved,
            picked: picked < 0 ? null : picked,
            message:
              "A quantidade separada deve ser exatamente igual à reservada.",
          });
        }
        await transaction.salesOrderItem.update({
          where: { id: item.id },
          data: { pickedQuantity: picked, pickedAt: new Date() },
        });
      }
      await transaction.salesOrder.update({
        where: { id },
        data: { status: SalesOrderStatus.READY_TO_SHIP },
      });
      return {
        orderId: id,
        idempotent: false,
        status: SalesOrderStatus.READY_TO_SHIP,
      };
    });
  }

  private insufficient(
    item: { sku: string; productName: string; quantity: number },
    available: number,
  ) {
    const missing = Math.max(0, item.quantity - available);
    return new BadRequestException({
      message: `Estoque insuficiente para ${item.productName} (${item.sku}): solicitado ${item.quantity}, disponível ${available}, faltante ${missing}.`,
      code: "INSUFFICIENT_STOCK",
      product: item.productName,
      sku: item.sku,
      requested: item.quantity,
      available,
      missing,
    });
  }

  private readonly orderInclude = {
    customer: true,
    broker: true,
    salesChannel: true,
    finishedProduct: true,
    items: {
      include: {
        productVariant: {
          include: { product: { include: { productLine: true } } },
        },
        reservations: true,
      },
    },
    reservations: true,
    finishedGoodsMovements: true,
  } satisfies Prisma.SalesOrderInclude;
}
