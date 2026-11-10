import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Req,
} from "@nestjs/common";
import { prisma } from "@bbos/database";
import { notificationHref } from "./notification-links";

type AuthenticatedRequest = {
  user: { companyId: string; role: string };
};

@Controller("notifications")
export class NotificationsController {
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
    const notifications = await prisma.operationalNotification.findMany({
      where: { companyId, targetRole: { in: [role, "ALL"] } },
      orderBy: { createdAt: "desc" },
      take: 40,
    });
    const visibleNotifications =
      role === "SALES"
        ? await this.visibleToSales(notifications, companyId)
        : notifications;
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
    const result = await prisma.operationalNotification.updateMany({
      where: { id, companyId, targetRole: { in: [role, "ALL"] } },
      data: { readAt: new Date() },
    });
    if (!result.count)
      throw new NotFoundException("Notificação não encontrada.");
    return { ok: true };
  }

  @Patch("read-all")
  async readAll(@Req() request: AuthenticatedRequest) {
    const { companyId, role } = request.user;
    const result = await prisma.operationalNotification.updateMany({
      where: { companyId, targetRole: { in: [role, "ALL"] }, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true, updated: result.count };
  }
}
