export function isGreenCoffeeProductionAvailable(status: string, currentWeightKg: number): boolean {
  return status === "APPROVED" && Number.isFinite(currentWeightKg) && currentWeightKg > 0;
}

export function productionAvailableWeight(status: string, currentWeightKg: number): number {
  return isGreenCoffeeProductionAvailable(status, currentWeightKg) ? Math.max(0, currentWeightKg) : 0;
}
