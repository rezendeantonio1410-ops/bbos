/**
 * Which lots a roast batch takes its green coffee from: the batch's green
 * input is spread over the order's reserved lots, in order, never beyond what
 * each lot still has reserved for the order.
 */
type DecimalLike = number | string | { toString(): string } | null | undefined;

export type ReservedConsumption = {
  id: string;
  coffeeLotId: string;
  reservedKg: DecimalLike;
  consumedKg?: DecimalLike;
  coffeeLot?: { warehouseId?: string | null } | null;
};

export type ConsumptionPortion = { consumptionId: string; coffeeLotId: string; warehouseId: string | null; quantityKg: number };

const num = (value: DecimalLike) => Number(value ?? 0) || 0;

export function greenConsumptionPortions(consumptions: ReservedConsumption[], greenInputKg: number): ConsumptionPortion[] {
  let left = Number(greenInputKg.toFixed(3));
  const portions: ConsumptionPortion[] = [];
  for (const consumption of consumptions) {
    if (left <= 0.0005) break;
    const open = Number(Math.max(0, num(consumption.reservedKg) - num(consumption.consumedKg)).toFixed(3));
    const take = Number(Math.min(open, left).toFixed(3));
    if (take <= 0) continue;
    portions.push({ consumptionId: consumption.id, coffeeLotId: consumption.coffeeLotId, warehouseId: consumption.coffeeLot?.warehouseId ?? null, quantityKg: take });
    left = Number((left - take).toFixed(3));
  }
  return portions;
}
