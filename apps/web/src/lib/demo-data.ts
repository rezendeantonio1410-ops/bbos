import type { ExecutiveDashboard } from '@bbos/shared';

export const demoDashboard: ExecutiveDashboard = {
  updatedAt: '2026-08-06T10:30:00-03:00',
  metrics: [
    { label: 'Receita', value: 'R$ 486.320', change: 12.4, supportingText: 'vs. mês anterior' },
    { label: 'Lucro operacional', value: 'R$ 91.340', change: 8.7, supportingText: '18,8% da receita' },
    { label: 'Margem', value: '18,8%', change: 1.6, supportingText: 'meta 20,0%' },
    { label: 'Caixa', value: 'R$ 728.450', change: 4.2, supportingText: 'posição disponível' },
    { label: 'Produção', value: '18.420 kg', change: 6.8, supportingText: 'rendimento 84,5%' },
    { label: 'Café verde', value: '42.180 kg', change: -3.2, supportingText: '52 dias de cobertura' },
    { label: 'Pedidos', value: '164', change: 14.1, supportingText: '92% no prazo' },
    { label: 'Meta x realizado', value: '94,6%', change: 2.9, supportingText: 'R$ 27,8 mil para a meta' },
  ],
  monthlyResult: { projected: 108000, actual: 91340 }, yearlyResult: { projected: 1240000, actual: 892600 }, goalProgress: 94.6,
  alerts: [
    { id: '1', severity: 'warning', title: 'Cobertura abaixo do ideal', description: 'Lote CV-2026-018 tem 18 dias de cobertura.', area: 'Estoque' },
    { id: '2', severity: 'critical', title: 'Análise laboratorial pendente', description: '2 lotes aguardam liberação há mais de 24h.', area: 'Laboratório' },
    { id: '3', severity: 'info', title: 'Manutenção programada', description: 'Torrador 02 — sábado, 08:00.', area: 'Produção' },
  ],
};
