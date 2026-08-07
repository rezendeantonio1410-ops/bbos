import type { InventoryLot, InventoryMovement, InventoryMovementType, InventorySummary } from './index';

export class InventoryRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InventoryRuleError';
  }
}

export type InventoryBalance = { availableKg: number; reservedKg: number; totalKg: number; financialValue: number };

export type FinishedGoodsBalance = {
  physicalUnits: number;
  reservedUnits: number;
  availableUnits: number;
};

export function calculateFinishedGoodsBalance(
  physicalUnits: number,
  reservedUnits: number,
): FinishedGoodsBalance {
  if (!Number.isInteger(physicalUnits) || physicalUnits < 0)
    throw new InventoryRuleError(
      'O saldo físico de produto acabado deve ser inteiro e não negativo.',
    );
  if (!Number.isInteger(reservedUnits) || reservedUnits < 0)
    throw new InventoryRuleError(
      'O saldo reservado de produto acabado deve ser inteiro e não negativo.',
    );
  if (reservedUnits > physicalUnits)
    throw new InventoryRuleError(
      'O saldo reservado não pode superar o estoque físico.',
    );
  return {
    physicalUnits,
    reservedUnits,
    availableUnits: physicalUnits - reservedUnits,
  };
}

export function calculateInventoryBalance(lot: Pick<InventoryLot, 'initialQuantityKg' | 'realCostPerKg' | 'status'>, movements: InventoryMovement[]): InventoryBalance {
  let availableKg = 0;
  let reservedKg = 0;
  for (const movement of movements) {
    const quantity = movement.quantityKg;
    if (!Number.isFinite(quantity) || quantity <= 0) throw new InventoryRuleError('A quantidade da movimentação deve ser maior que zero.');
    switch (movement.type) {
      case 'entry': availableKg += quantity; break;
      case 'exit': availableKg -= quantity; break;
      case 'production-reservation': availableKg -= quantity; reservedKg += quantity; break;
      case 'reservation-release': reservedKg -= quantity; availableKg += quantity; break;
      case 'inventory-adjustment': availableKg += movement.adjustmentDirection === 'increase' ? quantity : -quantity; break;
      case 'internal-transfer': break;
    }
    if (availableKg < 0 || reservedKg < 0) throw new InventoryRuleError('Movimentação recusada: o saldo do lote não pode ficar negativo.');
  }
  const totalKg = availableKg + reservedKg;
  return { availableKg, reservedKg, totalKg, financialValue: totalKg * lot.realCostPerKg };
}

export function validateInventoryMovement(lot: Pick<InventoryLot, 'status' | 'availableQuantityKg' | 'reservedQuantityKg'>, type: InventoryMovementType, quantityKg: number, adjustmentDirection?: 'increase' | 'decrease'): void {
  if (!Number.isFinite(quantityKg) || quantityKg <= 0) throw new InventoryRuleError('Informe uma quantidade maior que zero.');
  if (lot.status === 'blocked' && (type === 'exit' || type === 'production-reservation')) throw new InventoryRuleError('Lote bloqueado por qualidade não pode sair nem ser reservado para produção.');
  if ((type === 'exit' || type === 'production-reservation' || (type === 'inventory-adjustment' && adjustmentDirection !== 'increase')) && quantityKg > lot.availableQuantityKg) throw new InventoryRuleError('Movimentação recusada: quantidade maior que o saldo disponível.');
  if (type === 'reservation-release' && quantityKg > lot.reservedQuantityKg) throw new InventoryRuleError('Liberação maior que o saldo reservado.');
}

export function applyInventoryMovement(lot: InventoryLot, movement: InventoryMovement): InventoryLot {
  validateInventoryMovement(lot, movement.type, movement.quantityKg, movement.adjustmentDirection);
  let available = lot.availableQuantityKg;
  let reserved = lot.reservedQuantityKg;
  if (movement.type === 'entry') available += movement.quantityKg;
  if (movement.type === 'exit') available -= movement.quantityKg;
  if (movement.type === 'production-reservation') { available -= movement.quantityKg; reserved += movement.quantityKg; }
  if (movement.type === 'reservation-release') { reserved -= movement.quantityKg; available += movement.quantityKg; }
  if (movement.type === 'inventory-adjustment') available += movement.adjustmentDirection === 'increase' ? movement.quantityKg : -movement.quantityKg;
  if (available < 0 || reserved < 0) throw new InventoryRuleError('Movimentação recusada: saldo negativo.');
  return { ...lot, availableQuantityKg: available, reservedQuantityKg: reserved, currentStockValue: (available + reserved) * lot.realCostPerKg, location: movement.type === 'internal-transfer' ? movement.destination : lot.location };
}

export function calculateInventorySummary(lots: InventoryLot[], coverageDailyConsumptionKg: number): InventorySummary {
  const totalGreenCoffeeKg = lots.reduce((sum, lot) => sum + lot.availableQuantityKg + lot.reservedQuantityKg, 0);
  const financialStockValue = lots.reduce((sum, lot) => sum + lot.currentStockValue, 0);
  return {
    totalGreenCoffeeKg,
    financialStockValue,
    averageCostPerKg: totalGreenCoffeeKg > 0 ? financialStockValue / totalGreenCoffeeKg : 0,
    activeLots: lots.filter(lot => lot.status !== 'blocked' && lot.availableQuantityKg > 0).length,
    blockedLots: lots.filter(lot => lot.status === 'blocked').length,
    attentionLots: lots.filter(lot => lot.status === 'attention').length,
    estimatedCoverageDays: coverageDailyConsumptionKg > 0 ? Math.round(totalGreenCoffeeKg / coverageDailyConsumptionKg) : 0,
  };
}
