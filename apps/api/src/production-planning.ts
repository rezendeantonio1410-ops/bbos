export type BlendComponentPlan = {
  coffeeLotId: string;
  percentage: number;
};

export function validateBlendComponents(components: BlendComponentPlan[]) {
  if (!components.length) throw new Error("Informe ao menos um componente.");
  if (
    components.some(
      (item) =>
        !item.coffeeLotId ||
        !Number.isFinite(item.percentage) ||
        item.percentage <= 0,
    )
  ) {
    throw new Error("Componentes devem ser únicos e maiores que zero.");
  }
  if (
    new Set(components.map((item) => item.coffeeLotId)).size !==
    components.length
  ) {
    throw new Error("Um lote não pode ser repetido na receita.");
  }
  const total = components.reduce((sum, item) => sum + item.percentage, 0);
  if (Math.abs(total - 100) > 0.01)
    throw new Error("A soma dos componentes deve ser 100%.");
  return total;
}

export function calculateComponentRequirements(
  plannedWeightKg: number,
  components: BlendComponentPlan[],
) {
  if (!Number.isFinite(plannedWeightKg) || plannedWeightKg <= 0)
    throw new Error("A quantidade planejada deve ser maior que zero.");
  validateBlendComponents(components);
  return components.map((component) => ({
    ...component,
    requiredKg: (plannedWeightKg * component.percentage) / 100,
  }));
}

export function calculateRoastMetrics(
  greenInputKg: number,
  roastedOutputKg: number,
) {
  if (!Number.isFinite(greenInputKg) || greenInputKg <= 0)
    throw new Error("O peso verde deve ser maior que zero.");
  if (
    !Number.isFinite(roastedOutputKg) ||
    roastedOutputKg <= 0 ||
    roastedOutputKg > greenInputKg
  ) {
    throw new Error(
      "O peso torrado deve ser maior que zero e não pode superar o peso verde.",
    );
  }
  const lossKg = greenInputKg - roastedOutputKg;
  const lossPercent = (lossKg / greenInputKg) * 100;
  return { lossKg, lossPercent, yieldPercent: 100 - lossPercent };
}

export type RoasterUtilityCostInput = {
  batchCount: number;
  energyConsumptionKwhPerHour: number;
  energyRatePerKwh: number;
  gasConsumptionKgPerHour: number;
  gasRatePerKg: number;
  roastMinutesPerBatch?: number;
  cycleMinutesPerBatch?: number;
};

/**
 * Huno 15 kg: a ficha técnica vigente informa 10 min de torra e 2 min de
 * resfriamento. O gás é consumido durante a torra; a energia, durante o ciclo.
 */
export function calculateRoasterUtilityCost(input: RoasterUtilityCostInput) {
  const roastMinutesPerBatch = input.roastMinutesPerBatch ?? 10;
  const cycleMinutesPerBatch = input.cycleMinutesPerBatch ?? 12;
  const values = [
    input.batchCount,
    input.energyConsumptionKwhPerHour,
    input.energyRatePerKwh,
    input.gasConsumptionKgPerHour,
    input.gasRatePerKg,
    roastMinutesPerBatch,
    cycleMinutesPerBatch,
  ];
  if (values.some((value) => !Number.isFinite(value) || value < 0))
    throw new Error("Parâmetros de energia e gás devem ser não negativos.");
  if (!Number.isInteger(input.batchCount))
    throw new Error("A quantidade de bateladas deve ser inteira.");
  if (cycleMinutesPerBatch < roastMinutesPerBatch)
    throw new Error("O ciclo não pode ser menor que o tempo de torra.");

  const energyRuntimeHours = (input.batchCount * cycleMinutesPerBatch) / 60;
  const gasRuntimeHours = (input.batchCount * roastMinutesPerBatch) / 60;
  const energyKwh = energyRuntimeHours * input.energyConsumptionKwhPerHour;
  const gasKg = gasRuntimeHours * input.gasConsumptionKgPerHour;
  const energyCost = energyKwh * input.energyRatePerKwh;
  const gasCost = gasKg * input.gasRatePerKg;
  return {
    batchCount: input.batchCount,
    roastMinutesPerBatch,
    cycleMinutesPerBatch,
    energyRuntimeHours,
    gasRuntimeHours,
    energyKwh,
    gasKg,
    energyCost,
    gasCost,
    totalCost: energyCost + gasCost,
  };
}
