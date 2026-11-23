import assert from "node:assert/strict";
import test from "node:test";
import { LEGACY_STAGING_API, mayRetryOnAnotherUpstream, proxyUpstreamBases } from "./api-proxy-upstreams";

test("ambiente configurado nunca cai na API legada de staging", () => {
  const bases = proxyUpstreamBases({ BBOS_API_INTERNAL_URL: "http://bbos-api-homolog:10000" });
  assert.deepEqual(bases, ["http://bbos-api-homolog:10000/api"]);
  assert.equal(bases.some((base) => base.startsWith(LEGACY_STAGING_API)), false);
});

test("sem configuração, mantém o comportamento legado", () => {
  assert.deepEqual(proxyUpstreamBases({}), [`${LEGACY_STAGING_API}/api`]);
});

test("normaliza e remove duplicados", () => {
  assert.deepEqual(
    proxyUpstreamBases({ BBOS_API_INTERNAL_URL: "https://x.test/api/", NEXT_PUBLIC_API_URL: "https://x.test" }),
    ["https://x.test/api"],
  );
});

test("somente leituras podem ser repetidas em outro destino", () => {
  for (const method of ["GET", "head", "OPTIONS"]) assert.equal(mayRetryOnAnotherUpstream(method), true);
  for (const method of ["POST", "PATCH", "PUT", "DELETE"]) assert.equal(mayRetryOnAnotherUpstream(method), false);
});
