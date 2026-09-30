import { Controller, Get, NotFoundException, Param, Patch, Req } from "@nestjs/common";
import { prisma } from "@bbos/database";

type AuthenticatedRequest = {
  user: { companyId: string; role: string };
};

function notificationHref(type: string, purchaseId: string | null) {
  if (type.startsWith("GREEN_COFFEE")) return purchaseId ? `/compras-cafe-verde/${purchaseId}` : "/recebimento";
  if (type.startsWith("FINANCE")) return "/financeiro";
  if (type.startsWith("FISCAL")) return "/notas-entrada";
  if (type.startsWith("SALES") || type.startsWith("ORDER")) return "/pedidos";
  return "/home";
}

@Controller("notifications")
export class NotificationsController {
  @Get()
  async list(@Req() request: AuthenticatedRequest) {
    const { companyId, role } = request.user;
    const notifications = await prisma.operationalNotification.findMany({
      where: { companyId, targetRole: { in: [role, "ALL"] } },
      orderBy: { createdAt: "desc" },
      take: 40,
    });
    return {
      updatedAt: new Date().toISOString(),
      unreadCount: notifications.filter((item) => !item.readAt).length,
      items: notifications.map((item) => ({
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
    if (!result.count) throw new NotFoundException("Notificação não encontrada.");
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
