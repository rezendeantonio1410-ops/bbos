import {
  ROASTER_OPERATIONAL_GREEN_LOAD_KG,
  ROASTER_OPERATIONAL_PROFILE,
} from "@bbos/shared";

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

export function calculateRoastCycleCount(
  greenInputsKg: number[],
  operationalLoadKg = ROASTER_OPERATIONAL_GREEN_LOAD_KG,
) {
  if (!Number.isFinite(operationalLoadKg) || operationalLoadKg <= 0)
    throw new Error("A carga operacional deve ser maior que zero.");
  if (
    greenInputsKg.some(
      (greenInputKg) => !Number.isFinite(greenInputKg) || greenInputKg <= 0,
    )
  )
    throw new Error("O peso verde deve ser maior que zero.");
  return greenInputsKg.reduce(
    (cycles, greenInputKg) =>
      cycles + Math.ceil(greenInputKg / operationalLoadKg),
    0,
  );
}

export function validateRoastBatchCapacity(
  greenInputKg: number,
  operationalLoadKg = ROASTER_OPERATIONAL_GREEN_LOAD_KG,
) {
  if (!Number.isFinite(greenInputKg) || greenInputKg <= 0)
    throw new Error("O peso verde deve ser maior que zero.");
  if (!Number.isFinite(operationalLoadKg) || operationalLoadKg <= 0)
    throw new Error("A carga operacional deve ser maior que zero.");
  if (greenInputKg > operationalLoadKg)
    throw new Error(
      `Cada batelada aceita até ${operationalLoadKg} kg de café verde. Registre uma nova batelada para o restante.`,
    );
  return greenInputKg;
}

export function calculateWipPackagingPlan(
  availableWipKg: number,
  packageWeightGrams: number,
  requestedPackages?: number,
) {
  if (!Number.isFinite(availableWipKg) || availableWipKg <= 0)
    throw new Error("O saldo de café torrado deve ser maior que zero.");
  if (!Number.isSafeInteger(packageWeightGrams) || packageWeightGrams <= 0)
    throw new Error("O peso da apresentação deve ser um inteiro positivo.");

  const exactAvailablePackages = (availableWipKg * 1000) / packageWeightGrams;
  const producedPackages =
    requestedPackages === undefined
      ? Math.round(exactAvailablePackages)
      : requestedPackages;
  if (!Number.isSafeInteger(producedPackages) || producedPackages <= 0)
    throw new Error("A quantidade de pacotes deve ser um inteiro positivo.");
  if (
    requestedPackages === undefined &&
    Math.abs(exactAvailablePackages - producedPackages) > 0.001
  )
    throw new Error(
      "O saldo WIP não corresponde a uma quantidade inteira de pacotes.",
    );

  const finishedOutputKg = (producedPackages * packageWeightGrams) / 1000;
  if (finishedOutputKg - availableWipKg > 0.001)
    throw new Error(
      "A quantidade informada é maior que o saldo WIP disponível.",
    );

  return {
    producedPackages,
    finishedOutputKg,
  };
}

/**
 * Atilla Huno: a referência operacional adotada é de até 17 kg de café verde.
 * A ficha técnica vigente informa 10 min de torra e 2 min de resfriamento. O
 * gás é consumido durante a torra; a energia, durante o ciclo.
 */
export function calculateRoasterUtilityCost(input: RoasterUtilityCostInput) {
  const roastMinutesPerBatch =
    input.roastMinutesPerBatch ??
    ROASTER_OPERATIONAL_PROFILE.roastMinutesPerBatch;
  const cycleMinutesPerBatch =
    input.cycleMinutesPerBatch ??
    ROASTER_OPERATIONAL_PROFILE.cycleMinutesPerBatch;
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

  const energyRuntimeHoursPerBatch = cycleMinutesPerBatch / 60;
  const gasRuntimeHoursPerBatch = roastMinutesPerBatch / 60;
  const energyKwhPerBatch =
    energyRuntimeHoursPerBatch * input.energyConsumptionKwhPerHour;
  const gasKgPerBatch = gasRuntimeHoursPerBatch * input.gasConsumptionKgPerHour;
  const energyCostPerBatch = energyKwhPerBatch * input.energyRatePerKwh;
  const gasCostPerBatch = gasKgPerBatch * input.gasRatePerKg;
  const energyRuntimeHours = input.batchCount * energyRuntimeHoursPerBatch;
  const gasRuntimeHours = input.batchCount * gasRuntimeHoursPerBatch;
  const energyKwh = input.batchCount * energyKwhPerBatch;
  const gasKg = input.batchCount * gasKgPerBatch;
  const energyCost = input.batchCount * energyCostPerBatch;
  const gasCost = input.batchCount * gasCostPerBatch;
  return {
    batchCount: input.batchCount,
    operationalLoadKg: ROASTER_OPERATIONAL_PROFILE.greenLoadKg,
    roastMinutesPerBatch,
    coolingMinutesPerBatch: cycleMinutesPerBatch - roastMinutesPerBatch,
    cycleMinutesPerBatch,
    energyKwhPerBatch,
    gasKgPerBatch,
    energyCostPerBatch,
    gasCostPerBatch,
    totalCostPerBatch: energyCostPerBatch + gasCostPerBatch,
    energyRuntimeHours,
    gasRuntimeHours,
    energyKwh,
    gasKg,
    energyCost,
    gasCost,
    totalCost: energyCost + gasCost,
  };
}
