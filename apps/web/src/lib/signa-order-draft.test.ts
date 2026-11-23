import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createSignaOrderDraft, parseSignaOrderDraft, signaOrderDraftKey, signaServerDraftEditTarget } from "./signa-order-draft";

const allowed = new Set(["reserva-500", "reserva-1000"]);

test("persists only allowed products, quantities and operational date, not customer or fiscal data", () => {
  const input = [{ productVariantId: "reserva-500", quantity: 2, customerName: "Private", unitPrice: 76.8 }];
  const draft = createSignaOrderDraft(input, allowed, "PICKUP", "2026-12-15", 100000);
  assert.ok(draft);
  assert.deepEqual(draft.lines, [{ productVariantId: "reserva-500", quantity: 2 }]);
  assert.equal(JSON.stringify(draft).includes("Private"), false);
  assert.equal(JSON.stringify(draft).includes("76.8"), false);
  assert.deepEqual(parseSignaOrderDraft(JSON.stringify(draft), allowed, 100100), draft);
});

test("rejects disabled catalog SKUs, repeated SKUs, invalid quantity and impossible date", () => {
  assert.equal(createSignaOrderDraft([{ productVariantId: "other", quantity: 1 }], allowed, "PICKUP", ""), null);
  assert.equal(createSignaOrderDraft([{ productVariantId: "reserva-500", quantity: 0 }], allowed, "PICKUP", ""), null);
  assert.equal(createSignaOrderDraft([{ productVariantId: "reserva-500", quantity: 1.5 }], allowed, "PICKUP", ""), null);
  assert.equal(createSignaOrderDraft([{ productVariantId: "reserva-500", quantity: 1 }, { productVariantId: "reserva-500", quantity: 1 }], allowed, "PICKUP", ""), null);
  assert.equal(createSignaOrderDraft([{ productVariantId: "reserva-500", quantity: 1 }], allowed, "PICKUP", "2026-02-30"), null);
});

test("recovery requires current catalog permission, valid storage and 30-day TTL", () => {
  const draft = createSignaOrderDraft([{ productVariantId: "reserva-1000", quantity: 3 }], allowed, "CUSTOMER_CARRIER", "", 100000);
  assert.ok(draft);
  assert.equal(parseSignaOrderDraft(JSON.stringify(draft), new Set(["reserva-500"]), 100001), null);
  assert.equal(parseSignaOrderDraft(JSON.stringify(draft), allowed, 100000 + 31 * 86400000), null);
  assert.equal(parseSignaOrderDraft("{bad", allowed), null);
  assert.equal(parseSignaOrderDraft(JSON.stringify({ ...draft, savedAt: 200000 }), allowed, 100000), null);
  const scope = { companyId: "bispo", partnerId: "signa", userId: "user-1" };
  assert.notEqual(signaOrderDraftKey(scope, "buyer-a"), signaOrderDraftKey(scope, "buyer-b"));
});


test("recovery strips injected customer, fiscal and pricing fields from forged local storage", () => {
  const original = createSignaOrderDraft([{ productVariantId: "reserva-500", quantity: 1 }], allowed, "PICKUP", "", 100000);
  assert.ok(original);
  const poisoned = {
    ...original,
    customerId: "private-customer",
    billingRecipientId: "private-billing",
    totalAmount: 99999,
    lines: [{ productVariantId: "reserva-500", quantity: 1, unitPrice: 76.8, taxId: "private-tax-id" }],
  };
  const restored = parseSignaOrderDraft(JSON.stringify(poisoned), allowed, 100001);
  assert.deepEqual(restored, original);
  for (const sensitive of ["private-customer", "private-billing", "private-tax-id", "76.8", "99999"]) {
    assert.equal(JSON.stringify(restored).includes(sensitive), false);
  }
});


test("shared-browser drafts are isolated by company, partner and authenticated user", () => {
  const scope = { companyId: "bispo", partnerId: "signa", userId: "person-1" };
  const original = signaOrderDraftKey(scope, "commercial-buyer");
  assert.equal(original.startsWith("bbos:signa-order-draft:v2:"), true);
  assert.notEqual(original, signaOrderDraftKey({ ...scope, userId: "person-2" }, "commercial-buyer"));
  assert.notEqual(original, signaOrderDraftKey({ ...scope, partnerId: "another-partner" }, "commercial-buyer"));
  assert.notEqual(original, signaOrderDraftKey({ ...scope, companyId: "other-company" }, "commercial-buyer"));
  assert.notEqual(original, "bbos:signa-order-draft:v1:commercial-buyer");
  assert.notEqual(signaOrderDraftKey(scope, "a:b"), signaOrderDraftKey(scope, "a%3Ab"));
  assert.throws(() => signaOrderDraftKey({ ...scope, userId: "" }, "commercial-buyer"));
  assert.throws(() => signaOrderDraftKey(scope, ""));
});

test("selection alone cannot overwrite an unrelated or stale server draft", () => {
  const authorized = new Set(["draft-a", "draft-b"]);
  assert.equal(signaServerDraftEditTarget("draft-a", "draft-a", authorized), "draft-a");
  assert.equal(signaServerDraftEditTarget("draft-b", "draft-a", authorized), null);
  assert.equal(signaServerDraftEditTarget("draft-b", "", authorized), null);
  assert.equal(signaServerDraftEditTarget("", "draft-a", authorized), null);
  assert.equal(signaServerDraftEditTarget("draft-missing", "draft-missing", authorized), null);
  // Selecting a different draft and then returning to the recovered one is safe.
  assert.equal(signaServerDraftEditTarget("draft-a", "draft-a", authorized), "draft-a");
});

test("switching drafts or retrying recovery revokes the previous PATCH authority", () => {
  const form = readFileSync(new URL("../app/parceiro/PartnerOrderWorkspace.tsx", import.meta.url), "utf8");
  const restore = form.slice(
    form.indexOf("  async function restoreServerDraft()"),
    form.indexOf("  // Copy the selected server draft"),
  );
  assert.match(restore, /setRecoveredServerDraftId\(""{0,1}\);/);
  // The revocation must run BEFORE the network fetch, even when that fetch fails.
  assert.ok(restore.indexOf('setRecoveredServerDraftId("")') < restore.indexOf('await portalApi<ServerOrderDraft>("/order-drafts/"'));
  assert.match(form, /onChange=\{event => \{ setServerDraftId\(event\.target\.value\); setRecoveredServerDraftId\(""{0,1}\); \}\}/);
  const allowed = new Set(["draft-a", "draft-b"]);
  assert.equal(signaServerDraftEditTarget("draft-a", "", allowed), null);
  assert.equal(signaServerDraftEditTarget("draft-b", "draft-a", allowed), null);
});

test("form edits a persisted draft only after an explicit recovery", () => {
  const form = readFileSync(new URL("../app/parceiro/PartnerOrderWorkspace.tsx", import.meta.url), "utf8");
  assert.match(form, /const editTarget = signaServerDraftEditTarget\(/);
  assert.match(form, /const previous = serverDrafts\.find\(draft => draft\.id === editTarget\)/);
  assert.match(form, /setRecoveredServerDraftId\(saved\.id\)/);
  assert.match(form, /setRecoveredServerDraftId\(""\)/);
  // A rejected save must revoke the in-form edit authority before refreshing versions.
  assert.match(form, /setRecoveredServerDraftId\(""\);\s*await refreshServerDrafts\(\)/);
});
