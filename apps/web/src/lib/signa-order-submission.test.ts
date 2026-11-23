import assert from "node:assert/strict";
import test from "node:test";
import {
  parseSignaOrderSubmission,
  reuseOrCreateSignaOrderSubmission,
  SIGNA_SUBMISSION_MAX_AGE_MS,
  signaOrderSubmissionStorageKey,
} from "./signa-order-submission";

const scope = { companyId: "c1", partnerId: "p1", userId: "u1" };
let counter = 0;
const generate = () => `b2e5d40c-c041-4e08-a588-${String(++counter).padStart(12, "0")}`;

test("mesmo conteúdo reutiliza a chave (clique duplo, timeout, recarga)", () => {
  const first = reuseOrCreateSignaOrderSubmission(null, '{"items":[1]}', 1000, generate);
  const retry = reuseOrCreateSignaOrderSubmission(first, '{"items":[1]}', 5000, generate);
  assert.equal(retry.key, first.key);
  const reloaded = parseSignaOrderSubmission(JSON.stringify(first));
  assert.equal(reuseOrCreateSignaOrderSubmission(reloaded, '{"items":[1]}', 9000, generate).key, first.key);
});

test("conteúdo alterado ou chave expirada gera novo envio", () => {
  const first = reuseOrCreateSignaOrderSubmission(null, '{"items":[1]}', 1000, generate);
  assert.notEqual(reuseOrCreateSignaOrderSubmission(first, '{"items":[2]}', 2000, generate).key, first.key);
  assert.notEqual(
    reuseOrCreateSignaOrderSubmission(first, '{"items":[1]}', 1000 + SIGNA_SUBMISSION_MAX_AGE_MS, generate).key,
    first.key,
  );
});

test("armazenamento é isolado por empresa, parceiro e usuário", () => {
  const key = signaOrderSubmissionStorageKey(scope);
  assert.ok(key);
  assert.notEqual(key, signaOrderSubmissionStorageKey({ ...scope, userId: "u2" }));
  assert.notEqual(key, signaOrderSubmissionStorageKey({ ...scope, partnerId: "p2" }));
  assert.equal(signaOrderSubmissionStorageKey(null), null);
  assert.equal(signaOrderSubmissionStorageKey({ ...scope, userId: "" }), null);
});

test("descarta registro corrompido ou com chave fora do formato aceito pela API", () => {
  for (const raw of [null, "", "{", '{"key":"short","body":"{}","createdAt":1}',
    '{"key":"b2e5d40c-c041-4e08-a588-214a63fa2181","body":1,"createdAt":1}']) {
    assert.equal(parseSignaOrderSubmission(raw), null);
  }
});
