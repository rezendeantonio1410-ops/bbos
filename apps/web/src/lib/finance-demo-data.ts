export const financeDemo = {
  cash: 312400, receivables: 384200, payables: 218900, projectedBalance: 477700,
  invoicedRevenue: 486320, operatingResult: 91340, delinquency: 18400,
  receivablesRows: [
    { customer: "Coffee Island", document: "FAT-2026-081", due: "12/08/2026", amount: 82400, open: 82400, status: "A vencer" },
    { customer: "MAE Coffee", document: "FAT-2026-074", due: "05/08/2026", amount: 46800, open: 18400, status: "Parcial" },
    { customer: "Kios Coffee", document: "FAT-2026-069", due: "28/07/2026", amount: 31200, open: 31200, status: "Vencido" },
  ],
  payablesRows: [
    { supplier: "Companhia Elétrica", description: "Conta de energia industrial", center: "Torrefação", due: "15/08/2026", amount: 28600, open: 28600, status: "A vencer" },
    { supplier: "Gás Brasil", description: "Gás de torra", center: "Torrefação", due: "10/08/2026", amount: 14800, open: 14800, status: "A vencer" },
    { supplier: "Logística Sul", description: "Fretes em aberto", center: "Logística", due: "02/08/2026", amount: 18400, open: 18400, status: "Vencido" },
  ],
};
