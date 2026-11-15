import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPushPayload,
  normalizePushSubscription,
  safePushHref,
} from "./mobile-push";

test("push href only accepts same-origin paths", () => {
  assert.equal(safePushHref("/laboratorio"), "/laboratorio");
  assert.equal(safePushHref("https://example.com"), "/home");
  assert.equal(safePushHref("//example.com"), "/home");
});

test("push subscription requires secure endpoint and browser keys", () => {
  const normalized = normalizePushSubscription({
    endpoint: "https://push.example.test/device/123",
    keys: {
      p256dh: "a".repeat(65),
      auth: "b".repeat(16),
    },
  });
  assert.equal(normalized.endpoint, "https://push.example.test/device/123");
  assert.throws(() =>
    normalizePushSubscription({
      endpoint: "http://push.example.test/device/123",
      keys: { p256dh: "a".repeat(65), auth: "b".repeat(16) },
    }),
  );
});

test("push payload carries a safe deep link", () => {
  const payload = JSON.parse(
    buildPushPayload({
      id: "notification-1",
      title: "Nova prova",
      message: "Existe uma amostra aguardando avaliação.",
      href: "//unsafe.example",
    }),
  );
  assert.equal(payload.data.href, "/home");
  assert.equal(payload.tag, "bbos-notification-1");
});
