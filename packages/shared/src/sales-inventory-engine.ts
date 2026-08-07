export class SalesInventoryRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SalesInventoryRuleError";
  }
}

export type SalesInventoryBalance = {
  physicalStock: number;
  reservedStock: number;
  availableStock: number;
};

function requireUnits(value: number, field: string) {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new SalesInventoryRuleError(`${field} deve ser inteiro e não negativo.`);
}

export function salesInventoryBalance(
  physicalStock: number,
  reservedStock: number,
): SalesInventoryBalance {
  requireUnits(physicalStock, "Estoque físico");
  requireUnits(reservedStock, "Estoque reservado");
  if (reservedStock > physicalStock)
    throw new SalesInventoryRuleError(
      "Estoque reservado não pode superar o estoque físico.",
    );
  return {
    physicalStock,
    reservedStock,
    availableStock: physicalStock - reservedStock,
  };
}

export function reserveSalesStock(
  balance: SalesInventoryBalance,
  quantity: number,
): SalesInventoryBalance {
  requireUnits(quantity, "Quantidade solicitada");
  if (quantity === 0)
    throw new SalesInventoryRuleError("Quantidade solicitada deve ser maior que zero.");
  if (quantity > balance.availableStock)
    throw new SalesInventoryRuleError(
      `Estoque insuficiente: solicitado ${quantity}, disponível ${balance.availableStock}, faltante ${quantity - balance.availableStock}.`,
    );
  return salesInventoryBalance(
    balance.physicalStock,
    balance.reservedStock + quantity,
  );
}

export function releaseSalesStock(
  balance: SalesInventoryBalance,
  quantity: number,
): SalesInventoryBalance {
  requireUnits(quantity, "Quantidade liberada");
  if (quantity > balance.reservedStock)
    throw new SalesInventoryRuleError("Liberação maior que a reserva ativa.");
  return salesInventoryBalance(
    balance.physicalStock,
    balance.reservedStock - quantity,
  );
}

export function shipSalesStock(
  balance: SalesInventoryBalance,
  quantity: number,
): SalesInventoryBalance {
  requireUnits(quantity, "Quantidade expedida");
  if (quantity === 0)
    throw new SalesInventoryRuleError("Quantidade expedida deve ser maior que zero.");
  if (quantity > balance.reservedStock || quantity > balance.physicalStock)
    throw new SalesInventoryRuleError("A expedição excede a reserva ou o estoque físico.");
  return salesInventoryBalance(
    balance.physicalStock - quantity,
    balance.reservedStock - quantity,
  );
}
