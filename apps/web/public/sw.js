const CACHE_VERSION = "bbos-mobile-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter((key) => key.startsWith("bbos-mobile-") && key !== CACHE_VERSION)
              .map((key) => caches.delete(key)),
          ),
        ),
    ]),
  );
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data?.json() ?? {};
  } catch {
    payload = { body: event.data?.text() ?? "Existe uma nova atenção no BBOS." };
  }
  const data = payload.data && typeof payload.data === "object" ? payload.data : {};
  const href =
    typeof data.href === "string" && data.href.startsWith("/") && !data.href.startsWith("//")
      ? data.href
      : "/home";
  event.waitUntil(
    self.registration.showNotification(payload.title || "BBOS", {
      body: payload.body || "Existe uma nova atenção no BBOS.",
      icon: payload.icon || "/icons/bbos-192.png",
      badge: payload.badge || "/icons/bbos-badge-96.png",
      tag: payload.tag || undefined,
      renotify: Boolean(payload.tag),
      data: { ...data, href },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const href =
    typeof data.href === "string" && data.href.startsWith("/") && !data.href.startsWith("//")
      ? data.href
      : "/home";
  event.waitUntil(
    (async () => {
      if (typeof data.notificationId === "string") {
        await fetch(`/api/push/notifications/${encodeURIComponent(data.notificationId)}/read`, {
          method: "PATCH",
          credentials: "include",
        }).catch(() => undefined);
      }
      const target = new URL(href, self.location.origin).href;
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of windows) {
        if ("navigate" in client) await client.navigate(target);
        if ("focus" in client) return client.focus();
      }
      return self.clients.openWindow(target);
    })(),
  );
});
