import assert from "node:assert/strict";
import test from "node:test";
import { LoginAttemptLimiter, passwordPolicyError } from "./auth-security";

test("temporary password policy requires length and a basic character mix", () => {
  assert.match(passwordPolicyError("123456") ?? "", /12 caracteres/);
  assert.match(passwordPolicyError("somenteletraslongas") ?? "", /maiúsculas/);
  assert.equal(passwordPolicyError("CafeSeguro2026"), null);
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
