export type Period = "day" | "week" | "month" | "year";
export * from './green-coffee-receipt.js';
export * from './cupping-mobile.js';
export * from './cupping-scoring.js';
export * from './system-identity.js';
export type PerformanceStatus = "on-track" | "attention" | "off-track";

export type ExecutiveMetric = {
  label: string;
  value: string;
  change: number;
  supportingText: string;
};

export type RoiIndicator = {
  current: number;
  target: number;
  difference: number;
  trend: number;
  status: PerformanceStatus;
};

export type GoalComparison = {
  period: Period;
  target: number;
  actual: number;
  attainment: number;
  difference: number;
  closingProjection: number;
  status: PerformanceStatus;
};

export type DiagnosticFactor = {
  id: string;
  label: string;
  dimension: "product" | "customer" | "region" | "channel" | "operation";
  impactAmount: number;
  impactPercent: number;
  entity: string;
};

export type PerformanceDiagnostic = {
  id: string;
  sourceId: string;
  title: string;
  summary: string;
  totalImpactAmount: number;
  totalImpactPercent: number;
  factors: DiagnosticFactor[];
  suggestions: Array<{
    id: string;
    title: string;
    description: string;
    href: string;
    linkLabel: string;
  }>;
};

export type SalesMapLevel =
  | "world"
  | "country"
  | "region"
  | "state"
  | "city"
  | "customer"
  | "product"
  | "order";

export type SalesMapNode = {
  id: string;
  level: SalesMapLevel;
  name: string;
  revenue: number;
  volumeKg: number;
  marginPercent: number;
  growthPercent: number;
  target: number;
  attainment: number;
  salesShare: number;
  status: PerformanceStatus;
  children?: SalesMapNode[];
};

export type ResultProjection = {
  period: "month" | "year";
  expectedToDate: number;
  actualToDate: number;
  differenceAmount: number;
  differencePercent: number;
  closingProjection: number;
  target: number;
  status: PerformanceStatus;
};

export type OperationalAlert = {
  id: string;
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  area: string;
};

export type ExecutiveDashboard = {
  updatedAt: string;
  metricsByPeriod: Record<Period, ExecutiveMetric[]>;
  roi: RoiIndicator;
  goals: GoalComparison[];
  projections: ResultProjection[];
  diagnostics: PerformanceDiagnostic[];
  salesMap: SalesMapNode;
  alerts: OperationalAlert[];
};

export type ExecutiveRankingItem = {
  id: string;
  name: string;
  primaryValue: number;
  revenue: number;
  marginPercent: number;
  growthPercent: number;
  salesShare?: number;
};
export type ExecutiveAttentionItem = {
  id: string;
  problem: string;
  impact: string;
  impactAmount: number;
  priority: "high" | "medium" | "low";
  actionLabel: string;
  href: string;
  diagnosticSourceId?: string;
};
export type ExecutiveAiInsight = {
  id: string;
  insight: string;
  cause: string;
  impact: string;
  recommendation: string;
  actionLabel: string;
  href: string;
  isMock: true;
};
export type ExecutiveV3Data = {
  industrial: {
    productionTodayKg: number;
    targetTodayKg: number;
    efficiencyPercent: number;
    capacityUsedPercent: number;
    roastLossPercent: number;
    realCostPerKg: number;
    workOrdersInProgress: number;
    delayedWorkOrders: number;
  };
  inventory: {
    greenCoffeeAvailableKg: number;
    stockValue: number;
    coverageDays: number;
    coverageTargetDays: number;
    finishedGoodsUnits: number;
    attentionLots: number;
    criticalItems: number;
  };
  topCustomers: ExecutiveRankingItem[];
  topProducts: ExecutiveRankingItem[];
  logistics: {
    containersInTransit: number;
    nextArrivals: number;
    openPurchases: number;
    ordersAwaitingShipment: number;
    criticalSupplies: number;
    criticalPackaging: number;
    isMock: true;
  };
  finance: {
    cash: number;
    receivables: number;
    payables: number;
    marginPercent: number;
    projectedProfit: number;
    projectedRoiPercent: number;
    cashTrend: number[];
  };
  attention: ExecutiveAttentionItem[];
  aiInsights: ExecutiveAiInsight[];
};

export type SalesProductPerformance = {
  id: string;
  product: string;
  sku: string;
  revenue: number;
  volumeKg: number;
  target: number;
  attainmentPercent: number;
  marginPercent: number;
  profit: number;
  growthPercent: number;
  orderCount: number;
  averagePricePerKg: number;
  averageTicket: number;
  closingProjection: number;
  trend: number[];
  customers: Array<{
    id: string;
    name: string;
    revenue: number;
    sharePercent: number;
    growthPercent: number;
  }>;
  geography: Array<{
    id: string;
    country: string;
    region: string;
    state: string;
    city: string;
    revenue: number;
    sharePercent: number;
  }>;
  orders: Array<{
    id: string;
    code: string;
    customer: string;
    quantityKg: number;
    amount: number;
    status: string;
    orderedAt: string;
  }>;
};
export type SalesPerformanceDashboard = {
  updatedAt: string;
  period: Period;
  target: number;
  actual: number;
  attainmentPercent: number;
  closingProjection: number;
  marginPercent: number;
  volumeKg: number;
  previousPeriodGrowthPercent: number;
  products: SalesProductPerformance[];
  filterOptions: {
    products: string[];
    customers: string[];
    geographies: string[];
    channels: string[];
  };
};

export type IndustrialMetric = {
  id: string;
  label: string;
  value: string;
  supportingText: string;
  status: PerformanceStatus;
  change?: number;
};

export type ProductionGoal = {
  period: Period;
  targetKg: number;
  actualKg: number;
  attainment: number;
  differenceKg: number;
  status: PerformanceStatus;
};

export type ProductionChartPoint = {
  label: string;
  plannedKg: number;
  actualKg: number;
};

export type ProductionOrderCounts = {
  open: number;
  inProgress: number;
  completed: number;
};

export type ProductionHistoryItem = {
  id: string;
  code: string;
  blend: string;
  plannedKg: number;
  producedKg: number;
  yieldPercent: number;
  costPerKg: number;
  status: "open" | "in-progress" | "completed";
  completedAt?: string;
};

export type SupplyAlert = {
  id: string;
  category: "raw-material" | "supply" | "packaging";
  item: string;
  currentStock: string;
  coverage: string;
  message: string;
  status: PerformanceStatus;
};

export type IndustrialDashboard = {
  updatedAt: string;
  metrics: IndustrialMetric[];
  goals: ProductionGoal[];
  capacity: {
    usedKg: number;
    totalKg: number;
    utilization: number;
    status: PerformanceStatus;
  };
  orders: ProductionOrderCounts;
  productionChart: ProductionChartPoint[];
  history: ProductionHistoryItem[];
  alerts: SupplyAlert[];
};

export type ReceiptStatus =
  "awaiting-lab" | "approved" | "attention" | "blocked";
export type ReceiptApproval = "approved" | "attention" | "rejected";

export type LotCostBreakdown = {
  coffeeValue: number;
  freight: number;
  nonRecoverableTaxes: number;
  unloading: number;
  initialProcessing: number;
  otherDirectCosts: number;
};

export type LabAnalysis = {
  moisturePercent: number;
  waterActivity: number;
  densityGPerL: number;
  screen: string;
  defects: number;
  scaScore: number;
  approval: ReceiptApproval;
};

export type ReceiptLot = {
  id: string;
  code: string;
  supplier: string;
  origin: string;
  quantityKg: number;
  totalCost: number;
  realCostPerKg: number;
  scaScore?: number;
  location: string;
  status: ReceiptStatus;
  receivedAt: string;
  costs: LotCostBreakdown;
  lab?: LabAnalysis;
  traceability: Array<{
    id: string;
    label: string;
    occurredAt: string;
    status: "complete" | "current" | "future";
  }>;
};

export type ReceiptAlert = {
  id: string;
  lotId: string;
  datum: string;
  alert: string;
  diagnosis: string;
  impact: string;
  action: string;
  status: PerformanceStatus;
  ruleReference?: string;
};

export type ReceiptDashboard = {
  updatedAt: string;
  summary: {
    receiptsToday: number;
    receivedKgToday: number;
    receivedValueToday: number;
    averageCostPerKg: number;
    awaitingLab: number;
    blockedLots: number;
  };
  lots: ReceiptLot[];
  alerts: ReceiptAlert[];
};

export type InventoryMovementType =
  | "entry"
  | "exit"
  | "internal-transfer"
  | "production-reservation"
  | "reservation-release"
  | "inventory-adjustment";

export type InventoryMovement = {
  id: string;
  type: InventoryMovementType;
  occurredAt: string;
  userId: string;
  userName: string;
  lotId: string;
  lotCode: string;
  origin: string;
  destination: string;
  quantityKg: number;
  reason: string;
  adjustmentDirection?: "increase" | "decrease";
};

export type InventoryLot = {
  id: string;
  code: string;
  supplier: string;
  producer: string;
  farm: string;
  cityState: string;
  origin: string;
  harvest: string;
  variety: string;
  process: string;
  initialQuantityKg: number;
  availableQuantityKg: number;
  reservedQuantityKg: number;
  realCostPerKg: number;
  totalLotCost: number;
  currentStockValue: number;
  location: string;
  status: ReceiptStatus;
  minimumStockKg: number;
  quality: {
    moisturePercent?: number;
    waterActivity?: number;
    densityGPerL?: number;
    screen?: string;
    defects?: number;
    scaScore?: number;
    notes?: string;
  };
  costs: LotCostBreakdown;
  traceability: ReceiptLot["traceability"];
};

export type InventorySummary = {
  totalGreenCoffeeKg: number;
  financialStockValue: number;
  averageCostPerKg: number;
  activeLots: number;
  blockedLots: number;
  attentionLots: number;
  estimatedCoverageDays: number;
};

export type InventoryAlert = {
  id: string;
  lotId?: string;
  datum: string;
  alert: string;
  diagnosis: string;
  impactKg: number;
  impactAmount: number;
  action: string;
  expectedResult: string;
  status: PerformanceStatus;
};

export type InventoryDashboard = {
  updatedAt: string;
  summary: InventorySummary;
  lots: InventoryLot[];
  movements: InventoryMovement[];
  alerts: InventoryAlert[];
};

export type ProductionOrderStatus =
  | "planned"
  | "reserved"
  | "in-production"
  | "roasted"
  | "packaging"
  | "completed"
  | "blocked"
  | "cancelled";
export type ProductionPriority = "low" | "normal" | "high" | "urgent";

export type ProductionLotAllocation = {
  lotId: string;
  lotCode: string;
  origin: string;
  reservedKg: number;
  consumedKg: number;
  percentage: number;
  realCostPerKg: number;
};

export type ProductionBatchRecord = {
  id: string;
  code: string;
  machine: string;
  operator: string;
  lotCode: string;
  greenInputKg: number;
  roastedOutputKg: number;
  lossKg: number;
  lossPercent: number;
  startedAt: string;
  completedAt: string;
  curveData?: Record<string, unknown>;
  notes?: string;
};

export type PackagingRecord = {
  packageWeightG: number;
  plannedPackages: number;
  producedPackages: number;
  lossPackages: number;
  packagingName: string;
  packagingUnitCost: number;
  labelsCost: number;
  boxesCost: number;
  otherSuppliesCost: number;
};

export type ProductionCostInput = {
  greenCoffeeConsumedCost: number;
  roastLossCost: number;
  packagingCost: number;
  suppliesCost: number;
  laborCost: number;
  energyCost: number;
  otherIndustrialCosts: number;
  roastedOutputKg: number;
  finishedOutputKg: number;
  producedPackages: number;
  standardCostPerKg: number;
  sku: string;
  sourceCostEventIds: string[];
};

export type ProductionCostResult = {
  totalCost: number;
  costPerRoastedKg: number;
  costPerFinishedKg: number;
  costPerPackage: number;
  costPerSku: number;
  standardCostDeviationAmount: number;
  standardCostDeviationPercent: number;
  sourceCostEventIds: string[];
};

export type ProductionAlert = {
  id: string;
  orderId: string;
  batchId?: string;
  datum: string;
  alert: string;
  diagnosis: string;
  expectedLossKg: number;
  actualLossKg: number;
  differenceKg: number;
  financialImpact: number;
  investigationPoints: string[];
  action: string;
  expectedResult: string;
  status: PerformanceStatus;
};

export type ProductionOrderView = {
  id: string;
  code: string;
  productVariantId?: string;
  product: string;
  sku: string;
  plannedQuantity: number;
  producedQuantity: number;
  unit: string;
  plannedAt: string;
  startedAt?: string;
  completedAt?: string;
  responsible: string;
  priority: ProductionPriority;
  status: ProductionOrderStatus;
  blendName: string;
  allocations: ProductionLotAllocation[];
  batches: ProductionBatchRecord[];
  packaging?: PackagingRecord;
  costs: ProductionCostInput;
  traceability: Array<{
    id: string;
    label: string;
    detail: string;
    status: "complete" | "current" | "future";
  }>;
};

export type ProductionDashboard = {
  updatedAt: string;
  summary: {
    plannedTodayKg: number;
    producedTodayKg: number;
    openOrders: number;
    inProgressOrders: number;
    delayedOrders: number;
    efficiencyPercent: number;
    averageRoastLossPercent: number;
    averageRealCostPerKg: number;
    monthlyProducedKg: number;
    monthlyTargetKg: number;
  };
  roastLossTargetPercent: number;
  orders: ProductionOrderView[];
  alerts: ProductionAlert[];
};

export * from "./production-cost-engine.js";
export * from "./cost-engine-v2.js";
export * from "./cost-period-engine.js";
export * from "./analytics-contract.js";

export * from "./inventory-engine.js";
export * from "./sales-inventory-engine.js";
export * from "./reconciliation-engine.js";

export const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});
