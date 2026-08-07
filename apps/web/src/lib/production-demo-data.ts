import { calculateProductionCost, type ProductionDashboard, type ProductionOrderView } from '@bbos/shared';

const traceability = (current: string): ProductionOrderView['traceability'] =>
  ['Fornecedor', 'Recebimento', 'Lote verde', 'OP', 'Torra', 'Blend', 'Embalagem', 'Produto acabado'].map((label, index, stages) => ({
    id: `${current}-${index}`,
    label,
    detail: index < stages.indexOf(current) ? 'Concluído' : index === stages.indexOf(current) ? 'Etapa atual' : 'Próxima etapa',
    status: index < stages.indexOf(current) ? 'complete' : index === stages.indexOf(current) ? 'current' : 'future',
  }));

const cost = (overrides: Partial<ProductionOrderView['costs']> = {}): ProductionOrderView['costs'] => ({
  greenCoffeeConsumedCost: 10680, roastLossCost: 1884, packagingCost: 2450, suppliesCost: 620, laborCost: 1180, energyCost: 860, otherIndustrialCosts: 340,
  roastedOutputKg: 320, finishedOutputKg: 313, producedPackages: 626, standardCostPerKg: 58, sku: 'BC-ESP-500', sourceCostEventIds: ['ce-cafe-001', 'ce-frete-rateio-001'], ...overrides,
});

export const productionOrdersDemo: ProductionOrderView[] = [
  {
    id: 'op-0108', code: 'OP-2026-0108', product: 'Bispo Especial 500 g', sku: 'BC-ESP-500', plannedQuantity: 360, producedQuantity: 313, unit: 'kg', plannedAt: '2026-08-07', startedAt: '2026-08-07 07:10', responsible: 'Marina Costa', priority: 'high', status: 'packaging', blendName: 'Blend Bispo Especial',
    allocations: [{ lotId: 'lot-014', lotCode: 'CV-2026-014', origin: 'Mantiqueira de Minas', reservedKg: 216, consumedKg: 216, percentage: 60, realCostPerKg: 28.1 }, { lotId: 'lot-011', lotCode: 'CV-2026-011', origin: 'Cerrado Mineiro', reservedKg: 144, consumedKg: 144, percentage: 40, realCostPerKg: 25.6 }],
    batches: [{ id: 'batch-108-a', code: 'B-108-A', machine: 'Torrador 01', operator: 'Carlos Lima', lotCode: 'CV-2026-014 + CV-2026-011', greenInputKg: 360, roastedOutputKg: 302.4, lossKg: 57.6, lossPercent: 16, startedAt: '07:18', completedAt: '09:42', curveData: { version: 1, source: 'manual' }, notes: 'Curva registrada para futura integração.' }],
    packaging: { packageWeightG: 500, plannedPackages: 720, producedPackages: 626, lossPackages: 3, packagingName: 'Pouch Bispo 500 g', packagingUnitCost: 2.75, labelsCost: 188, boxesCost: 210, otherSuppliesCost: 120 }, costs: cost(), traceability: traceability('Embalagem'),
  },
  {
    id: 'op-0109', code: 'OP-2026-0109', product: 'Bispo Clássico 1 kg', sku: 'BC-CLA-1K', plannedQuantity: 480, producedQuantity: 0, unit: 'kg', plannedAt: '2026-08-07', startedAt: '2026-08-07 10:20', responsible: 'Rafael Nunes', priority: 'urgent', status: 'in-production', blendName: 'Café único — Cerrado',
    allocations: [{ lotId: 'lot-011', lotCode: 'CV-2026-011', origin: 'Cerrado Mineiro', reservedKg: 480, consumedKg: 160, percentage: 100, realCostPerKg: 25.6 }], batches: [], packaging: { packageWeightG: 1000, plannedPackages: 400, producedPackages: 0, lossPackages: 0, packagingName: 'Pouch Bispo 1 kg', packagingUnitCost: 3.9, labelsCost: 0, boxesCost: 0, otherSuppliesCost: 0 }, costs: cost({ greenCoffeeConsumedCost: 12288, roastedOutputKg: 405, finishedOutputKg: 400, producedPackages: 400, sku: 'BC-CLA-1K' }), traceability: traceability('Torra'),
  },
  {
    id: 'op-0110', code: 'OP-2026-0110', product: 'Bispo Microlote 250 g', sku: 'BC-MIC-250', plannedQuantity: 180, producedQuantity: 0, unit: 'kg', plannedAt: '2026-08-06', responsible: 'Marina Costa', priority: 'high', status: 'reserved', blendName: 'Café único — Mantiqueira', allocations: [{ lotId: 'lot-014', lotCode: 'CV-2026-014', origin: 'Mantiqueira de Minas', reservedKg: 180, consumedKg: 0, percentage: 100, realCostPerKg: 28.1 }], batches: [], packaging: { packageWeightG: 250, plannedPackages: 600, producedPackages: 0, lossPackages: 0, packagingName: 'Pouch Bispo 250 g', packagingUnitCost: 2.2, labelsCost: 0, boxesCost: 0, otherSuppliesCost: 0 }, costs: cost({ greenCoffeeConsumedCost: 5058, roastedOutputKg: 151, finishedOutputKg: 150, producedPackages: 600, sku: 'BC-MIC-250' }), traceability: traceability('OP'),
  },
  {
    id: 'op-0107', code: 'OP-2026-0107', product: 'Bispo Especial 500 g', sku: 'BC-ESP-500', plannedQuantity: 300, producedQuantity: 254, unit: 'kg', plannedAt: '2026-08-06', startedAt: '2026-08-06 06:55', completedAt: '2026-08-06 16:35', responsible: 'Carlos Lima', priority: 'normal', status: 'completed', blendName: 'Blend Bispo Especial', allocations: [{ lotId: 'lot-014', lotCode: 'CV-2026-014', origin: 'Mantiqueira de Minas', reservedKg: 180, consumedKg: 180, percentage: 60, realCostPerKg: 28.1 }, { lotId: 'lot-011', lotCode: 'CV-2026-011', origin: 'Cerrado Mineiro', reservedKg: 120, consumedKg: 120, percentage: 40, realCostPerKg: 25.6 }], batches: [{ id: 'batch-107-a', code: 'B-107-A', machine: 'Torrador 02', operator: 'Carlos Lima', lotCode: 'Blend Bispo Especial', greenInputKg: 300, roastedOutputKg: 253.5, lossKg: 46.5, lossPercent: 15.5, startedAt: '07:05', completedAt: '09:20' }], packaging: { packageWeightG: 500, plannedPackages: 510, producedPackages: 508, lossPackages: 2, packagingName: 'Pouch Bispo 500 g', packagingUnitCost: 2.75, labelsCost: 152, boxesCost: 172, otherSuppliesCost: 88 }, costs: cost({ greenCoffeeConsumedCost: 7930, roastLossCost: 1229, packagingCost: 1397, suppliesCost: 412, laborCost: 910, energyCost: 645, otherIndustrialCosts: 250, roastedOutputKg: 253.5, finishedOutputKg: 254, producedPackages: 508 }), traceability: traceability('Produto acabado'),
  },
];

export const productionDemoDashboard: ProductionDashboard = {
  updatedAt: '2026-08-07T11:30:00-03:00', roastLossTargetPercent: 15.5,
  summary: { plannedTodayKg: 840, producedTodayKg: 313, openOrders: 3, inProgressOrders: 2, delayedOrders: 1, efficiencyPercent: 91.8, averageRoastLossPercent: 15.8, averageRealCostPerKg: 57.42, monthlyProducedKg: 4280, monthlyTargetKg: 9200 },
  orders: productionOrdersDemo,
  alerts: [{ id: 'alert-loss-108', orderId: 'op-0108', batchId: 'batch-108-a', datum: 'Perda real de 16,0% no batch B-108-A', alert: 'Perda de torra acima da meta configurada', diagnosis: 'A perda superou a meta operacional de 15,5% em 0,5 p.p.', expectedLossKg: 55.8, actualLossKg: 57.6, differenceKg: 1.8, financialImpact: 50.58, investigationPoints: ['Conferir pesagens de entrada e saída', 'Revisar registro da curva do batch', 'Comparar máquina e operador com batches equivalentes', 'Verificar condição do lote utilizado'], action: 'Abrir o batch com o responsável e registrar a causa confirmada.', expectedResult: 'Causa documentada e próximo batch acompanhado contra a meta.', status: 'attention' }],
};

export const productionCostsDemo = Object.fromEntries(productionOrdersDemo.map(order => [order.id, calculateProductionCost(order.costs)]));
