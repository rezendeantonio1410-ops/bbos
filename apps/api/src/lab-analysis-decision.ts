import { GreenCoffeeQualityStatus } from "@bbos/database";

const FINAL_LAB_DECISIONS = new Set<GreenCoffeeQualityStatus>([
  GreenCoffeeQualityStatus.APPROVED,
  GreenCoffeeQualityStatus.APPROVED_WITH_RESTRICTION,
  GreenCoffeeQualityStatus.BLOCKED,
  GreenCoffeeQualityStatus.REJECTED,
]);

export const isFinalLabDecision = (
  qualityStatus: GreenCoffeeQualityStatus,
): boolean => FINAL_LAB_DECISIONS.has(qualityStatus);
