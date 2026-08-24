export type WeightVariance = {
  contractedKg: number;
  receivedKg: number;
  differenceKg: number;
  differencePercent: number;
  tolerancePercent: number;
  withinTolerance: boolean;
  partial: boolean;
};

/** Compares the cumulative received weight with the contracted quantity. */
export function calculateWeightVariance(
  contractedKg: number,
  receivedBeforeKg: number,
  currentReceiptKg: number,
  tolerancePercent: number,
): WeightVariance {
  const receivedKg = receivedBeforeKg + currentReceiptKg;
  const differenceKg = receivedKg - contractedKg;
  const differencePercent = contractedKg > 0 ? (differenceKg / contractedKg) * 100 : 0;
  const partial = receivedKg < contractedKg;
  return {
    contractedKg,
    receivedKg,
    differenceKg,
    differencePercent,
    tolerancePercent,
    partial,
    withinTolerance: partial || Math.abs(differencePercent) <= tolerancePercent,
  };
}
