export type AnalyticsPeriod = {
  granularity: "DAY" | "WEEK" | "MONTH" | "QUARTER" | "YEAR";
  startsAt: string;
  endsAt: string;
  timezone: string;
};

export type AnalyticsEntity = {
  type:
    | "COMPANY"
    | "PRODUCT_LINE"
    | "PRODUCT"
    | "SKU"
    | "PRODUCTION_ORDER"
    | "LOT"
    | "CUSTOMER"
    | "ORDER"
    | "REGION"
    | "STATE"
    | "COST_CENTER";
  id: string;
  label: string;
};

export type MetricSource = {
  domain:
    | "PRODUCTS"
    | "SALES"
    | "PRODUCTION"
    | "INVENTORY"
    | "COST_ENGINE"
    | "FINANCE"
    | "ORDERS"
    | "LOGISTICS";
  entityType: string;
  entityId: string;
  transactionId?: string;
  calculatedAt: string;
  calculationVersion?: string;
};

export type MetricStatus =
  "POSITIVE" | "NORMAL" | "ATTENTION" | "CRITICAL" | "NO_DATA";

export type HumanizedMetric = {
  key: string;
  label: string;
  unit: "BRL" | "PERCENT" | "KG" | "UNIT" | "DAYS" | "HOURS";
  actual: number;
  target?: number;
  previous?: number;
  variance?: number;
  trend?: number;
  period: AnalyticsPeriod;
  entity: AnalyticsEntity;
  source: MetricSource;
  financialImpact?: number;
  status?: MetricStatus;
  breakdown?: HumanizedMetric[];
};
