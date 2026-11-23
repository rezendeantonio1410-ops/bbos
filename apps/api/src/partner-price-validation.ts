/**
 * A private catalog entry must never become a free, NaN or negative order.
 * Prices originate in the database (Prisma Decimal or SQL strings), not in
 * the client request. Reject invalid values before a quote or order is built.
 */
function isDecimalLike(value: unknown): value is { toFixed(): string; toString(): string } {
  // Prisma returns PostgreSQL NUMERIC columns as Decimal objects in raw
  // queries; they must be validated through their exact decimal text.
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { toFixed?: unknown }).toFixed === "function" &&
    typeof (value as { toString?: unknown }).toString === "function"
  );
}

export function parseBillableUnitPrice(rawValue: unknown): number | null {
  const value = isDecimalLike(rawValue) ? rawValue.toString() : rawValue;
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    (typeof value === "string" && !value.trim())
  ) {
    return null;
  }
  const price = Number(value);
  return Number.isFinite(price) && price >= 0.01 ? price : null;
}
