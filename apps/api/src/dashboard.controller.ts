import { Controller, Get, Query } from '@nestjs/common';
import type { ExecutiveDashboard, IndustrialDashboard, Period } from '@bbos/shared';

const periodFactors: Record<Period, number> = { day: 0.045, week: 0.24, month: 1, year: 9.3 };

@Controller('dashboard')
export class DashboardController {
  @Get('industrial')
  industrial(): IndustrialDashboard {
    return {
      updatedAt: new Date().toISOString(),
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
      ],
      history: [
        { id: '1', code: 'OP-2026-0091', blend: 'Bispo Essencial', plannedKg: 1500, producedKg: 1240, yieldPercent: 84.3, costPerKg: 34.88, status: 'in-progress' },
        { id: '2', code: 'OP-2026-0090', blend: 'Doce de Leite', plannedKg: 1200, producedKg: 1035, yieldPercent: 86.3, costPerKg: 36.14, status: 'completed', completedAt: 'Hoje, 09:42' },
      ],
      alerts: [
        { id: 'a1', category: 'raw-material', item: 'Lote CV-2026-018', currentStock: '2.940 kg', coverage: '18 dias', message: 'Cobertura abaixo do estoque de segurança.', status: 'off-track' },
        { id: 'a2', category: 'packaging', item: 'Embalagem 500g — Essencial', currentStock: '3.240 un.', coverage: '6 dias', message: 'Reposição necessária antes da próxima semana.', status: 'attention' },
      ],
    };
  }

  @Get('executive')
  executive(@Query('period') period: Period = 'month'): ExecutiveDashboard {
    const factor = periodFactors[period] ?? 1;
    const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value * factor);
    return {
      updatedAt: new Date().toISOString(),
      metricsByPeriod: { day: [
        { label: 'Receita', value: money(486320), change: 12.4, supportingText: 'vs. período anterior' },
      ], week: [], month: [
        { label: 'Receita', value: money(486320), change: 12.4, supportingText: 'vs. período anterior' },
        { label: 'Lucro operacional', value: money(91340), change: 8.7, supportingText: '18,8% da receita' },
        { label: 'Margem', value: '18,8%', change: 1.6, supportingText: 'meta 20,0%' },
        { label: 'Caixa', value: money(728450), change: 4.2, supportingText: 'posição disponível' },
        { label: 'Produção', value: `${Math.round(18420 * factor).toLocaleString('pt-BR')} kg`, change: 6.8, supportingText: 'rendimento 84,5%' },
        { label: 'Café verde', value: `${Math.round(42180).toLocaleString('pt-BR')} kg`, change: -3.2, supportingText: '52 dias de cobertura' },
        { label: 'Pedidos', value: Math.max(8, Math.round(164 * factor)).toString(), change: 14.1, supportingText: '92% no prazo' },
        { label: 'Meta x realizado', value: '94,6%', change: 2.9, supportingText: 'R$ 27,8 mil para a meta' },
      ], year: [] },
      roi: { current: 18.7, target: 20, difference: -1.3, trend: 1.8, status: 'attention' },
      goals: [
        { period: 'day', target: 26000, actual: 24860, attainment: 95.6, difference: -1140, closingProjection: 25520, status: 'attention' },
        { period: 'week', target: 120000, actual: 118740, attainment: 99, difference: -1260, closingProjection: 121800, status: 'attention' },
        { period: 'month', target: 514100, actual: 486320, attainment: 94.6, difference: -27780, closingProjection: 505600, status: 'off-track' },
        { period: 'year', target: 5200000, actual: 3842600, attainment: 73.9, difference: -1357400, closingProjection: 5084000, status: 'off-track' },
      ],
      projections: [
        { period: 'month', expectedToDate: 501200, actualToDate: 486320, differenceAmount: -14880, differencePercent: -3, closingProjection: 505600, target: 514100, status: 'attention' },
        { period: 'year', expectedToDate: 3975000, actualToDate: 3842600, differenceAmount: -132400, differencePercent: -3.3, closingProjection: 5084000, target: 5200000, status: 'attention' },
      ],
      diagnostics: [],
      salesMap: { id: 'country-br', level: 'country', name: 'Brasil', revenue: 486320, volumeKg: 6420, marginPercent: 18.8, growthPercent: 12.4, target: 514100, attainment: 94.6, salesShare: 100, status: 'off-track' },
      alerts: [
        { id: '1', severity: 'warning', title: 'Cobertura abaixo do ideal', description: 'Lote CV-2026-018 tem 18 dias de cobertura.', area: 'Estoque' },
        { id: '2', severity: 'critical', title: 'Análise laboratorial pendente', description: '2 lotes aguardam liberação há mais de 24h.', area: 'Laboratório' },
        { id: '3', severity: 'info', title: 'Manutenção programada', description: 'Torrador 02 — sábado, 08:00.', area: 'Produção' },
      ],
    };
  }
}
