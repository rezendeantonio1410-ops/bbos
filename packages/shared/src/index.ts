export type Period = 'day' | 'week' | 'month' | 'year';

export type ExecutiveMetric = {
  label: string;
  value: string;
  change: number;
  supportingText: string;
};

export type OperationalAlert = {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  area: string;
};

export type ExecutiveDashboard = {
  updatedAt: string;
  metrics: ExecutiveMetric[];
  monthlyResult: { projected: number; actual: number };
  yearlyResult: { projected: number; actual: number };
  goalProgress: number;
  alerts: OperationalAlert[];
};

export const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});
