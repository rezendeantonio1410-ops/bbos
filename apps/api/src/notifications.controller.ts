import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Req,
} from "@nestjs/common";
import { prisma } from "@bbos/database";
import {
  deliveryExceptionShipmentId,
  keepCurrentCreditDecisions,
  keepOpenDeliveryExceptions,
  notificationHref,
} from "./notification-links";

type AuthenticatedRequest = {
  user: { companyId: string; role: string };
};

@Controller("notifications")
export class NotificationsController {
  private async keepOnlyOpenDeliveryExceptions(
    notifications: any[],
    companyId: string,
  ) {
    const shipmentIds = [
      ...new Set(
        notifications
          .map((item) => deliveryExceptionShipmentId(item.type))
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    if (!shipmentIds.length) return notifications;

    const openShipments = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT alert_shipment.id
         FROM "Shipment" alert_shipment
         LEFT JOIN "SalesOrder" so ON so.id=alert_shipment."salesOrderId"
         LEFT JOIN "StorefrontOrder" storefront ON storefront.id=alert_shipment."storefrontOrderId"
        WHERE alert_shipment."companyId"=$1
          AND alert_shipment.id=ANY($2::text[])
          AND alert_shipment.status='EXCEPTION'
          AND (so.id IS NULL OR so.status NOT IN ('DELIVERED','CANCELLED'))
          AND (storefront.id IS NULL OR storefront.status NOT IN ('DELIVERED','CANCELLED'))
          AND NOT EXISTS (
            SELECT 1
              FROM "Shipment" resolved
             WHERE resolved."companyId"=alert_shipment."companyId"
               AND resolved.status='DELIVERED'
               AND resolved."updatedAt">=alert_shipment."updatedAt"
               AND (
                 (alert_shipment."salesOrderId" IS NOT NULL
                   AND resolved."salesOrderId"=alert_shipment."salesOrderId")
                 OR
                 (alert_shipment."storefrontOrderId" IS NOT NULL
                   AND resolved."storefrontOrderId"=alert_shipment."storefrontOrderId")
               )
          )`,
      companyId,
      shipmentIds,
    );

    return keepOpenDeliveryExceptions(
      notifications,
      new Set(openShipments.map((shipment) => shipment.id)),
    );
  }

  private async visibleToSales(notifications: any[], companyId: string) {
    const shipmentIds = notifications
      .filter((item) => item.type.startsWith("ORDER_DELIVERY_EXCEPTION:"))
      .map((item) => item.type.split(":")[1])
      .filter(Boolean);
    if (!shipmentIds.length) return notifications;
    const visible = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT sh.id
         FROM "Shipment" sh
         LEFT JOIN "SalesOrder" so ON so.id=sh."salesOrderId"
         LEFT JOIN "SalesChannel" channel ON channel.id=so."salesChannelId"
        WHERE sh."companyId"=$1 AND sh.id=ANY($2::text[])
          AND sh."storefrontOrderId" IS NULL
          AND so.id IS NOT NULL
          AND so."externalOrderId" IS NULL
          AND so."importedAt" IS NULL
          AND (channel.id IS NULL OR (channel.type::text<>'ECOMMERCE' AND channel."platformCode" IS NULL))`,
      companyId,
      shipmentIds,
    );
    const visibleIds = new Set(visible.map((item) => item.id));
    return notifications.filter(
      (item) =>
        !item.type.startsWith("ORDER_DELIVERY_EXCEPTION:") ||
        visibleIds.has(item.type.split(":")[1]),
    );
  }

  @Get()
  async list(@Req() request: AuthenticatedRequest) {
    const { companyId, role } = request.user;
    const targetRoles = role === "ACCOUNTANT" ? ["ACCOUNTANT"] : [role, "ALL"];
    const notifications = await prisma.operationalNotification.findMany({
      where: { companyId, targetRole: { in: targetRoles } },
      orderBy: { createdAt: "desc" },
      take: 40,
    });
    const roleVisibleNotifications =
      role === "SALES"
        ? await this.visibleToSales(notifications, companyId)
        : notifications;
    const operationallyCurrentNotifications =
      await this.keepOnlyOpenDeliveryExceptions(
        roleVisibleNotifications,
        companyId,
      );
    const visibleNotifications = keepCurrentCreditDecisions(
      operationallyCurrentNotifications,
    );
    return {
      updatedAt: new Date().toISOString(),
      unreadCount: visibleNotifications.filter((item) => !item.readAt).length,
      items: visibleNotifications.map((item) => ({
        id: item.id,
        type: item.type,
        title: item.title,
        message: item.message,
        href: notificationHref(item.type, item.purchaseId),
        readAt: item.readAt?.toISOString() ?? null,
        createdAt: item.createdAt.toISOString(),
      })),
    };
  }

  @Patch(":id/read")
  async read(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    const { companyId, role } = request.user;
    const targetRoles = role === "ACCOUNTANT" ? ["ACCOUNTANT"] : [role, "ALL"];
    const result = await prisma.operationalNotification.updateMany({
      where: { id, companyId, targetRole: { in: targetRoles } },
      data: { readAt: new Date() },
    });
    if (!result.count)
      throw new NotFoundException("Notificação não encontrada.");
    return { ok: true };
  }

  @Patch("read-all")
  async readAll(@Req() request: AuthenticatedRequest) {
    const { companyId, role } = request.user;
    const targetRoles = role === "ACCOUNTANT" ? ["ACCOUNTANT"] : [role, "ALL"];
    const result = await prisma.operationalNotification.updateMany({
      where: { companyId, targetRole: { in: targetRoles }, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true, updated: result.count };
  }
}
