import assert from "node:assert/strict";
import test from "node:test";
import { LoginAttemptLimiter, passwordPolicyError } from "./auth-security";

test("senha simples: 8 caracteres com letras e número, sem exigir maiúscula", () => {
  assert.match(passwordPolicyError("abc123") ?? "", /8 caracteres/);
  assert.match(passwordPolicyError("somenteletras") ?? "", /letras e pelo menos um número/);
  assert.match(passwordPolicyError("12345678") ?? "", /letras/);
  assert.equal(passwordPolicyError("maikon2026"), null);
  assert.equal(passwordPolicyError("cafe2026"), null);
  assert.equal(passwordPolicyError("CafeSeguro2026"), null);
});

test("senhas óbvias continuam bloqueadas", () => {
  assert.match(passwordPolicyError("senha123") ?? "", /fácil demais/);
  assert.match(passwordPolicyError("Bispo123") ?? "", /fácil demais/);
  assert.match(passwordPolicyError("abcd1234") ?? "", /fácil demais/);
});

test("login limiter blocks after the configured number of failures and expires", () => {
  let clock = 1_000;
  const limiter = new LoginAttemptLimiter(3, 60_000, 30_000, () => clock);
  limiter.recordFailure("actor");
  limiter.recordFailure("actor");
  assert.equal(limiter.retryAfterSeconds("actor"), 0);
  limiter.recordFailure("actor");
  assert.equal(limiter.retryAfterSeconds("actor"), 30);
  clock += 30_001;
  assert.equal(limiter.retryAfterSeconds("actor"), 0);
});

test("successful authentication clears the attempt history", () => {
  const limiter = new LoginAttemptLimiter(2);
  limiter.recordFailure("actor");
  limiter.clear("actor");
  limiter.recordFailure("actor");
  assert.equal(limiter.retryAfterSeconds("actor"), 0);
});
