import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  hashSignaOrderSubmissionRequest,
  parseSignaOrderSubmissionKey,
  resolveSignaSubmissionReplay,
  splitSignaSubmission,
} from "./signa-order-idempotency";

test("chave de submissão exige formato estável e não aceita caracteres de controle", () => {
  const key = "b2e5d40c-c041-4e08-a588-214a63fa2181";
  assert.equal(parseSignaOrderSubmissionKey(key), key);
  for (const invalid of [null, "", "short", "p".repeat(129), " key-1234567890123456",
    "key-1234567890123456\\n", "key/1234567890123456", 42]) {
    assert.throws(() => parseSignaOrderSubmissionKey(invalid));
  }
});

test("fingerprint é determinístico para objetos com chaves em ordem diferente", () => {
  const first = { customerId: "c1", items: [{ productVariantId: "v1", quantity: 5 }],
    billingRecipientId: "f1", paymentType: "TERM", paymentTermDays: 30 };
  const reordered = { paymentTermDays: 30, billingRecipientId: "f1", paymentType: "TERM",
    items: [{ quantity: 5, productVariantId: "v1" }], customerId: "c1" };
  assert.equal(hashSignaOrderSubmissionRequest(first),
    hashSignaOrderSubmissionRequest(reordered));
});

test("mesma chave não poderá representar destinatário, quantidades ou condições diferentes", () => {
  const baseline = { customerId: "c1", billingRecipientId: "f1",
    items: [{ productVariantId: "v1", quantity: 1 }], paymentType: "CASH" };
  const original = hashSignaOrderSubmissionRequest(baseline);
  for (const modified of [
    { ...baseline, billingRecipientId: "f2" },
    { ...baseline, items: [{ productVariantId: "v1", quantity: 2 }] },
    { ...baseline, paymentType: "TERM", paymentTermDays: 30 },
  ]) {
    assert.notEqual(hashSignaOrderSubmissionRequest(modified), original);
  }
});

test("recusa corpo inválido, valores não serializáveis e payload excessivo", () => {
  for (const invalid of [null, [], "pedido", { quantity: Infinity },
    { callback: () => 1 }, { notes: "x".repeat(65537) }]) {
    assert.throws(() => hashSignaOrderSubmissionRequest(invalid));
  }
});

test("migração de submissão exige unicidade por empresa, parceiro, usuário e chave", () => {
  const migration = readFileSync(
    join(__dirname, "../../../packages/database/prisma/migrations/20261123150000_signa_order_submission_claims/migration.sql"),
    "utf8",
  );
  const schema = readFileSync(
    join(__dirname, "../../../packages/database/prisma/schema.prisma"),
    "utf8",
  );
  assert.match(migration, /CREATE UNIQUE INDEX "PartnerOrderSubmission_scope_key_unique"[\s\S]*?\("companyId", "partnerId", "userId", "submissionKey"\)/);
  assert.match(schema, /@@unique\(\[companyId, partnerId, userId, submissionKey\], map: "PartnerOrderSubmission_scope_key_unique"\)/);
  assert.match(migration, /"requestHash" ~ '\^\[0-9a-f\]\{64\}\$'/);
  assert.match(migration, /"salesOrderId" TEXT/);
  assert.match(migration, /status = 'COMPLETED' AND "salesOrderId" IS NOT NULL AND "completedAt" IS NOT NULL/);
  assert.match(migration, /FOREIGN KEY \("salesOrderId"\) REFERENCES "SalesOrder"\(id\) ON DELETE RESTRICT/);
  assert.doesNotMatch(migration, /(?:UPDATE|DELETE FROM|ALTER TABLE)\s+"(?:SalesOrder|Payment|AccountsReceivable)"/i);
});

test("reenvio com mesma chave e mesmo conteúdo devolve o pedido original", () => {
  const hash = "a".repeat(64);
  assert.deepEqual(
    resolveSignaSubmissionReplay({ status: "COMPLETED", requestHash: hash, salesOrderId: "so-1" }, hash),
    { kind: "replay", salesOrderId: "so-1" },
  );
  assert.deepEqual(
    resolveSignaSubmissionReplay({ status: "COMPLETED", requestHash: hash, salesOrderId: "so-1" }, "b".repeat(64)),
    { kind: "payload-mismatch" },
  );
  assert.deepEqual(
    resolveSignaSubmissionReplay({ status: "CLAIMED", requestHash: hash, salesOrderId: null }, hash),
    { kind: "in-progress" },
  );
});

test("chave de envio não participa do fingerprint do pedido", () => {
  const payload = { customerId: "c1", items: [{ productVariantId: "v1", quantity: 1 }] };
  const first = splitSignaSubmission({ ...payload, submissionKey: "key-aaaaaaaaaaaaaaaa" });
  const second = splitSignaSubmission({ submissionKey: "key-bbbbbbbbbbbbbbbb", ...payload });
  assert.equal(first.submissionKey, "key-aaaaaaaaaaaaaaaa");
  assert.equal(hashSignaOrderSubmissionRequest(first.payload), hashSignaOrderSubmissionRequest(second.payload));
  for (const invalid of [null, [], "x"]) assert.throws(() => splitSignaSubmission(invalid));
});

test("POST /partner-portal/orders grava reserva, pedido e conclusão na mesma transação", () => {
  const source = readFileSync(join(__dirname, "partner-portal.controller.ts"), "utf8");
  const start = source.indexOf('@Post("orders")');
  const end = source.indexOf("private partnerOrderMessage", start);
  assert.ok(start >= 0 && end > start);
  const route = source.slice(start, end);
  const tx = route.slice(route.indexOf(".$transaction("));
  // Signa requires a valid key before any validation or write.
  assert.ok(route.indexOf("parseSignaOrderSubmissionKey") < route.indexOf(".$transaction("));
  assert.ok(route.indexOf("replaySignaSubmission(actor, partner, submission)") < route.indexOf("assertCustomer("));
  // Order inside the transaction: claim → numbering → SalesOrder → accessories → completion.
  const claim = tx.indexOf('INSERT INTO "PartnerOrderSubmission"');
  const numbering = tx.indexOf("this.nextOrderNumber(actor.companyId, transaction)");
  const create = tx.indexOf("this.salesOrders.create(");
  const complete = tx.indexOf(`SET status='COMPLETED',"salesOrderId"=$2`);
  assert.ok(claim > 0 && claim < numbering && numbering < create && create < complete, "ordem transacional");
  assert.match(tx, /ON CONFLICT \("companyId","partnerId","userId","submissionKey"\) DO NOTHING/);
  assert.match(tx, /transaction,\n\s*\);/);
  assert.match(tx, /isolationLevel: Prisma\.TransactionIsolationLevel\.ReadCommitted/);
  // No accessory write escapes the transaction.
  const inside = tx.slice(0, tx.indexOf(".catch("));
  assert.doesNotMatch(inside, /this\.database\.\$executeRawUnsafe/);
  assert.match(route, /if \(error instanceof SignaSubmissionClaimedElsewhere\) return null;/);
  assert.match(tx, /throw new SignaSubmissionClaimedElsewhere\(\)/);
  // Side effects only after commit, and re-run idempotently on replay.
  assert.ok(route.indexOf("afterPartnerOrderCommitted") > route.indexOf(".catch("));
  const replay = source.slice(source.indexOf("private async replaySignaSubmission"));
  assert.match(replay, /WHERE "companyId"=\$1 AND "partnerId"=\$2 AND "userId"=\$3 AND "submissionKey"=\$4/);
  assert.match(replay, /"createdByStorefrontPartnerId"=\$3/);
  assert.match(replay, /afterPartnerOrderCommitted/);
});
