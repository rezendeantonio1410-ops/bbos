import assert from "node:assert/strict";
import test from "node:test";
import { resolveExportFiscalRoute } from "./export-fiscal-route";

const profile = {
  exportCfop: "7101",
  exportNatureOperationId: "998877",
  exportNatureOperationName: "Venda de produção para o exterior",
  exportDepartureLocation: "Porto de Paranaguá",
  exportDepartureState: "PR",
  exportValidatedByAccountant: true,
};

test("export route resolves only after complete accounting validation", () => {
  assert.deepEqual(resolveExportFiscalRoute(profile), {
    cfop: "7101",
    natureOperationId: "998877",
    natureOperationName: "Venda de produção para o exterior",
    departureLocation: "Porto de Paranaguá",
    departureState: "PR",
  });
});

test("export route rejects a domestic CFOP", () => {
  assert.throws(
    () => resolveExportFiscalRoute({ ...profile, exportCfop: "5101" }),
    /iniciado por 7/i,
  );
});

test("export route blocks emission before accounting validation", () => {
  assert.throws(
    () =>
      resolveExportFiscalRoute({
        ...profile,
        exportValidatedByAccountant: false,
      }),
    /validada pela contabilidade/i,
  );
});
