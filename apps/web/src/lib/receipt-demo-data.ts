import type { ReceiptDashboard } from '@bbos/shared';

export const receiptDemoDashboard: ReceiptDashboard = {
  updatedAt: '2026-08-06T11:40:00-03:00',
  summary: { receiptsToday: 4, receivedKgToday: 7800, receivedValueToday: 226460, averageCostPerKg: 29.03, awaitingLab: 2, blockedLots: 1 },
  lots: [
    {
      id: 'lot-014', code: 'CV-2026-014', supplier: 'Fazenda Boa Esperança', origin: 'Carmo de Minas, MG', quantityKg: 4800, totalCost: 134880, realCostPerKg: 28.1, scaScore: 86.5, location: 'ACV • Rua A-04', status: 'approved', receivedAt: 'Hoje, 08:42',
      costs: { coffeeValue: 128640, freight: 3600, nonRecoverableTaxes: 0, unloading: 640, initialProcessing: 1600, otherDirectCosts: 400 },
      lab: { moisturePercent: 11.2, waterActivity: 0.56, densityGPerL: 718, screen: '16 acima', defects: 5, scaScore: 86.5, approval: 'approved' },
      traceability: [{ id: 't1', label: 'Recebimento', occurredAt: 'Hoje, 08:42', status: 'complete' }, { id: 't2', label: 'Laboratório', occurredAt: 'Hoje, 09:18', status: 'complete' }, { id: 't3', label: 'Aprovação', occurredAt: 'Hoje, 09:34', status: 'complete' }, { id: 't4', label: 'Estoque', occurredAt: 'Hoje, 09:48', status: 'current' }, { id: 't5', label: 'Produção', occurredAt: 'Futuro', status: 'future' }, { id: 't6', label: 'Blend', occurredAt: 'Futuro', status: 'future' }, { id: 't7', label: 'Produto', occurredAt: 'Futuro', status: 'future' }, { id: 't8', label: 'Pedido', occurredAt: 'Futuro', status: 'future' }, { id: 't9', label: 'Cliente', occurredAt: 'Futuro', status: 'future' }],
    },
    {
      id: 'lot-019', code: 'CV-2026-019', supplier: 'Sítio Santa Clara', origin: 'Patrocínio, MG', quantityKg: 1800, totalCost: 53280, realCostPerKg: 29.6, scaScore: 84.2, location: 'Quarentena • Q-02', status: 'attention', receivedAt: 'Hoje, 10:16',
      costs: { coffeeValue: 49320, freight: 2250, nonRecoverableTaxes: 0, unloading: 360, initialProcessing: 1050, otherDirectCosts: 300 },
      lab: { moisturePercent: 12.1, waterActivity: 0.62, densityGPerL: 704, screen: '15 acima', defects: 8, scaScore: 84.2, approval: 'attention' },
      traceability: [{ id: 't1', label: 'Recebimento', occurredAt: 'Hoje, 10:16', status: 'complete' }, { id: 't2', label: 'Laboratório', occurredAt: 'Hoje, 10:52', status: 'complete' }, { id: 't3', label: 'Aprovação', occurredAt: 'Em análise', status: 'current' }, { id: 't4', label: 'Estoque', occurredAt: 'Pendente', status: 'future' }],
    },
    {
      id: 'lot-020', code: 'CV-2026-020', supplier: 'Fazenda Horizonte', origin: 'Varginha, MG', quantityKg: 1200, totalCost: 38300, realCostPerKg: 31.92, location: 'Quarentena • Q-03', status: 'awaiting-lab', receivedAt: 'Hoje, 11:05',
      costs: { coffeeValue: 36000, freight: 1500, nonRecoverableTaxes: 0, unloading: 240, initialProcessing: 360, otherDirectCosts: 200 },
      traceability: [{ id: 't1', label: 'Recebimento', occurredAt: 'Hoje, 11:05', status: 'complete' }, { id: 't2', label: 'Laboratório', occurredAt: 'Aguardando', status: 'current' }, { id: 't3', label: 'Aprovação', occurredAt: 'Pendente', status: 'future' }, { id: 't4', label: 'Estoque', occurredAt: 'Pendente', status: 'future' }],
    },
    {
      id: 'lot-018', code: 'CV-2026-018', supplier: 'Fazenda Boa Esperança', origin: 'Sul de Minas, MG', quantityKg: 2940, totalCost: 93600, realCostPerKg: 31.84, scaScore: 82.8, location: 'Bloqueados • B-01', status: 'blocked', receivedAt: 'Ontem, 15:28',
      costs: { coffeeValue: 88920, freight: 2800, nonRecoverableTaxes: 0, unloading: 480, initialProcessing: 1100, otherDirectCosts: 300 },
      lab: { moisturePercent: 12.8, waterActivity: 0.67, densityGPerL: 682, screen: '14 acima', defects: 12, scaScore: 82.8, approval: 'rejected' },
      traceability: [{ id: 't1', label: 'Recebimento', occurredAt: 'Ontem, 15:28', status: 'complete' }, { id: 't2', label: 'Laboratório', occurredAt: 'Ontem, 16:10', status: 'complete' }, { id: 't3', label: 'Aprovação', occurredAt: 'Bloqueado', status: 'current' }, { id: 't4', label: 'Estoque', occurredAt: 'Pendente', status: 'future' }],
    },
  ],
  alerts: [
    { id: 'alert-1', lotId: 'lot-019', datum: 'Umidade medida: 12,1%', alert: 'Umidade fora da faixa configurada', diagnosis: 'Diferença de +0,1 p.p. em relação ao limite operacional configurado de 12,0%.', impact: 'Lote de 1.800 kg permanece em quarentena; R$ 53.280 sem disponibilidade para produção.', action: 'Solicitar avaliação do responsável técnico e registrar decisão no laboratório.', status: 'attention', ruleReference: 'Regra interna QL-UMI-01 • limite 12,0%' },
    { id: 'alert-2', lotId: 'lot-018', datum: 'Aw medida: 0,67', alert: 'Atividade de água acima da regra configurada', diagnosis: 'Diferença de +0,02 em relação ao limite operacional configurado de 0,65.', impact: 'Lote de 2.940 kg bloqueado; impacto potencial de R$ 93.600 no estoque disponível.', action: 'Manter bloqueio e encaminhar para decisão técnica documentada.', status: 'off-track', ruleReference: 'Regra interna QL-AW-01 • limite 0,65' },
  ],
};
