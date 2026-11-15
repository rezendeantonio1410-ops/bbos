export function internationalSampleFiscalValues(input: {
  customsDeclaredValue: number;
  exchangeRateToBrl: number;
  totalQuantity: number;
}) {
  const customsDeclaredValue = Number(input.customsDeclaredValue);
  const exchangeRateToBrl = Number(input.exchangeRateToBrl);
  const totalQuantity = Number(input.totalQuantity);
  if (!Number.isFinite(customsDeclaredValue) || customsDeclaredValue <= 0) {
    throw new Error(
      "A amostra internacional exige valor aduaneiro declarado positivo.",
    );
  }
  if (!Number.isFinite(exchangeRateToBrl) || exchangeRateToBrl <= 0) {
    throw new Error(
      "A amostra internacional exige cotacao valida para conversao em BRL.",
    );
  }
  if (!Number.isSafeInteger(totalQuantity) || totalQuantity <= 0) {
    throw new Error("A amostra internacional exige quantidade fiscal valida.");
  }

  const totalBrl =
    Math.round(customsDeclaredValue * exchangeRateToBrl * 100) / 100;
  const unitValueBrl =
    Math.round((totalBrl / totalQuantity) * 1_000_000) / 1_000_000;
  return { totalBrl, unitValueBrl };
}
