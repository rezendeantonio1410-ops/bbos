/**
 * Only allow explicit full calendar years as report query parameters.
 * Never interpolate user input into SQL; pass the boundaries as bound values.
 */
export function parseSignaReportYear(value: string | undefined): number | null {
  if (value === undefined) return null;
  if (!/^20\d{2}$/.test(value)) {
    throw new Error("Ano de relatório inválido.");
  }
  return Number(value);
}

export function signaReportYearBounds(year: number | null): {
  start: string | null;
  end: string | null;
} {
  return year === null
    ? { start: null, end: null }
    : { start: `${year}-01-01`, end: `${year + 1}-01-01` };
}
