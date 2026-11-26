/**
 * Extrato "Entradas e Saídas" do Itaú Empresas (PDF) e OFX de qualquer banco.
 *
 * O PDF é lido pela posição do texto na página: data, lançamento, razão
 * social, CNPJ/CPF, valor e saldo ficam sempre nas mesmas colunas. Linhas
 * com texto em duas alturas (ex.: "RECEBIMENTO REDE VISA / CD...") são
 * agrupadas pela data mais próxima.
 */
import { createHash } from "node:crypto";

export type StatementLine = {
  /** Identificador estável da linha (o mesmo arquivo gera os mesmos ids). */
  externalId: string;
  date: string; // AAAA-MM-DD
  description: string;
  counterparty: string;
  taxId: string; // só dígitos/letras
  /** Valor com sinal: positivo entra, negativo sai. */
  amount: number;
};

export type ParsedStatement = {
  bank: string;
  agency: string | null;
  account: string | null;
  from: string | null;
  to: string | null;
  openingBalance: number | null;
  closingBalance: number | null;
  lines: StatementLine[];
};

export type PdfTextItem = { str: string; x: number; y: number };

const DATE = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const MONEY = /^-?\d{1,3}(\.\d{3})*,\d{2}$/;

export function brMoney(value: string) {
  return Number(value.replace(/\./g, "").replace(",", "."));
}

function isoDate(value: string) {
  const m = DATE.exec(value.trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

export const cleanTaxId = (value: string) => value.replace(/[^0-9A-Za-z]/g, "").toUpperCase();

/** Ids estáveis: mesma data, valor e texto recebem um número de ordem. */
export function withStableIds(lines: Omit<StatementLine, "externalId">[]): StatementLine[] {
  const seen = new Map<string, number>();
  return lines.map((line) => {
    const base = [line.date, line.amount.toFixed(2), line.description.toUpperCase(), line.taxId].join("|");
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return { ...line, externalId: "itau-" + createHash("sha256").update(`${base}|${n}`).digest("hex").slice(0, 32) };
  });
}

/** Lê as páginas (itens de texto com posição) do PDF do Itaú. */
export function parseItauStatementItems(pages: PdfTextItem[][]): ParsedStatement {
  const result: ParsedStatement = { bank: "Itaú", agency: null, account: null, from: null, to: null, openingBalance: null, closingBalance: null, lines: [] };
  const rows: Omit<StatementLine, "externalId">[] = [];
  for (const page of pages) {
    const items = page.filter((item) => item.str.trim()).map((item) => ({ ...item, str: item.str.trim() }));
    // Cabeçalho: agência, conta, período e saldo total.
    items.forEach((item, index) => {
      const next = items[index + 1]?.str ?? "";
      if (item.str === "Agência" && /^\d{4}$/.test(next)) result.agency = next;
      if (item.str === "Conta" && /^\d[\d-]+$/.test(next)) result.account = next;
      const period = /(\d{2}\/\d{2}\/\d{4})\s+até\s+(\d{2}\/\d{2}\/\d{4})/.exec(item.str);
      if (period) { result.from = isoDate(period[1]!); result.to = isoDate(period[2]!); }
      if (item.str === "Saldo total") {
        const value = items.find((other) => other.y < item.y && other.y > item.y - 30 && Math.abs(other.x - item.x) < 10 && /^R\$/.test(other.str));
        if (value && result.closingBalance === null) result.closingBalance = brMoney(value.str.replace(/^R\$\s*/, ""));
      }
    });
    // Linhas: cada data na primeira coluna é uma âncora.
    const anchors = items.filter((item) => item.x < 80 && DATE.test(item.str));
    const byAnchor = new Map<PdfTextItem, PdfTextItem[]>(anchors.map((anchor) => [anchor, []]));
    for (const item of items) {
      if (item.x < 80 || anchors.length === 0) continue;
      let best: PdfTextItem | null = null;
      for (const anchor of anchors) {
        const dy = Math.abs(anchor.y - item.y);
        if (dy <= 14 && (!best || dy < Math.abs(best.y - item.y))) best = anchor;
      }
      if (best) byAnchor.get(best)!.push(item);
    }
    for (const anchor of anchors) {
      const cells = byAnchor.get(anchor)!.sort((a, b) => b.y - a.y || a.x - b.x);
      const text = (min: number, max: number) => cells.filter((c) => c.x >= min && c.x < max).map((c) => c.str).join(" ").replace(/\s+/g, " ").trim();
      const description = text(85, 220);
      const counterparty = text(220, 355);
      const taxId = cleanTaxId(text(355, 455));
      const value = cells.find((c) => c.x >= 455 && c.x < 515 && MONEY.test(c.str));
      const balance = cells.find((c) => c.x >= 515 && MONEY.test(c.str));
      const date = isoDate(anchor.str)!;
      if (/^SALDO ANTERIOR/i.test(description) && balance) { result.openingBalance = brMoney(balance.str); continue; }
      if (/^SALDO /i.test(description) || !value) continue;
      // Linha partida na virada de página: "RENDIMENTOS REND PAGO APLIC" / "AUT MAIS".
      if (/^AUT MAIS$/i.test(description)) { rows.push({ date, description: "RENDIMENTOS REND PAGO APLIC AUT MAIS", counterparty, taxId, amount: brMoney(value.str) }); continue; }
      rows.push({ date, description, counterparty, taxId, amount: brMoney(value.str) });
    }
  }
  // O extrato vem do mais novo para o mais antigo; guardamos em ordem de data.
  result.lines = withStableIds(rows.reverse());
  return result;
}

export async function readItauPdf(content: Buffer): Promise<ParsedStatement> {
  // unpdf é ESM; o import dinâmico evita que o TypeScript o troque por require().
  const load = new Function("name", "return import(name)") as (name: string) => Promise<any>;
  const { getDocumentProxy } = await load("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(content));
  const pages: PdfTextItem[][] = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const text = await page.getTextContent();
    pages.push(text.items.map((item: any) => ({ str: String(item.str ?? ""), x: item.transform[4], y: item.transform[5] })));
  }
  const parsed = parseItauStatementItems(pages);
  if (!parsed.lines.length) throw new Error("Não encontrei lançamentos neste PDF. Use o extrato \"Entradas e Saídas\" do Itaú ou o arquivo OFX.");
  return parsed;
}

/** OFX (Itaú e outros bancos): STMTTRN com DTPOSTED, TRNAMT, FITID, NAME/MEMO. */
export function parseOfx(content: string): ParsedStatement {
  const field = (block: string, name: string) => new RegExp(`<${name}>([^<\\r\\n]+)`, "i").exec(block)?.[1]?.trim() ?? "";
  const blocks = content.split(/<STMTTRN>/i).slice(1);
  const lines = blocks.map((block) => {
    const raw = field(block, "DTPOSTED");
    const name = field(block, "NAME");
    const memo = field(block, "MEMO");
    return {
      externalId: "ofx-" + (field(block, "FITID") || createHash("sha256").update(block).digest("hex").slice(0, 32)),
      date: `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`,
      description: memo || name || "Movimentação bancária",
      counterparty: memo && name && memo !== name ? name : "",
      taxId: "",
      amount: Number(field(block, "TRNAMT").replace(",", ".")),
    };
  }).filter((line) => Number.isFinite(line.amount) && line.amount !== 0 && /^\d{4}-\d{2}-\d{2}$/.test(line.date));
  const closing = /<LEDGERBAL>[\s\S]*?<BALAMT>([^<\r\n]+)/i.exec(content)?.[1];
  const dates = lines.map((line) => line.date).sort();
  return {
    bank: field(content, "ORG") || "Banco",
    agency: field(content, "BRANCHID") || null,
    account: field(content, "ACCTID") || null,
    from: dates[0] ?? null,
    to: dates.at(-1) ?? null,
    openingBalance: null,
    closingBalance: closing ? Number(closing.replace(",", ".")) : null,
    lines,
  };
}

/** Saldo inicial + movimentos = saldo final do banco (tolerância de R$ 0,05). */
export function balanceCheck(statement: ParsedStatement) {
  const inflow = round(statement.lines.filter((l) => l.amount > 0).reduce((s, l) => s + l.amount, 0));
  const outflow = round(statement.lines.filter((l) => l.amount < 0).reduce((s, l) => s - l.amount, 0));
  if (statement.openingBalance === null || statement.closingBalance === null)
    return { inflow, outflow, computed: null, ok: null as boolean | null, difference: null as number | null };
  const computed = round(statement.openingBalance + inflow - outflow);
  const difference = round(statement.closingBalance - computed);
  return { inflow, outflow, computed, ok: Math.abs(difference) <= 0.05, difference };
}

const round = (value: number) => Math.round(value * 100) / 100;
