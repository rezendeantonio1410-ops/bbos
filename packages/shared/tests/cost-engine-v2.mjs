import test from "node:test";
import assert from "node:assert/strict";
import {
  allocateCost,
  calculateMachineHourCost,
  calculateRealProductionCost,
  resolveMeasuredOrAllocatedCost,
} from "../dist/cost-engine-v2.js";

test("custo máquina/hora preserva composição", () => {
  const value = calculateMachineHourCost({
    purchaseValue: 120000,
    residualValue: 12000,
    usefulLifeMonths: 120,
    expectedProductiveHoursPerMonth: 160,
    maintenanceCostEstimatePerMonth: 800,
    energyConsumptionKwhPerHour: 12,
    energyRatePerKwh: 1,
    gasConsumptionPerHour: 3,
    gasRatePerUnit: 5,
    otherHourlyCosts: 2,
  });
  assert.equal(value.depreciationPerHour, 5.625);
  assert.equal(value.maintenancePerHour, 5);
  assert.equal(value.energyPerHour, 12);
  assert.equal(value.gasPerHour, 15);
  assert.equal(value.totalPerHour, 39.625);
});
test("depreciação usa base depreciável e vida útil produtiva", () => {
  const value = calculateMachineHourCost({
    purchaseValue: 100000,
    residualValue: 10000,
    usefulLifeMonths: 100,
    expectedProductiveHoursPerMonth: 100,
    maintenanceCostEstimatePerMonth: 0,
    energyConsumptionKwhPerHour: 0,
    energyRatePerKwh: 0,
    gasConsumptionPerHour: 0,
    gasRatePerUnit: 0,
    otherHourlyCosts: 0,
  });
  assert.equal(value.memory.depreciableBase, 90000);
  assert.equal(value.memory.lifetimeProductiveHours, 10000);
  assert.equal(value.depreciationPerHour, 9);
});
test("manutenção permanece separada da depreciação", () => {
  const value = calculateMachineHourCost({
    purchaseValue: 60000,
    residualValue: 6000,
    usefulLifeMonths: 60,
    expectedProductiveHoursPerMonth: 150,
    maintenanceCostEstimatePerMonth: 1500,
    energyConsumptionKwhPerHour: 0,
    energyRatePerKwh: 0,
    gasConsumptionPerHour: 0,
    gasRatePerUnit: 0,
    otherHourlyCosts: 0,
  });
  assert.equal(value.depreciationPerHour, 6);
  assert.equal(value.maintenancePerHour, 10);
  assert.equal(value.totalPerHour, 16);
});
test("rateio por kg", () => {
  const result = allocateCost(1000, "KG_PRODUCED", [
    { id: "a", baseValue: 300 },
    { id: "b", baseValue: 700 },
  ]);
  assert.equal(result[0].allocatedAmount, 300);
  assert.equal(result[1].allocatedAmount, 700);
});
test("rateio por horas", () => {
  const result = allocateCost(900, "MACHINE_HOURS", [
    { id: "a", baseValue: 10 },
    { id: "b", baseValue: 20 },
  ]);
  assert.equal(result[0].allocatedAmount, 300);
  assert.equal(result[1].allocatedAmount, 600);
});
test("energia medida tem prioridade", () => {
  const result = resolveMeasuredOrAllocatedCost({
    measuredConsumption: 50,
    ratePerUnit: 1.2,
    allocatedCost: 100,
    sourceId: "meter-1",
  });
  assert.equal(result.amount, 60);
  assert.equal(result.mode, "DIRECT_MEASUREMENT");
});
test("gás usa rateio sem medição", () => {
  const result = resolveMeasuredOrAllocatedCost({
    ratePerUnit: 5,
    allocatedCost: 88,
    sourceId: "allocation-1",
  });
  assert.equal(result.amount, 88);
  assert.equal(result.mode, "ALLOCATION");
});
test("custo real, unitário, kg e margens", () => {
  const result = calculateRealProductionCost({
    greenCoffee: 1000,
    roastLoss: 100,
    packaging: 200,
    labels: 50,
    boxes: 30,
    directSupplies: 20,
    directLabor: 100,
    energy: 80,
    gas: 70,
    machineDepreciation: 40,
    maintenance: 30,
    otherIndustrial: 20,
    allocatedIndustrial: 60,
    corporateAllocation: 150,
    goodOutputKg: 40,
    goodUnits: 80,
    netRevenue: 3000,
    variableSellingCosts: 120,
    sourceIds: ["coffee", "energy"],
  });
  assert.equal(result.directCost, 1500);
  assert.equal(result.realIndustrialCost, 1800);
  assert.equal(result.absorbedCost, 1950);
  assert.equal(result.costPerUnit, 22.5);
  assert.equal(result.costPerKg, 45);
  assert.equal(result.industrialMarginPercent, 40);
  assert.equal(result.afterAllocationMarginPercent, 35);
});
