export type QualityComparison = {
  moisture?: { contracted: number; measured: number; difference: number; within: boolean };
  defects?: { contracted: number; measured: number; difference: number; within: boolean };
  score?: { contracted: number; measured: number; difference: number; within: boolean };
  screen?: { contracted: string; measured: string; within: boolean };
  issues: string[];
  withinContract: boolean;
};

export function compareQuality(input: {
  maxMoisturePercent?: number | null;
  measuredMoisturePercent?: number | null;
  maxDefects?: number | null;
  measuredDefects?: number | null;
  minimumScore?: number | null;
  measuredScore?: number | null;
  contractedScreen?: string | null;
  measuredScreen?: string | null;
}): QualityComparison {
  const result: QualityComparison = { issues: [], withinContract: true };
  if (input.maxMoisturePercent != null && input.measuredMoisturePercent != null) {
    const difference = input.measuredMoisturePercent - input.maxMoisturePercent;
    const within = difference <= 0;
    result.moisture = { contracted: input.maxMoisturePercent, measured: input.measuredMoisturePercent, difference, within };
    if (!within) result.issues.push(`A umidade está ${difference.toFixed(1)} p.p. acima do máximo contratado.`);
  }
  if (input.maxDefects != null && input.measuredDefects != null) {
    const difference = input.measuredDefects - input.maxDefects;
    const within = difference <= 0;
    result.defects = { contracted: input.maxDefects, measured: input.measuredDefects, difference, within };
    if (!within) result.issues.push(`Foram encontrados ${difference} defeitos acima do limite.`);
  }
  if (input.minimumScore != null && input.measuredScore != null) {
    const difference = input.measuredScore - input.minimumScore;
    const within = difference >= 0;
    result.score = { contracted: input.minimumScore, measured: input.measuredScore, difference, within };
    if (!within) result.issues.push(`A pontuação ficou ${Math.abs(difference).toFixed(1)} ponto abaixo do mínimo.`);
  }
  if (input.contractedScreen && input.measuredScreen) {
    const normalize = (value: string) => value.trim().toLowerCase();
    const within = normalize(input.contractedScreen) === normalize(input.measuredScreen);
    result.screen = { contracted: input.contractedScreen, measured: input.measuredScreen, within };
    if (!within) result.issues.push("A classificação de peneira diverge do contratado.");
  }
  result.withinContract = result.issues.length === 0;
  return result;
}
