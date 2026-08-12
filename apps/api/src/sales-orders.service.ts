import {
  BadRequestException,
  Injectable,
  NotFoundException,
  type OnModuleDestroy,
} from "@nestjs/common";
import {
  FinishedGoodsMovementType,
  InventoryReservationStatus,
  Prisma,
  PrismaClient,
  SalesOrderStatus,
} from "@bbos/database";
import { CommercialPriceService } from "./commercial-price.service";
import {
  releaseSalesStock,
  reserveSalesStock,
  salesInventoryBalance,
  shipSalesStock,
} from "@bbos/shared";

export type CreateSalesOrderInput = {
  code: string;
  orderNumber?: string;
  customerId: string;
  salesChannelId?: string;
  expectedDeliveryDate?: string;
  discount?: number;
  freight?: number;
  notes?: string;
  items: Array<{
    productVariantId: string;
    warehouseId: string;
    quantity: number;
    unitPrice: number;
  }>;
  salesPersonId?: string;
  confirmPrice?: boolean;
};

@Injectable()
export class SalesOrdersService implements OnModuleDestroy {
  readonly database = new PrismaClient();

  constructor(private readonly priceResolver: CommercialPriceService) {}

  onModuleDestroy() {
    return this.database.$disconnect();
  }

  list() {
    return this.database.salesOrder.findMany({
      include: this.orderInclude,
      orderBy: { orderedAt: "desc" },
    });
  }

  async get(id: string) {
    const order = await this.database.salesOrder.findUnique({
      where: { id },
      include: this.orderInclude,
    });
    if (!order) throw new NotFoundException("Pedido não encontrado.");
    return order;
  }

  async options() {
    const [customers, balances] = await Promise.all([
      this.database.customer.findMany({ orderBy: { name: "asc" } }),
      this.database.finishedProduct.findMany({
        where: { productVariantId: { not: null } },
        include: {
          warehouse: true,
          productVariant: {
            include: { product: { include: { productLine: true } } },
          },
        },
      }),
    ]);
    return {
      customers,
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

  async create(input: CreateSalesOrderInput) {
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
    return this.database.$transaction(
      async (transaction) => {
        const customer = await transaction.customer.findUnique({
          where: { id: input.customerId },
        });
        if (!customer) throw new BadRequestException("Cliente não encontrado.");
        const salesChannel = input.salesChannelId
          ? await transaction.salesChannel.findFirst({ where: { id: input.salesChannelId, companyId: customer.companyId, active: true } })
          : null;
        if (input.salesChannelId && !salesChannel) throw new BadRequestException("Canal de venda inválido para a empresa.");
        const variants = await transaction.productVariant.findMany({
          where: {
            id: { in: input.items.map((item) => item.productVariantId) },
          },
          include: { product: { include: { productLine: true } } },
        });
        if (variants.length !== input.items.length)
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
        const resolvedPrices = await Promise.all(input.items.map((item) => this.priceResolver.resolve({ companyId: customer.companyId, customerId: customer.id, salesPersonId: input.salesPersonId, productVariantId: item.productVariantId, channel: salesChannel?.type })));
        const priceChanged = resolvedPrices.find((resolved, index) => resolved.price != null && Number(resolved.price) !== Number(input.items[index]!.unitPrice));
        if (priceChanged && !input.confirmPrice) {
          throw new BadRequestException({ code: "PRICE_CHANGED_DURING_ORDER", message: "Um ou mais preços foram atualizados.", prices: resolvedPrices.map((resolved, index) => ({ productVariantId: input.items[index]!.productVariantId, previous: input.items[index]!.unitPrice, current: resolved.price, priceTableId: resolved.priceTableId, validFrom: resolved.validFrom })) });
        }
        const appliedItems = input.items.map((item, index) => ({ item, resolved: resolvedPrices[index]!, unitPrice: resolvedPrices[index]!.price ?? item.unitPrice }));
        const totalQuantity = input.items.reduce(
          (sum, item) => sum + item.quantity,
          0,
        );
        const totalAmount = appliedItems.reduce(
          (sum, entry) => sum + entry.item.quantity * Number(entry.unitPrice),
          0,
        );
        return transaction.salesOrder.create({
          data: {
            companyId: customer.companyId,
            customerId: customer.id,
            salesChannelId: salesChannel?.id,
            code: input.code,
            orderNumber: input.orderNumber ?? input.code,
            quantity: totalQuantity,
            unitPrice: totalQuantity ? totalAmount / totalQuantity : 0,
            totalAmount:
              totalAmount - (input.discount ?? 0) + (input.freight ?? 0),
            subtotal: totalAmount,
            discount: input.discount ?? 0,
            freight: input.freight ?? 0,
            notes: input.notes,
            orderDate: new Date(),
            expectedDeliveryDate: input.expectedDeliveryDate
              ? new Date(input.expectedDeliveryDate)
              : undefined,
            status: SalesOrderStatus.DRAFT,
            salesPersonId: input.salesPersonId,
            items: {
              create: appliedItems.map(({ item, resolved, unitPrice }) => {
                const variant = variants.find(
                  (candidate) => candidate.id === item.productVariantId,
                )!;
                return {
                  companyId: customer.companyId,
                  productVariantId: variant.id,
                  productName: variant.product.name,
                  sku: variant.sku,
                  quantity: item.quantity,
                  unitPrice,
                  totalAmount: item.quantity * Number(unitPrice),
                  priceTableId: resolved.priceTableId,
                  priceValidAt: resolved.validFrom ?? new Date(),
                  promotionId: resolved.promotion?.id,
                };
              }),
            },
          },
          include: this.orderInclude,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  async confirm(id: string) {
    return this.database.$transaction(async (transaction) => {
      const order = await transaction.salesOrder.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!order) throw new NotFoundException("Pedido não encontrado.");
      if (order.status === SalesOrderStatus.CONFIRMED)
        return { orderId: id, idempotent: true, status: order.status };
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
      return {
        orderId: id,
        idempotent: false,
        status: SalesOrderStatus.CONFIRMED,
      };
    });
  }

  async reserve(id: string, warehouseByVariant?: Record<string, string>) {
    return this.database.$transaction(
      async (transaction) => {
        const order = await transaction.salesOrder.findUnique({
          where: { id },
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
        if (
          (order.status === SalesOrderStatus.RESERVED ||
            order.status === SalesOrderStatus.PICKING ||
            order.status === SalesOrderStatus.READY_TO_SHIP ||
            order.status === SalesOrderStatus.INVOICED) &&
          order.reservations.length
        )
          return {
            orderId: id,
            idempotent: true,
            reservations: order.reservations,
            status: order.status,
          };
        if (order.status !== SalesOrderStatus.CONFIRMED)
          throw new BadRequestException(
            "Somente pedidos confirmados podem reservar estoque.",
          );
        if (!order.items.length)
          throw new BadRequestException(
            "Pedido legado sem itens não pode ser reservado automaticamente.",
          );
        const requestedBalances = [];
        for (const item of order.items) {
          const warehouseId = warehouseByVariant?.[item.productVariantId];
          const balance = await transaction.finishedProduct.findFirst({
            where: {
              productVariantId: item.productVariantId,
              ...(warehouseId ? { warehouseId } : {}),
            },
          });
          if (!balance) throw this.insufficient(item, 0);
          requestedBalances.push({ item, balance });
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
          if (entry.item.quantity > available)
            throw this.insufficient(entry.item, available);
          reserveSalesStock(
            salesInventoryBalance(
              current.quantityOnHand,
              current.reservedQuantity,
            ),
            entry.item.quantity,
          );
          await transaction.finishedProduct.update({
            where: { id: current.id },
            data: { reservedQuantity: { increment: entry.item.quantity } },
          });
          await transaction.inventoryReservation.create({
            data: {
              companyId: order.companyId,
              salesOrderId: order.id,
              salesOrderItemId: entry.item.id,
              productVariantId: entry.item.productVariantId,
              finishedProductId: current.id,
              warehouseId: current.warehouseId,
              quantity: entry.item.quantity,
              idempotencyKey: `SALES_RESERVATION:${entry.item.id}`,
            },
          });
        }
        await transaction.salesOrder.update({
          where: { id },
          data: { status: SalesOrderStatus.RESERVED },
        });
        return {
          orderId: id,
          idempotent: false,
          reservations: await transaction.inventoryReservation.findMany({
            where: { salesOrderId: id },
          }),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  async cancel(id: string) {
    return this.database.$transaction(
      async (transaction) => {
        const order = await transaction.salesOrder.findUnique({
          where: { id },
          include: { reservations: true },
        });
        if (!order) throw new NotFoundException("Pedido não encontrado.");
        if (order.status === SalesOrderStatus.CANCELLED)
          return { orderId: id, idempotent: true };
        if (
          order.status === SalesOrderStatus.SHIPPED ||
          order.status === SalesOrderStatus.DELIVERED
        )
          throw new BadRequestException(
            "Pedido expedido não pode ser cancelado por este fluxo.",
          );
        for (const reservation of order.reservations
          .filter((item) => item.status === InventoryReservationStatus.ACTIVE)
          .sort((a, b) =>
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
        await transaction.salesOrder.update({
          where: { id },
          data: { status: SalesOrderStatus.CANCELLED },
        });
        return { orderId: id, idempotent: false };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  async ship(id: string) {
    return this.database.$transaction(
      async (transaction) => {
        const order = await transaction.salesOrder.findUnique({
          where: { id },
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
        const active = order.reservations
          .filter((item) => item.status === InventoryReservationStatus.ACTIVE)
          .sort((a, b) =>
            a.finishedProductId.localeCompare(b.finishedProductId),
          );
        if (!active.length)
          throw new BadRequestException("Pedido não possui reservas ativas.");
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
  }

  async transition(
    id: string,
    target: "PICKING" | "READY_TO_SHIP" | "INVOICED",
  ) {
    const allowed: Record<string, SalesOrderStatus[]> = {
      PICKING: [SalesOrderStatus.RESERVED],
      READY_TO_SHIP: [SalesOrderStatus.PICKING],
      INVOICED: [SalesOrderStatus.READY_TO_SHIP],
    };
    const status = SalesOrderStatus[target];
    return this.database.$transaction(async (transaction) => {
      const order = await transaction.salesOrder.findUnique({
        where: { id },
        select: { id: true, status: true, companyId: true, customerId: true, totalAmount: true },
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
      if (target === "INVOICED") {
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
      }
      return { orderId: id, idempotent: false, status };
    });
  }

  async confirmPicking(id: string, pickedByItem: Record<string, number>) {
    return this.database.$transaction(async (transaction) => {
      const order = await transaction.salesOrder.findUnique({
        where: { id },
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
    return new BadRequestException({
      code: "INSUFFICIENT_STOCK",
      product: item.productName,
      sku: item.sku,
      requested: item.quantity,
      available,
      missing: Math.max(0, item.quantity - available),
    });
  }

  private readonly orderInclude = {
    customer: true,
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
