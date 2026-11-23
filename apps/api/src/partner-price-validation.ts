/**
 * A private catalog entry must never become a free, NaN or negative order.
 * Prices originate in the database (Prisma Decimal or SQL strings), not in
 * the client request. Accept only positive, cent-exact monetary amounts to
 * avoid silent rounding in orders and fiscal/financial integrations.
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
  if (typeof value !== "number" && typeof value !== "string") {
    return null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    // Database decimals may include trailing zeros, but must have no
    // non-zero precision beyond the cent or alternate numeric syntax.
    if (!/^\d+(?:\.\d{1,2}0*)?$/.test(trimmed)) {
      return null;
    }
  }
  const price = Number(value);
  if (!Number.isFinite(price) || price < 0.01) {
    return null;
  }
  const cents = Math.round(price * 100);
  if (
    !Number.isSafeInteger(cents) ||
    Math.abs(price * 100 - cents) > 1e-7
  ) {
    return null;
  }
  return cents / 100;
}
