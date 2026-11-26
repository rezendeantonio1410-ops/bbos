/**
 * Despesas fixas aprendidas pelo extrato: uma linha por favorecido (CNPJ/CPF
 * ou nome), com o valor do último mês e o dia em que costuma sair. Quem usa o
 * BBOS pode corrigir valor e dia (ex.: aluguel vence dia 10); a correção não é
 * sobrescrita pelos próximos extratos.
 */
export const FIXED_CATEGORIES = new Set([
  "Aluguel", "Água", "Energia elétrica", "Internet / telefonia", "Seguros", "Site / sistemas",
  "Contabilidade", "Funcionários / salários", "Encargos trabalhistas",
]);

export type PaidExpense = { key: string; label: string; category: string; amount: number; date: string };
export type RecurringCandidate = { key: string; label: string; category: string; amount: number; dayOfMonth: number; lastPaidAt: string };

/** CNPJ/CPF; sem ele, o nome sem datas e números ("SEGURO ITAUEMPRESA 03/11" → "SEGURO ITAUEMPRESA"). */
export const recurringKey = (taxId: string, name: string) =>
  (taxId || name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z]+/g, " ").trim()).slice(0, 80);

/** "SEGURO ITAUEMPRESA 03/11" → "Seguro Itauempresa"; "COPEL-DIS" → "Copel-Dis". */
export function readableLabel(value: string) {
  const small = new Set(["de", "da", "do", "das", "dos", "e"]);
  return value
    .replace(/\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/g, "")
    .replace(/^\d[\d.]*\s+/, "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word, i) => (i > 0 && small.has(word) ? word : word.replace(/(^|[-/])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase())))
    .join(" ")
    .replace(/\bS A\b/i, "S.A.")
    .trim();
}

/** Soma as contas do mesmo favorecido no mês mais recente (ex.: duas contas da Sanepar). */
export function recurringCandidates(expenses: PaidExpense[]): RecurringCandidate[] {
  const byKey = new Map<string, PaidExpense[]>();
  for (const expense of expenses) {
    if (!FIXED_CATEGORIES.has(expense.category) || !expense.key) continue;
    byKey.set(expense.key, [...(byKey.get(expense.key) ?? []), expense]);
  }
  const result: RecurringCandidate[] = [];
  for (const [key, list] of byKey) {
    const lastMonth = list.map((e) => e.date.slice(0, 7)).sort().at(-1)!;
    const month = list.filter((e) => e.date.startsWith(lastMonth)).sort((a, b) => a.date.localeCompare(b.date));
    const last = month.at(-1)!;
    result.push({
      key,
      label: readableLabel(last.label) || last.label,
      category: last.category,
      amount: Math.round(month.reduce((sum, e) => sum + e.amount, 0) * 100) / 100,
      dayOfMonth: Number(last.date.slice(8, 10)),
      lastPaidAt: last.date,
    });
  }
  return result.sort((a, b) => b.amount - a.amount);
}

/** Saldo no começo do dia final do extrato: os lançamentos desse dia entram como movimento. */
export function statementStartBalance(closingBalance: number, lines: Array<{ date: string; amount: number }>, lastDay: string) {
  const sameDay = lines.filter((line) => line.date === lastDay).reduce((sum, line) => sum + line.amount, 0);
  return Math.round((closingBalance - sameDay) * 100) / 100;
}

/** Validação de valor, dia e nome ao editar ou cadastrar. */
export function validateRecurring(body: { label?: string; category?: string; amount?: number; dayOfMonth?: number } | undefined, required: boolean) {
  const out: { label?: string; category?: string; amount?: number; dayOfMonth?: number } = {};
  if (body?.label !== undefined || required) {
    const label = String(body?.label ?? "").trim();
    if (label.length < 2 || label.length > 160) throw new Error("Informe o nome da despesa.");
    out.label = label;
  }
  if (body?.category !== undefined || required) {
    const category = String(body?.category ?? "").trim();
    if (!category || category.length > 80) throw new Error("Informe a categoria.");
    out.category = category;
  }
  if (body?.amount !== undefined || required) {
    const amount = Number(body?.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) throw new Error("Valor inválido.");
    out.amount = Math.round(amount * 100) / 100;
  }
  if (body?.dayOfMonth !== undefined || required) {
    const day = Number(body?.dayOfMonth);
    if (!Number.isInteger(day) || day < 1 || day > 31) throw new Error("Dia do mês deve ser de 1 a 31.");
    out.dayOfMonth = day;
  }
  return out;
}
