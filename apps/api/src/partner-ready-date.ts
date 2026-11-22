/**
 * Confirms an exact calendar date entered by a distributor.
 * The date is a request, never a Bispo production commitment.
 */
export function isValidPartnerRequestedReadyDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const timestamp = Date.parse(`${value}T12:00:00Z`);
  return (
    Number.isFinite(timestamp) &&
    new Date(timestamp).toISOString().slice(0, 10) === value
  );
}
