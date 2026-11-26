import assert from "node:assert/strict";
import test from "node:test";
import { balanceCheck, parseItauStatementItems, parseOfx, withStableIds } from "./bank-statement-itau";
import { planStatement, suggestExpense, suggestIncome } from "./statement-matching";

// Itens de texto como o PDF "Entradas e Saídas" do Itaú os entrega (x, y).
const t = (str: string, x: number, y: number) => ({ str, x, y });
const page = [
  t("Agência", 436, 748), t("1234", 470, 748), t("Conta", 491, 748), t("0012345-6", 517, 748),
  t("Saldo total", 35, 712), t("R$ 1.000,00", 35, 692),
  t("Lançamentos do período:", 34, 654), t("01/11/2026 até 05/11/2026", 131, 654),
  t("05/11/2026", 35, 615), t("SALDO EM CONTA CORRENTE", 90, 615), t("1.000,00", 527, 615),
  t("05/11/2026", 35, 590), t("PIX ENVIADO", 90, 590), t("FORNECEDOR CAFE LTDA", 227, 590), t("11.111.111/0001-11", 363, 590), t("-4.440,00", 474, 590),
  t("05/11/2026", 35, 577), t("PIX ENVIADO", 90, 577), t("FORNECEDOR CAFE LTDA", 227, 577), t("11.111.111/0001-11", 363, 577), t("-600,00", 480, 577),
  // célula em duas alturas (texto 6 pt acima e abaixo da data)
  t("RECEBIMENTO REDE VISA", 90, 570), t("REDECARD INSTITUICAO DE", 227, 570),
  t("04/11/2026", 35, 564), t("01.425.787/0001-04", 363, 564), t("66,31", 490, 564),
  t("CD0000000001", 90, 558), t("PAGAMENTO S.A.", 227, 558),
  t("03/11/2026", 35, 545), t("PIX RECEBIDO CLIENTE", 90, 545), t("CLIENTE BOM LTDA", 227, 545), t("22.222.222/0001-22", 363, 545), t("5.973,69", 480, 545),
  t("02/11/2026", 35, 532), t("SALDO ANTERIOR", 90, 532), t("0,00", 527, 532),
];

test("reads the Itaú PDF layout: header, two-line cells, signed amounts, balance check", () => {
  const s = parseItauStatementItems([page]);
  assert.equal(s.agency, "1234");
  assert.equal(s.account, "0012345-6");
  assert.equal(s.from, "2026-11-01");
  assert.equal(s.closingBalance, 1000);
  assert.equal(s.openingBalance, 0);
  assert.deepEqual(s.lines.map((l) => [l.date, l.amount]), [["2026-11-03", 5973.69], ["2026-11-04", 66.31], ["2026-11-05", -600], ["2026-11-05", -4440]]);
  const rede = s.lines.find((l) => l.amount === 66.31)!;
  assert.equal(rede.description, "RECEBIMENTO REDE VISA CD0000000001");
  assert.equal(rede.counterparty, "REDECARD INSTITUICAO DE PAGAMENTO S.A.");
  assert.equal(rede.taxId, "01425787000104");
  assert.deepEqual(balanceCheck(s), { inflow: 6040, outflow: 5040, computed: 1000, ok: true, difference: 0 });
});

test("ids are stable and repeated identical lines stay distinct", () => {
  const line = { date: "2026-11-23", description: "PIX", counterparty: "X", taxId: "1", amount: 10 };
  const a = withStableIds([line, line]);
  const b = withStableIds([line, line]);
  assert.notEqual(a[0]!.externalId, a[1]!.externalId);
  assert.deepEqual(a.map((l) => l.externalId), b.map((l) => l.externalId));
});

test("OFX lines are read with their FITID", () => {
  const ofx = "OFXHEADER:100<OFX><BANKACCTFROM><BRANCHID>1234<ACCTID>12345<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261125120000<TRNAMT>-120.00<FITID>ABC1<MEMO>BOLETO PAGO LWSA</STMTTRN><LEDGERBAL><BALAMT>1000.00</LEDGERBAL></OFX>";
  const s = parseOfx(ofx);
  assert.equal(s.lines[0]!.externalId, "ofx-ABC1");
  assert.equal(s.lines[0]!.amount, -120);
  assert.equal(s.closingBalance, 1000);
});

const L = (id: string, date: string, amount: number, counterparty: string, taxId: string, description = amount > 0 ? "PIX RECEBIDO" : "PIX ENVIADO") =>
  ({ externalId: id, date, amount, counterparty, taxId, description });

test("plans typical cases: recorded receipts, Café Sul + frete, old purchase, broker commission, expenses, income", () => {
  const lines = [
    L("signa", "2026-11-23", 747.5, "CLIENTE BOM LTDA", "99999999000199"),
    L("bela1", "2026-11-25", -4440, "CAFE SUL COMERCIO LTDA", "33333333000133"),
    L("bela2", "2026-11-25", -600, "CAFE SUL COMERCIO LTDA", "33333333000133"),
    L("capal", "2026-11-12", -5400, "COOPERATIVA MODELO", "44444444000144"),
    L("gustavo", "2026-11-10", -144, "CORRETOR EXEMPLO", "11122233344"),
    L("aluguel", "2026-11-16", -7991.13, "IMOBILIARIA EXEMPLO IMOVEIS", "55555555000155", "PAGAMENTOS"),
    L("mamba", "2026-11-04", -4400, "MAMBA CONSULTORIA LTDA", "66666666000166"),
    L("socio", "2026-11-16", 4000, "MARIA SOCIA EXEMPLO", "22233344455"),
    L("bispo", "2026-11-11", 1200, "EMPRESA PROPRIA LTDA", "77777777000177"),
    L("golden", "2026-10-29", 6644.94, "CLIENTE EXTERIOR LTD", "88888888000188"),
  ];
  const plans = planStatement(lines, {
    payments: [{ id: "p1", direction: "IN", amount: 747.5, date: "2026-11-23", name: "Outro Pagador" }],
    payables: [
      { id: "cp5", label: "CP-2026-000099 · parcela 1", amount: 5000, dueDate: "2026-11-26", taxId: "33333333000133", name: "Café Sul", commission: false },
      { id: "c6", label: "B-2026-000097 · comissão", amount: 148, dueDate: "2026-10-13", taxId: "11122233344", name: "Corretor Exemplo", commission: true },
      { id: "c11", label: "B-2026-000096 · comissão", amount: 16, dueDate: "2026-10-26", taxId: "11122233344", name: "Corretor Exemplo", commission: true },
    ],
    installments: [{ id: "i3", label: "CP-2026-000098 · parcela 1", amount: 5400, taxId: "44444444000144", name: "Cooperativa Modelo" }],
    companyTaxId: "77777777000177",
    ownerNames: ["Maria Exemplo"],
    learned: new Map([["OUT:66666666000166", "Marketing / consultoria"]]),
  });
  const by = Object.fromEntries(plans.map((p) => [p.line.externalId, p]));
  assert.equal(by.signa!.group, "ALREADY");
  assert.equal(by.signa!.matchedPayment!.differentPayer, true);
  assert.equal(by.bela1!.group, "SETTLE");
  assert.equal(by.bela1!.settlement, by.bela2!.settlement);
  assert.deepEqual(by.bela1!.settlement!.allocations.map((a) => [a.id, a.amount]), [["cp5", 5000]]);
  assert.equal(by.bela1!.settlement!.extra, 40);
  assert.equal(by.bela1!.settlement!.extraCategory, "Frete / logística");
  assert.deepEqual(by.capal!.settlement!.allocations.map((a) => [a.kind, a.id]), [["INSTALLMENT", "i3"]]);
  assert.deepEqual(by.gustavo!.settlement!.allocations.map((a) => [a.id, a.amount]), [["c6", 144]]);
  assert.equal(by.aluguel!.suggestion!.category, "Aluguel");
  assert.deepEqual(by.mamba!.suggestion, { category: "Marketing / consultoria", sure: true, note: "como da última vez" });
  assert.equal(by.socio!.suggestion!.category, "Aporte do sócio");
  assert.equal(by.bispo!.suggestion!.category, "Transferência entre contas");
  assert.equal(by.golden!.suggestion!.sure, false);
});

test("category hints for common Brazilian billers", () => {
  const out = (counterparty: string, description = "PAGAMENTOS") => suggestExpense({ externalId: "x", date: "2026-11-06", amount: -1, counterparty, taxId: "", description }).category;
  assert.equal(out("SANEPAR"), "Água");
  assert.equal(out("COPEL-DIS"), "Energia elétrica");
  assert.equal(out("TELEFONICA-GVT"), "Internet / telefonia");
  assert.equal(out("", "SEGURO ITAUEMPRESA 03/11"), "Seguros");
  assert.equal(out("ITAU UNIBANCO S A", "TAR PIXQR LIQ MAQUININHA"), "Tarifas bancárias");
  assert.equal(suggestIncome({ externalId: "x", date: "", amount: 1, counterparty: "", taxId: "", description: "RENDIMENTOS REND PAGO APLIC AUT MAIS" }, { companyTaxId: "", ownerNames: [] }).category, "Rendimentos");
});
