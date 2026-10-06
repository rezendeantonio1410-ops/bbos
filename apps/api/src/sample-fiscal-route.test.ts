import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveSampleFiscalRoute,
  sampleCfopIsApplied,
  sampleNatureIsApplied,
} from "./sample-fiscal-route";

const profile = {
  state: "PR",
  sampleNatureOperationId: "123456",
  sampleNatureOperationName: "Remessa de amostra grátis",
  sampleValidatedByAccountant: true,
};

test("sample route uses CFOP 5911 for destinations inside Paraná", () => {
  assert.deepEqual(resolveSampleFiscalRoute(profile, "PR"), {
    originState: "PR",
    destinationState: "PR",
    scope: "INTRA",
    cfop: "5911",
    natureOperationId: "123456",
    natureOperationName: "Remessa de amostra grátis",
  });
});

test("sample route uses CFOP 6911 for interstate destinations", () => {
  const route = resolveSampleFiscalRoute(profile, "RS");
  assert.equal(route.scope, "INTER");
  assert.equal(route.cfop, "6911");
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
      [{ cfop: "6.911" }, { tributacao: { cfop: "6911" } }],
      "6911",
    ),
    true,
  );
  assert.equal(
    sampleCfopIsApplied([{ cfop: "6911" }, { cfop: "6102" }], "6911"),
    false,
  );
});
