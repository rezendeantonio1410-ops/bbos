export type CuppingProtocol = "TRADITIONAL_100" | "CVA_EXPERIENCE";
export type DefectSeverity = "TAINT" | "FAULT";
export type Traditional100Defect = { cupNumber: number; defectType: string; defectSeverity: DefectSeverity; defectDescription?: string };
export type Traditional100ScoreResult = { rawScore: number; defectPenalty: number; finalScore: number; taints: number; faults: number };

export interface CuppingScoringEngine<TInput, TResult> {
  readonly protocol: CuppingProtocol;
  readonly protocolVersion: string;
  calculate(input: TInput): TResult;
}

export class Traditional100ScoringEngine implements CuppingScoringEngine<{ attributes: Record<string, number>; defects?: Traditional100Defect[] }, Traditional100ScoreResult> {
  readonly protocol = "TRADITIONAL_100" as const;
  readonly protocolVersion = "1.0";
  calculate({ attributes, defects = [] }: { attributes: Record<string, number>; defects?: Traditional100Defect[] }): Traditional100ScoreResult {
    const values = Object.values(attributes);
    if (values.length !== 10 || values.some((value) => !Number.isFinite(value))) throw new Error("Traditional 100 exige exatamente dez atributos válidos.");
    const rawScore = Number(values.reduce((sum, value) => sum + value, 0).toFixed(2));
    const taints = defects.filter((defect) => defect.defectSeverity === "TAINT").length;
    const faults = defects.filter((defect) => defect.defectSeverity === "FAULT").length;
    const defectPenalty = taints * 2 + faults * 4;
    return { rawScore, defectPenalty, finalScore: Number((rawScore - defectPenalty).toFixed(2)), taints, faults };
  }
}

export class CvaExperienceScoringEngine implements CuppingScoringEngine<unknown, never> {
  readonly protocol = "CVA_EXPERIENCE" as const;
  readonly protocolVersion = "1.0-placeholder";
  calculate(): never { throw new Error("CVA_EXPERIENCE ainda não possui motor de cálculo implementado."); }
}
