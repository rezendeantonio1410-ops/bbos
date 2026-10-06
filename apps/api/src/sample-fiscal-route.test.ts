import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveSampleFiscalRoute,
  sampleCfopIsApplied,
  SAMPLE_FISCAL_POLICY_VERSION,
  sampleNatureIsApplied,
} from "./sample-fiscal-route";

const profile = {
  state: "PR",
  sampleNatureOperationId: "123456",
  sampleNatureOperationName: "Remessa gratuita para degustação",
  sampleValidatedByAccountant: true,
  sampleFiscalPolicyVersion: SAMPLE_FISCAL_POLICY_VERSION,
};

test("sample route uses CFOP 5910 for commercial packages inside Paraná", () => {
  assert.deepEqual(resolveSampleFiscalRoute(profile, "PR"), {
    originState: "PR",
    destinationState: "PR",
    scope: "INTRA",
    cfop: "5910",
    natureOperationId: "123456",
    natureOperationName: "Remessa gratuita para degustação",
  });
});

test("sample route uses CFOP 6910 for interstate commercial packages", () => {
  const route = resolveSampleFiscalRoute(profile, "RS");
  assert.equal(route.scope, "INTER");
  assert.equal(route.cfop, "6910");
});

test("sample route blocks issuance without a configured operation nature", () => {
  assert.throws(
    () =>
      resolveSampleFiscalRoute(
        { ...profile, sampleNatureOperationId: null },
        "RS",
      ),
    /selecione.*natureza de operação/i,
  );
});

test("sample route blocks issuance before accounting validation", () => {
  assert.throws(
    () =>
      resolveSampleFiscalRoute(
        { ...profile, sampleValidatedByAccountant: false },
        "RS",
      ),
    /validada pela contabilidade/i,
  );
});

test("sample route requires revalidation after a fiscal policy change", () => {
  assert.throws(
    () =>
      resolveSampleFiscalRoute(
        { ...profile, sampleFiscalPolicyVersion: "FREE_SAMPLE_V1" },
        "RS",
      ),
    /precisa ser revalidada/i,
  );
});

test("Bling checks require nature and CFOP on every item", () => {
  assert.equal(
    sampleNatureIsApplied(
      [
        { naturezaOperacao: { id: 123456 } },
        { naturezaOperacao: { id: "123456" } },
      ],
      "123456",
    ),
    true,
  );
  assert.equal(
    sampleNatureIsApplied(
      [
        { naturezaOperacao: { id: 123456 } },
        { naturezaOperacao: { id: 999999 } },
      ],
      "123456",
    ),
    false,
  );
  assert.equal(
    sampleCfopIsApplied(
      [{ cfop: "6.910" }, { tributacao: { cfop: "6910" } }],
      "6910",
    ),
    true,
  );
  assert.equal(
    sampleCfopIsApplied([{ cfop: "6910" }, { cfop: "6102" }], "6910"),
    false,
  );
});
