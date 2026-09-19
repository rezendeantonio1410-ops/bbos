import { BadRequestException, Injectable } from "@nestjs/common";
import {
  PrismaClient,
  SalesChannelType,
  SalesOrderStatus,
} from "@bbos/database";
import { SalesOrdersService } from "./sales-orders.service";

const skuByStorefrontId: Record<string, string> = {
  essencial: "GOU-ESS-500",
  intenso: "GOU-INT-500",
  caramelo: "CLA-CAR-500",
  "doce-de-leite": "CLA-DOC-500",
  tangerina: "CLA-TAN-500",
  singular: "EPI-SIN-500",
  sublime: "EPI-SUB-500",
};

@Injectable()
export class StorefrontInventoryService {
  private readonly database = new PrismaClient();

  constructor(private readonly salesOrders: SalesOrdersService) {}

  async ensureReserved(storefrontOrderId: string) {
    const rows = await this.database.$queryRawUnsafe<any[]>(
      `SELECT * FROM "StorefrontOrder" WHERE id=$1 LIMIT 1`,
      storefrontOrderId,
    );
    const storefront = rows[0];
    if (!storefront) throw new Error("Pedido da loja não encontrado.");
    if (storefront.fulfillmentStatus === "RESERVED")
      return { status: "RESERVED", idempotent: true };

    try {
      const customerData = storefront.customer as {
        name?: string;
        cpf?: string;
      };
      const customerTaxId = customerData.cpf?.trim();
      let customer = customerTaxId
        ? await this.database.customer.findFirst({
            where: {
              companyId: storefront.companyId,
              taxId: customerTaxId,
            },
          })
        : null;
      if (!customer)
        customer = await this.database.customer.create({
          data: {
            companyId: storefront.companyId,
            name: customerData.name || "Cliente da loja",
            taxId: customerTaxId || null,
            segment: "E-COMMERCE",
          },
        });
      const channel = await this.database.salesChannel.upsert({
        where: {
          companyId_code: {
            companyId: storefront.companyId,
            code: "ECOMMERCE",
          },
        },
        update: { active: true },
        create: {
          companyId: storefront.companyId,
          code: "ECOMMERCE",
          name: "Loja Bispo Coffees",
          type: SalesChannelType.ECOMMERCE,
          active: true,
          country: "BR",
          currency: "BRL",
        },
      });

      const rawItems = storefront.items as Array<{
        id: string;
        quantity: number;
        unitPriceCents: number;
      }>;
      const storefrontItems = Array.from(
        rawItems.reduce((items, item) => {
          const current = items.get(item.id);
          items.set(item.id, {
            ...item,
            quantity: (current?.quantity ?? 0) + item.quantity,
          });
          return items;
        }, new Map<string, (typeof rawItems)[number]>()),
      ).map(([, item]) => item);
      const skus = storefrontItems.map((item) => skuByStorefrontId[item.id]);
      if (skus.some((sku) => !sku))
        throw new Error("Um item da loja não possui SKU operacional.");
      const validSkus = skus as string[];
      const variants = await this.database.productVariant.findMany({
        where: { sku: { in: validSkus } },
        include: {
          finishedProducts: { orderBy: { quantityOnHand: "desc" } },
        },
      });
      if (variants.length !== new Set(validSkus).size)
        throw new Error("Catálogo operacional incompleto para este pedido.");

      const warehouseByVariant: Record<string, string> = {};
      for (const item of storefrontItems) {
        const variant = variants.find(
          (candidate) => candidate.sku === skuByStorefrontId[item.id],
        )!;
        const balance = variant.finishedProducts.find(
          (candidate) =>
            candidate.quantityOnHand - candidate.reservedQuantity >=
            item.quantity,
        );
        if (!balance)
          throw new Error(`Estoque insuficiente para o SKU ${variant.sku}.`);
        warehouseByVariant[variant.id] = balance.warehouseId;
      }

      let salesOrder = storefront.salesOrderId
        ? await this.database.salesOrder.findUnique({
            where: { id: storefront.salesOrderId },
          })
        : await this.database.salesOrder.findFirst({
            where: { companyId: storefront.companyId, code: storefront.code },
          });
      if (!salesOrder) {
        salesOrder = await this.salesOrders.create({
          code: storefront.code,
          orderNumber: storefront.code,
          customerId: customer.id,
          salesChannelId: channel.id,
          freight: storefront.shippingCents / 100,
          notes: `Pedido originado na loja Bispo Coffees (${storefront.id})`,
          items: storefrontItems.map((item) => {
            const variant = variants.find(
              (candidate) => candidate.sku === skuByStorefrontId[item.id],
            )!;
            return {
              productVariantId: variant.id,
              warehouseId: warehouseByVariant[variant.id]!,
              quantity: item.quantity,
              unitPrice: item.unitPriceCents / 100,
            };
          }),
        });
      }
      await this.database.$executeRawUnsafe(
        `UPDATE "StorefrontOrder" SET "salesOrderId"=$2,"updatedAt"=NOW() WHERE id=$1`,
        storefront.id,
        salesOrder.id,
      );
      if (salesOrder.status === SalesOrderStatus.DRAFT)
        await this.salesOrders.confirm(salesOrder.id);
      await this.salesOrders.reserve(salesOrder.id, warehouseByVariant);
      await this.database.$executeRawUnsafe(
        `UPDATE "StorefrontOrder" SET "fulfillmentStatus"='RESERVED',"updatedAt"=NOW() WHERE id=$1`,
        storefront.id,
      );
      return { status: "RESERVED", salesOrderId: salesOrder.id };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message.slice(0, 500)
          : "Erro desconhecido";
      const waitingStock = /saldo|estoque/i.test(message);
      await this.database.$executeRawUnsafe(
        `UPDATE "StorefrontOrder" SET "fulfillmentStatus"=$2,"updatedAt"=NOW() WHERE id=$1`,
        storefront.id,
        waitingStock ? "WAITING_STOCK" : "ERROR",
      );
      throw error;
    }
  }

  private async linkedOrder(storefrontOrderId: string) {
    const rows = await this.database.$queryRawUnsafe<any[]>(
      `SELECT id,"salesOrderId","fulfillmentStatus",status
         FROM "StorefrontOrder" WHERE id=$1 LIMIT 1`,
      storefrontOrderId,
    );
    const order = rows[0];
    if (!order) throw new BadRequestException("Pedido da loja não encontrado.");
    if (!order.salesOrderId)
      throw new BadRequestException(
        "Pedido ainda não possui reserva operacional.",
      );
    return order as {
      id: string;
      salesOrderId: string;
      fulfillmentStatus: string;
      status: string;
    };
  }

  private async setFulfillment(storefrontOrderId: string, status: string) {
    await this.database.$executeRawUnsafe(
      `UPDATE "StorefrontOrder" SET "fulfillmentStatus"=$2,"updatedAt"=NOW() WHERE id=$1`,
      storefrontOrderId,
      status,
    );
  }

  async startPicking(storefrontOrderId: string) {
    const order = await this.linkedOrder(storefrontOrderId);
    if (order.fulfillmentStatus === "PICKING")
      return { status: "PICKING", idempotent: true };
    await this.salesOrders.transition(order.salesOrderId, "PICKING");
    await this.setFulfillment(order.id, "PICKING");
    return { status: "PICKING", idempotent: false };
  }

  async completePicking(
    storefrontOrderId: string,
    pickedByItem: Record<string, number>,
  ) {
    const order = await this.linkedOrder(storefrontOrderId);
    if (order.fulfillmentStatus === "READY_TO_SHIP")
      return { status: "READY_TO_SHIP", idempotent: true };
    await this.salesOrders.confirmPicking(order.salesOrderId, pickedByItem);
    await this.setFulfillment(order.id, "READY_TO_SHIP");
    return { status: "READY_TO_SHIP", idempotent: false };
  }

  async markShipped(storefrontOrderId: string) {
    const order = await this.linkedOrder(storefrontOrderId);
    if (order.fulfillmentStatus === "SHIPPED")
      return { status: "SHIPPED", idempotent: true };
    const shipments = await this.database.$queryRawUnsafe<any[]>(
      `SELECT status FROM "StorefrontShipment" WHERE "orderId"=$1 LIMIT 1`,
      storefrontOrderId,
    );
    if (!shipments[0] || shipments[0].status !== "LABEL_READY")
      throw new BadRequestException(
        "A etiqueta de envio precisa estar pronta.",
      );
    await this.salesOrders.ship(order.salesOrderId);
    await this.setFulfillment(order.id, "SHIPPED");
    return { status: "SHIPPED", idempotent: false };
  }

  async markDelivered(storefrontOrderId: string) {
    const order = await this.linkedOrder(storefrontOrderId);
    if (order.fulfillmentStatus === "DELIVERED")
      return { status: "DELIVERED", idempotent: true };
    const salesOrder = await this.database.salesOrder.findUnique({
      where: { id: order.salesOrderId },
      select: { status: true },
    });
    if (salesOrder?.status !== SalesOrderStatus.SHIPPED)
      throw new BadRequestException(
        "Somente um pedido expedido pode ser marcado como entregue.",
      );
    await this.database.salesOrder.update({
      where: { id: order.salesOrderId },
      data: { status: SalesOrderStatus.DELIVERED, deliveredAt: new Date() },
    });
    await this.setFulfillment(order.id, "DELIVERED");
    return { status: "DELIVERED", idempotent: false };
  }
}
