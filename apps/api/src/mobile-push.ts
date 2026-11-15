import { BadRequestException } from "@nestjs/common";

export type PushSubscriptionInput = {
  endpoint?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown } | null;
};

export type NormalizedPushSubscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export function safePushHref(value: unknown) {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\n") ||
    value.includes("\r")
  )
    return "/home";
  return value;
}

export function normalizePushSubscription(
  body: PushSubscriptionInput,
): NormalizedPushSubscription {
  const endpoint =
    typeof body.endpoint === "string" ? body.endpoint.trim() : "";
  const p256dh =
    typeof body.keys?.p256dh === "string" ? body.keys.p256dh.trim() : "";
  const auth = typeof body.keys?.auth === "string" ? body.keys.auth.trim() : "";

  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new BadRequestException("Inscrição de notificações inválida.");
  }
  if (
    url.protocol !== "https:" ||
    endpoint.length > 2_048 ||
    p256dh.length < 20 ||
    p256dh.length > 512 ||
    auth.length < 8 ||
    auth.length > 256
  )
    throw new BadRequestException("Inscrição de notificações inválida.");

  return { endpoint, p256dh, auth };
}

export function buildPushPayload(notification: {
  id: string;
  title: string;
  message: string;
  href: string;
}) {
  return JSON.stringify({
    title: notification.title,
    body: notification.message,
    icon: "/icons/bbos-192.png",
    badge: "/icons/bbos-badge-96.png",
    tag: `bbos-${notification.id}`,
    data: {
      href: safePushHref(notification.href),
      notificationId: notification.id,
    },
  });
}
