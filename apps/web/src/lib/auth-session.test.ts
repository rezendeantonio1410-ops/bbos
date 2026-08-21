import assert from "node:assert/strict";
import test from "node:test";
import { fetchSessionIdentity, SessionError } from "./auth-session";

const user = { user: { id: "user-1", companyId: "company-1", name: "José", role: "ADMIN", active: true } };

test("session available immediately does not retry", async () => {
  let calls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { calls += 1; return new Response(JSON.stringify(user), { status: 200 }); };
  try {
    const identity = await fetchSessionIdentity("/api", { retryDelaysMs: [0] });
    assert.equal(identity.id, "user-1");
    assert.equal(calls, 1);
  } finally { globalThis.fetch = originalFetch; }
});

test("transient failures retry and recover", async () => {
  let calls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    calls += 1;
    return calls < 3 ? new Response("warming up", { status: 503 }) : new Response(JSON.stringify(user), { status: 200 });
  };
  try {
    await fetchSessionIdentity("/api", { retryDelaysMs: [0, 0, 0] });
    assert.equal(calls, 3);
  } finally { globalThis.fetch = originalFetch; }
});

test("transient failures stop after the bounded retry budget", async () => {
  let calls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { calls += 1; return new Response("unavailable", { status: 502 }); };
  try {
    await assert.rejects(() => fetchSessionIdentity("/api", { retryDelaysMs: [0, 0, 0, 0, 0] }), (error: unknown) => error instanceof SessionError && error.kind === "unavailable");
    assert.equal(calls, 5);
  } finally { globalThis.fetch = originalFetch; }
});

test("authentication errors do not retry", async () => {
  let calls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { calls += 1; return new Response("unauthorized", { status: 401 }); };
  try {
    await assert.rejects(() => fetchSessionIdentity("/api", { retryDelaysMs: [0, 0, 0] }), (error: unknown) => error instanceof SessionError && error.kind === "unauthenticated");
    assert.equal(calls, 1);
  } finally { globalThis.fetch = originalFetch; }
});
