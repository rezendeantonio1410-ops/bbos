import assert from "node:assert/strict";
import test from "node:test";
import {
  REEXPEDITION_FISCAL_POLICY_VERSION,
  reexpeditionCfopMatches,
  resolveReexpeditionFiscalRoute,
} from "./reexpedition-fiscal-route";

const valid = {
  reexpeditionReturnNatureOperationId: "123",
  reexpeditionOutboundNatureOperationId: "456",
  reexpeditionValidatedByAccountant: true,
  reexpeditionFiscalPolicyVersion: REEXPEDITION_FISCAL_POLICY_VERSION,
};

test("exige as duas naturezas e validação contábil vigente", () => {
  assert.equal(resolveReexpeditionFiscalRoute(valid).returnNatureOperationId, "123");
  assert.throws(
    () => resolveReexpeditionFiscalRoute({ ...valid, reexpeditionValidatedByAccountant: false }),
    /validada uma vez pela contabilidade/,
  );
  assert.throws(
    () => resolveReexpeditionFiscalRoute({ ...valid, reexpeditionOutboundNatureOperationId: null }),
    /selecione no BBOS/,
  );
});

test("não aceita a mesma natureza para entrada e saída", () => {
  assert.throws(
    () => resolveReexpeditionFiscalRoute({ ...valid, reexpeditionOutboundNatureOperationId: "123" }),
    /distintas/,
  );
});

test("confere a direção dos CFOPs antes da SEFAZ", () => {
  assert.equal(reexpeditionCfopMatches([{ cfop: "1202" }], "RETURN"), true);
  assert.equal(reexpeditionCfopMatches([{ cfop: "6202" }], "OUTBOUND"), true);
  assert.equal(reexpeditionCfopMatches([{ cfop: "5102" }], "RETURN"), false);
});
