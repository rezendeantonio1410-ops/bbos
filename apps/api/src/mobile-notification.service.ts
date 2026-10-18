import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { prisma, UserRole } from "@bbos/database";
import webPush from "web-push";
import { buildPushPayload, safePushHref } from "./mobile-push";
import { notificationHref } from "./notification-links";

type QueueInput = {
  companyId: string;
  userIds: string[];
  idempotencyKey: string;
  type: string;
  title: string;
  message: string;
  href: string;
  entityType?: string;
  entityId?: string;
  sourceOperationalNotificationId?: string;
};

@Injectable()
export class MobileNotificationService {
  private readonly logger = new Logger(MobileNotificationService.name);
  private readonly db = prisma;
  private readonly publicKey =
    process.env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim() ?? "";
  private readonly privateKey =
    process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim() ?? "";
  private readonly subject =
    process.env.WEB_PUSH_VAPID_SUBJECT?.trim() ||
    "mailto:jrezende@bispocoffees.com.br";
  private readonly configured =
    process.env.WEB_PUSH_ENABLED === "true" &&
    Boolean(this.publicKey && this.privateKey);

  constructor() {
    if (this.configured)
      webPush.setVapidDetails(this.subject, this.publicKey, this.privateKey);
  }

  async status(userId: string) {
    const activeSubscriptions = await this.db.pushSubscription.count({
      where: { userId, enabled: true },
    });
    return {
      enabled: this.configured,
      publicKey: this.configured ? this.publicKey : null,
      activeSubscriptions,
    };
  }

  async subscribe(
    actor: { id: string; companyId: string },
    input: { endpoint: string; p256dh: string; auth: string },
    userAgent?: string,
  ) {
    const subscription = await this.db.pushSubscription.upsert({
      where: { endpoint: input.endpoint },
      create: {
        companyId: actor.companyId,
        userId: actor.id,
        endpoint: input.endpoint,
        p256dh: input.p256dh,
        auth: input.auth,
        userAgent: userAgent?.slice(0, 500),
      },
      update: {
        companyId: actor.companyId,
        userId: actor.id,
        p256dh: input.p256dh,
        auth: input.auth,
        userAgent: userAgent?.slice(0, 500),
        enabled: true,
        failureCount: 0,
      },
    });
    await this.db.mobileNotification.updateMany({
      where: {
        userId: actor.id,
        pushSentAt: null,
        createdAt: { gte: new Date(Date.now() - 7 * 86400000) },
      },
      data: { pushAttempts: 0, pushError: null },
    });
    return { id: subscription.id, enabled: subscription.enabled };
  }

  async unsubscribe(userId: string, endpoint: string) {
    const result = await this.db.pushSubscription.updateMany({
      where: { userId, endpoint },
      data: { enabled: false },
    });
    return { ok: true, updated: result.count };
  }

  async list(userId: string) {
    const items = await this.db.mobileNotification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 40,
    });
    return {
      unreadCount: items.filter((item) => !item.readAt).length,
      items: items.map((item) => ({
        id: item.id,
        type: item.type,
        title: item.title,
        message: item.message,
        href: safePushHref(item.href),
        readAt: item.readAt?.toISOString() ?? null,
        createdAt: item.createdAt.toISOString(),
      })),
    };
  }

  async read(userId: string, id: string) {
    const result = await this.db.mobileNotification.updateMany({
      where: { id, userId },
      data: { readAt: new Date() },
    });
    return { ok: Boolean(result.count) };
  }

  async queueForRoles(
    input: Omit<QueueInput, "userIds"> & { roles: UserRole[] },
  ) {
    const users = await this.db.user.findMany({
      where: {
        companyId: input.companyId,
        active: true,
        role: { in: input.roles },
      },
      select: { id: true },
    });
    return this.queue({ ...input, userIds: users.map((user) => user.id) });
  }

  async queue(input: QueueInput) {
    const uniqueUserIds = [...new Set(input.userIds)].filter(Boolean);
    if (!uniqueUserIds.length) return [];
    const validUsers = await this.db.user.findMany({
      where: {
        id: { in: uniqueUserIds },
        companyId: input.companyId,
        active: true,
      },
      select: { id: true },
    });
    return Promise.all(
      validUsers.map((user) =>
        this.db.mobileNotification.upsert({
          where: {
            userId_idempotencyKey: {
              userId: user.id,
              idempotencyKey: input.idempotencyKey,
            },
          },
          create: {
            companyId: input.companyId,
            userId: user.id,
            sourceOperationalNotificationId:
              input.sourceOperationalNotificationId,
            idempotencyKey: input.idempotencyKey,
            type: input.type,
            title: input.title,
            message: input.message,
            href: safePushHref(input.href),
            entityType: input.entityType,
            entityId: input.entityId,
          },
          update: {},
        }),
      ),
    );
  }

  async sendTest(actor: { id: string; companyId: string; name: string }) {
    if (!this.configured)
      throw new ServiceUnavailableException(
        "O envio push ainda não foi ativado neste ambiente.",
      );
    const [notification] = await this.queue({
      companyId: actor.companyId,
      userIds: [actor.id],
      idempotencyKey: `push-test:${actor.id}:${Date.now()}`,
      type: "PUSH_TEST",
      title: "BBOS conectado",
      message: `${actor.name}, as notificações deste iPhone estão ativas.`,
      href: "/aplicativo",
    });
    if (!notification)
      throw new ServiceUnavailableException("Não foi possível criar o teste.");
    const delivered = await this.deliver(notification.id);
    if (!delivered)
      throw new ServiceUnavailableException(
        "Nenhum iPhone ativo recebeu a notificação de teste.",
      );
    return { ok: true, notificationId: notification.id };
  }

  async processNext() {
    if (!this.configured) return false;
    await this.bridgeOperationalNotifications();
    const enabledAt = process.env.WEB_PUSH_ENABLED_AT
      ? new Date(process.env.WEB_PUSH_ENABLED_AT)
      : new Date(Date.now() - 86400000);
    const notification = await this.db.mobileNotification.findFirst({
      where: {
        pushSentAt: null,
        pushAttempts: { lt: 5 },
        createdAt: { gte: enabledAt },
      },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (!notification) return false;
    return this.deliver(notification.id);
  }

  private async bridgeOperationalNotifications() {
    const enabledAt = process.env.WEB_PUSH_ENABLED_AT
      ? new Date(process.env.WEB_PUSH_ENABLED_AT)
      : new Date(Date.now() - 86400000);
    const operational = await this.db.operationalNotification.findMany({
      where: {
        createdAt: { gte: enabledAt },
        mobilePushBridgedAt: null,
      },
      orderBy: { createdAt: "asc" },
      take: 20,
    });
    for (const item of operational) {
      const roles =
        item.targetRole === "ALL"
          ? Object.values(UserRole)
          : Object.values(UserRole).includes(item.targetRole as UserRole)
            ? [item.targetRole as UserRole]
            : [];
      if (!roles.length) {
        await this.db.operationalNotification.update({
          where: { id: item.id },
          data: { mobilePushBridgedAt: new Date() },
        });
        continue;
      }
      await this.queueForRoles({
        companyId: item.companyId,
        roles,
        idempotencyKey: `operational:${item.id}`,
        type: item.type,
        title: item.title,
        message: item.message,
        href: notificationHref(item.type, item.purchaseId),
        sourceOperationalNotificationId: item.id,
        entityType: item.purchaseId ? "GREEN_COFFEE_PURCHASE" : undefined,
        entityId: item.purchaseId ?? undefined,
      });
      await this.db.operationalNotification.update({
        where: { id: item.id },
        data: { mobilePushBridgedAt: new Date() },
      });
    }
  }

  private async deliver(id: string) {
    const notification = await this.db.mobileNotification.findUnique({
      where: { id },
    });
    if (!notification || notification.pushSentAt) return false;
    const subscriptions = await this.db.pushSubscription.findMany({
      where: { userId: notification.userId, enabled: true },
    });
    if (!subscriptions.length) {
      await this.db.mobileNotification.update({
        where: { id },
        data: {
          pushAttempts: { increment: 1 },
          pushError: "Nenhum dispositivo ativo para este usuário.",
        },
      });
      return false;
    }

    let delivered = 0;
    let lastError = "Não foi possível entregar a notificação.";
    for (const subscription of subscriptions) {
      try {
        await webPush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          buildPushPayload(notification),
          { TTL: 3600, urgency: "high" },
        );
        delivered += 1;
        await this.db.pushSubscription.update({
          where: { id: subscription.id },
          data: {
            failureCount: 0,
            lastSuccessfulAt: new Date(),
          },
        });
      } catch (error) {
        const statusCode = Number(
          (error as { statusCode?: unknown })?.statusCode ?? 0,
        );
        lastError = error instanceof Error ? error.message : String(error);
        await this.db.pushSubscription.update({
          where: { id: subscription.id },
          data: {
            enabled: statusCode === 404 || statusCode === 410 ? false : true,
            failureCount: { increment: 1 },
          },
        });
        this.logger.warn(
          `Falha no Web Push para ${subscription.id}: ${lastError}`,
        );
      }
    }
    await this.db.mobileNotification.update({
      where: { id },
      data: {
        pushAttempts: { increment: 1 },
        pushSentAt: delivered ? new Date() : null,
        pushError: delivered ? null : lastError.slice(0, 1_000),
      },
    });
    return delivered > 0;
  }
}
