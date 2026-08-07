import type { IndustrialDashboard } from '@bbos/shared';

export const industrialDemoDashboard: IndustrialDashboard = {
  updatedAt: '2026-08-06T11:15:00-03:00',
  metrics: [
    { id: 'efficiency', label: 'Eficiência da produção', value: '91,8%', supportingText: 'meta operacional 90%', status: 'on-track', change: 2.4 },
    { id: 'yield', label: 'Rendimento industrial', value: '84,5%', supportingText: 'meta técnica 85%', status: 'attention', change: 0.8 },
    { id: 'losses', label: 'Perdas de produção', value: '2,7%', supportingText: 'limite máximo 3%', status: 'on-track', change: -0.4 },
    { id: 'green-consumed', label: 'Café verde consumido', value: '21.800 kg', supportingText: 'no mês atual', status: 'on-track', change: 6.2 },
    { id: 'roasted-produced', label: 'Café torrado produzido', value: '18.420 kg', supportingText: '84,5% de rendimento', status: 'attention', change: 5.8 },
    { id: 'packed-produced', label: 'Café embalado produzido', value: '17.860 kg', supportingText: '97% do torrado', status: 'on-track', change: 7.1 },
    { id: 'average-cost', label: 'Custo médio produzido', value: 'R$ 34,72/kg', supportingText: 'meta R$ 35,00/kg', status: 'on-track', change: -1.6 },
  ],
  goals: [
    { period: 'day', targetKg: 1500, actualKg: 1240, attainment: 82.7, differenceKg: -260, status: 'off-track' },
    { period: 'week', targetKg: 5000, actualKg: 4680, attainment: 93.6, differenceKg: -320, status: 'off-track' },
    { period: 'month', targetKg: 20000, actualKg: 18420, attainment: 92.1, differenceKg: -1580, status: 'off-track' },
    { period: 'year', targetKg: 180000, actualKg: 142860, attainment: 79.4, differenceKg: -37140, status: 'off-track' },
  ],
  capacity: { usedKg: 18420, totalKg: 24000, utilization: 76.8, status: 'on-track' },
  orders: { open: 7, inProgress: 3, completed: 42 },
  productionChart: [
    { label: '01 ago', plannedKg: 1080, actualKg: 1020 }, { label: '02 ago', plannedKg: 1200, actualKg: 1180 },
    { label: '03 ago', plannedKg: 1320, actualKg: 1250 }, { label: '04 ago', plannedKg: 1240, actualKg: 1270 },
    { label: '05 ago', plannedKg: 1480, actualKg: 1390 }, { label: '06 ago', plannedKg: 1500, actualKg: 1240 },
    { label: '07 ago', plannedKg: 1380, actualKg: 0 },
  ],
  history: [
    { id: '1', code: 'OP-2026-0091', blend: 'Bispo Essencial', plannedKg: 1500, producedKg: 1240, yieldPercent: 84.3, costPerKg: 34.88, status: 'in-progress' },
    { id: '2', code: 'OP-2026-0090', blend: 'Doce de Leite', plannedKg: 1200, producedKg: 1035, yieldPercent: 86.3, costPerKg: 36.14, status: 'completed', completedAt: 'Hoje, 09:42' },
    { id: '3', code: 'OP-2026-0089', blend: 'Caramelo', plannedKg: 900, producedKg: 748, yieldPercent: 83.1, costPerKg: 35.92, status: 'completed', completedAt: 'Ontem, 17:18' },
    { id: '4', code: 'OP-2026-0088', blend: 'Bispo Essencial', plannedKg: 1350, producedKg: 1149, yieldPercent: 85.1, costPerKg: 33.76, status: 'completed', completedAt: '05 ago, 16:54' },
    { id: '5', code: 'OP-2026-0092', blend: 'Raro', plannedKg: 600, producedKg: 0, yieldPercent: 0, costPerKg: 0, status: 'open' },
  ],
  alerts: [
    { id: 'a1', category: 'raw-material', item: 'Lote CV-2026-018', currentStock: '2.940 kg', coverage: '18 dias', message: 'Cobertura abaixo do estoque de segurança.', status: 'off-track' },
    { id: 'a2', category: 'packaging', item: 'Embalagem 500g — Essencial', currentStock: '3.240 un.', coverage: '6 dias', message: 'Reposição necessária antes da próxima semana.', status: 'attention' },
    { id: 'a3', category: 'supply', item: 'Válvula desgaseificadora', currentStock: '8.600 un.', coverage: '16 dias', message: 'Consumo dentro do previsto; compra já programada.', status: 'on-track' },
  ],
};
