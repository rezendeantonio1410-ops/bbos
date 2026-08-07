export type CostNature = "DIRECT" | "INDIRECT_INDUSTRIAL" | "CORPORATE";
export type AllocationMethod =
  | "KG_PRODUCED"
  | "MACHINE_HOURS"
  | "LABOR_HOURS"
  | "ENERGY_CONSUMPTION"
  | "AREA"
  | "REVENUE"
  | "FIXED_PERCENTAGE"
  | "UNITS_PRODUCED";

export type MachineHourCostInput = {
  purchaseValue: number;
  residualValue: number;
  usefulLifeMonths: number;
  expectedProductiveHoursPerMonth: number;
  maintenanceCostEstimatePerMonth: number;
  energyConsumptionKwhPerHour: number;
  energyRatePerKwh: number;
  gasConsumptionPerHour: number;
  gasRatePerUnit: number;
  otherHourlyCosts: number;
};
export type MachineHourCostResult = {
  depreciationPerHour: number;
  maintenancePerHour: number;
  energyPerHour: number;
  gasPerHour: number;
  otherPerHour: number;
  totalPerHour: number;
  memory: {
    depreciableBase: number;
    lifetimeProductiveHours: number;
    source: string;
  };
};

const valid = (value: number) => Number.isFinite(value) && value >= 0;
export function calculateMachineHourCost(
  input: MachineHourCostInput,
): MachineHourCostResult {
  if (Object.values(input).some((value) => !valid(value)))
    throw new Error("Valores de máquina devem ser não negativos.");
  if (input.usefulLifeMonths <= 0 || input.expectedProductiveHoursPerMonth <= 0)
    throw new Error("Vida útil e horas produtivas devem ser maiores que zero.");
  if (input.residualValue > input.purchaseValue)
    throw new Error("Valor residual não pode superar o valor de aquisição.");
  const depreciableBase = input.purchaseValue - input.residualValue;
  const lifetimeProductiveHours =
    input.usefulLifeMonths * input.expectedProductiveHoursPerMonth;
  const depreciationPerHour = depreciableBase / lifetimeProductiveHours;
  const maintenancePerHour =
    input.maintenanceCostEstimatePerMonth /
    input.expectedProductiveHoursPerMonth;
  const energyPerHour =
    input.energyConsumptionKwhPerHour * input.energyRatePerKwh;
  const gasPerHour = input.gasConsumptionPerHour * input.gasRatePerUnit;
  const otherPerHour = input.otherHourlyCosts;
  return {
    depreciationPerHour,
    maintenancePerHour,
    energyPerHour,
    gasPerHour,
    otherPerHour,
    totalPerHour:
      depreciationPerHour +
      maintenancePerHour +
      energyPerHour +
      gasPerHour +
      otherPerHour,
    memory: {
      depreciableBase,
      lifetimeProductiveHours,
      source: "straight-line-depreciation",
    },
  };
}

export type AllocationDestination = {
  id: string;
  baseValue: number;
  fixedPercentage?: number;
};
export type AllocationResult = {
  destinationId: string;
  baseValue: number;
  sharePercent: number;
  allocatedAmount: number;
};
export function allocateCost(
  amount: number,
  method: AllocationMethod,
  destinations: AllocationDestination[],
): AllocationResult[] {
  if (!valid(amount) || !destinations.length)
    throw new Error("Rateio requer valor válido e destinos.");
  const bases = destinations.map((item) =>
    method === "FIXED_PERCENTAGE"
      ? (item.fixedPercentage ?? 0)
      : item.baseValue,
  );
  const totalBase = bases.reduce((sum, value) => sum + value, 0);
  if (totalBase <= 0)
    throw new Error("Base de rateio deve ser maior que zero.");
  if (method === "FIXED_PERCENTAGE" && Math.abs(totalBase - 100) > 0.001)
    throw new Error("Percentuais fixos devem somar 100%.");
  let allocated = 0;
  return destinations.map((item, index) => {
    const sharePercent = (bases[index]! / totalBase) * 100;
    const allocatedAmount =
      index === destinations.length - 1
        ? Math.round((amount - allocated) * 100) / 100
        : Math.round(((amount * sharePercent) / 100) * 100) / 100;
    allocated += allocatedAmount;
    return {
      destinationId: item.id,
      baseValue: item.baseValue,
      sharePercent,
      allocatedAmount,
    };
  });
}

export function resolveMeasuredOrAllocatedCost(input: {
  measuredConsumption?: number;
  ratePerUnit: number;
  allocatedCost: number;
  sourceId: string;
}) {
  const directlyMeasured = input.measuredConsumption !== undefined;
  const amount = directlyMeasured
    ? input.measuredConsumption! * input.ratePerUnit
    : input.allocatedCost;
  if (!valid(amount)) throw new Error("Custo medido ou rateado inválido.");
  return {
    amount,
    mode: directlyMeasured
      ? ("DIRECT_MEASUREMENT" as const)
      : ("ALLOCATION" as const),
    sourceId: input.sourceId,
  };
}

export type RealProductionCostInput = {
  greenCoffee: number;
  roastLoss: number;
  packaging: number;
  labels: number;
  boxes: number;
  directSupplies: number;
  directLabor: number;
  energy: number;
  gas: number;
  machineDepreciation: number;
  maintenance: number;
  otherIndustrial: number;
  allocatedIndustrial: number;
  corporateAllocation: number;
  goodOutputKg: number;
  goodUnits: number;
  netRevenue: number;
  variableSellingCosts: number;
  sourceIds: string[];
};
export function calculateRealProductionCost(input: RealProductionCostInput) {
  const amounts = Object.entries(input)
    .filter(
      ([key]) =>
        !["goodOutputKg", "goodUnits", "netRevenue", "sourceIds"].includes(key),
    )
    .map(([, value]) => value as number);
  if (
    amounts.some((value) => !valid(value)) ||
    input.goodOutputKg <= 0 ||
    input.goodUnits <= 0
  )
    throw new Error("Custos e produção boa devem ser válidos.");
  if (new Set(input.sourceIds).size !== input.sourceIds.length)
    throw new Error("Origens de custo duplicadas não são permitidas.");
  const directCost =
    input.greenCoffee +
    input.roastLoss +
    input.packaging +
    input.labels +
    input.boxes +
    input.directSupplies +
    input.directLabor;
  const industrialTransformation =
    input.energy +
    input.gas +
    input.machineDepreciation +
    input.maintenance +
    input.otherIndustrial +
    input.allocatedIndustrial;
  const realIndustrialCost = directCost + industrialTransformation;
  const absorbedCost = realIndustrialCost + input.corporateAllocation;
  const contributionCost =
    directCost + input.energy + input.gas + input.variableSellingCosts;
  const margin = (cost: number) =>
    input.netRevenue > 0
      ? ((input.netRevenue - cost) / input.netRevenue) * 100
      : 0;
  const round = (value: number) => Math.round(value * 10000) / 10000;
  return {
    directCost: round(directCost),
    industrialTransformation: round(industrialTransformation),
    realIndustrialCost: round(realIndustrialCost),
    absorbedCost: round(absorbedCost),
    costPerUnit: round(realIndustrialCost / input.goodUnits),
    absorbedCostPerUnit: round(absorbedCost / input.goodUnits),
    costPerKg: round(realIndustrialCost / input.goodOutputKg),
    absorbedCostPerKg: round(absorbedCost / input.goodOutputKg),
    grossMarginPercent: round(margin(directCost)),
    industrialMarginPercent: round(margin(realIndustrialCost)),
    contributionMarginPercent: round(margin(contributionCost)),
    afterAllocationMarginPercent: round(margin(absorbedCost)),
    profitPerUnit: round((input.netRevenue - absorbedCost) / input.goodUnits),
    profitPerKg: round((input.netRevenue - absorbedCost) / input.goodOutputKg),
    composition: { ...input },
    sourceIds: [...input.sourceIds],
  };
}
