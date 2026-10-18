export type PushServerStatus = {
  enabled: boolean;
  publicKey: string | null;
  activeSubscriptions: number;
};

export type MobileInstallState = {
  isIos: boolean;
  isStandalone: boolean;
  supportsPush: boolean;
};

declare global {
  interface Navigator {
    standalone?: boolean;
  }
}

export function mobileInstallState(): MobileInstallState {
  if (typeof window === "undefined")
    return { isIos: false, isStandalone: false, supportsPush: false };
  const isIos = /iPad|iPhone|iPod/.test(window.navigator.userAgent);
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;
  const supportsPush =
    "serviceWorker" in window.navigator &&
    "PushManager" in window &&
    "Notification" in window;
  return { isIos, isStandalone, supportsPush };
}

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
}

export async function registerBbosServiceWorker() {
  if (!("serviceWorker" in navigator))
    throw new Error("Este navegador não oferece suporte ao aplicativo BBOS.");
  const registration = await navigator.serviceWorker.register("/sw.js", {
    scope: "/",
  });
  await navigator.serviceWorker.ready;
  return registration;
}

export async function enablePushSubscription(publicKey: string) {
  const registration = await registerBbosServiceWorker();
  const permission = await Notification.requestPermission();
  if (permission !== "granted")
    throw new Error(
      "A permissão de notificações não foi concedida neste iPhone.",
    );
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    }));
  const serialized = subscription.toJSON();
  const response = await fetch("/api/push/subscription", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(serialized),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(
      payload?.message || "Não foi possível ativar as notificações.",
    );
  }
  return subscription;
}

export async function currentPushSubscription() {
  if (!("serviceWorker" in navigator)) return null;
  const registration = await registerBbosServiceWorker();
  return registration.pushManager.getSubscription();
}

export async function disablePushSubscription() {
  const subscription = await currentPushSubscription();
  if (!subscription) return;
  await fetch("/api/push/subscription", {
    method: "DELETE",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  });
  await subscription.unsubscribe();
}
