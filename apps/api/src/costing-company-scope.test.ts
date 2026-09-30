import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { CostingService } from "./costing.service";

test("costing read models always scope operational collections by company", async () => {
  const calls: Array<{ model: string; args: Record<string, unknown> }> = [];
  const findMany = (model: string) => async (args: Record<string, unknown>) => {
    calls.push({ model, args });
    return [];
  };
  const service = new CostingService();
  Object.defineProperty(service, "database", {
    value: {
      costCenter: { findMany: findMany("costCenter") },
      productiveResource: { findMany: findMany("productiveResource") },
      costEvent: { findMany: findMany("costEvent") },
      costTariff: { findMany: findMany("costTariff") },
      allocationRule: { findMany: findMany("allocationRule") },
      allocationPeriod: { findMany: findMany("allocationPeriod") },
    },
  });

  await service.listCostCenters("company-a");
  await service.listResources("company-a");
  await service.listCostEvents("company-a");
  await service.listTariffs("company-a");
  await service.listAllocationRules("company-a");
  await service.listPeriods("company-a");

  assert.equal(calls.length, 6);
  for (const call of calls) {
    assert.deepEqual(
      (call.args.where as Record<string, unknown>).companyId,
      "company-a",
      `${call.model} must be isolated by companyId`,
    );
  }
});

test("costing controller derives company scope from the signed session", () => {
  const source = readFileSync(join(__dirname, "costing.controller.ts"), "utf8");
  assert.doesNotMatch(source, /defaultCompanyId/);
  assert.match(source, /requireSession\(req, this\.auth\)/);
  assert.match(
    source,
    /companyId: \(await requireSession\(req, this\.auth\)\)\.companyId/,
  );
  assert.match(source, /this\.costing\.summary\(\s*\(await requireSession/);
  assert.match(
    source,
    /this\.costing\.updateResource\(\s*\(await requireSession/,
  );
});
