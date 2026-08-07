import { Controller, Get, Query } from '@nestjs/common';
import type { ExecutiveDashboard, Period } from '@bbos/shared';

const periodFactors: Record<Period, number> = { day: 0.045, week: 0.24, month: 1, year: 9.3 };

@Controller('dashboard')
export class DashboardController {
  @Get('executive')
  executive(@Query('period') period: Period = 'month'): ExecutiveDashboard {
    const factor = periodFactors[period] ?? 1;
    const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value * factor);
    return {
      updatedAt: new Date().toISOString(),
      metrics: [
        { label: 'Receita', value: money(486320), change: 12.4, supportingText: 'vs. período anterior' },
        { label: 'Lucro operacional', value: money(91340), change: 8.7, supportingText: '18,8% da receita' },
        { label: 'Margem', value: '18,8%', change: 1.6, supportingText: 'meta 20,0%' },
        { label: 'Caixa', value: money(728450), change: 4.2, supportingText: 'posição disponível' },
        { label: 'Produção', value: `${Math.round(18420 * factor).toLocaleString('pt-BR')} kg`, change: 6.8, supportingText: 'rendimento 84,5%' },
        { label: 'Café verde', value: `${Math.round(42180).toLocaleString('pt-BR')} kg`, change: -3.2, supportingText: '52 dias de cobertura' },
        { label: 'Pedidos', value: Math.max(8, Math.round(164 * factor)).toString(), change: 14.1, supportingText: '92% no prazo' },
        { label: 'Meta x realizado', value: '94,6%', change: 2.9, supportingText: 'R$ 27,8 mil para a meta' },
      ],
      monthlyResult: { projected: 108000, actual: 91340 },
      yearlyResult: { projected: 1240000, actual: 892600 },
      goalProgress: 94.6,
      alerts: [
        { id: '1', severity: 'warning', title: 'Cobertura abaixo do ideal', description: 'Lote CV-2026-018 tem 18 dias de cobertura.', area: 'Estoque' },
        { id: '2', severity: 'critical', title: 'Análise laboratorial pendente', description: '2 lotes aguardam liberação há mais de 24h.', area: 'Laboratório' },
        { id: '3', severity: 'info', title: 'Manutenção programada', description: 'Torrador 02 — sábado, 08:00.', area: 'Produção' },
      ],
    };
  }
}
