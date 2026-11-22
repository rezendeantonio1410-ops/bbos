/**
 * A private catalog entry must never become a free, NaN or negative order.
 * Prices originate in the database (Prisma Decimal or SQL strings), not in
 * the client request. Reject invalid values before a quote or order is built.
 */
export function parseBillableUnitPrice(value: unknown): number | null {
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    (typeof value === "string" && !value.trim())
  ) {
    return null;
  }
  const price = Number(value);
  return Number.isFinite(price) && price >= 0.01 ? price : null;
}
