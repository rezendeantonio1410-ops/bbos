export type OrderDraftLine = {
  variantId: string;
  quantity: number;
};

export function isCompleteOrderDraftLine(line: OrderDraftLine) {
  return (
    Boolean(line.variantId) &&
    Number.isSafeInteger(line.quantity) &&
    line.quantity > 0
  );
}

export function hasInvalidSelectedOrderDraftLine(lines: OrderDraftLine[]) {
  return lines.some(
    (line) => Boolean(line.variantId) && !isCompleteOrderDraftLine(line),
  );
}
