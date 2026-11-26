import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  beneficiaryAccount,
  boletoMode,
  digitableLine,
  dueFactor,
  formatDigitableLine,
  itauBarcode,
  itauBoletoPayload,
  mod10,
  mod11Barcode,
  payerProblems,
  readItauBoleto,
} from "./boleto-itau";

test("check digits follow the Itaú manual example (agência 0057, conta 12345, carteira 110)", () => {
  assert.equal(mod10("005712345"), 7);
  assert.equal(mod10("00571234511012345678"), 8);
});

test("due factor: FEBRABAN base and the 2025 restart at 1000", () => {
  assert.equal(dueFactor(new Date("2000-07-03T12:00:00Z")), 1000);
  assert.equal(dueFactor(new Date("2025-02-21T12:00:00Z")), 9999);
  assert.equal(dueFactor(new Date("2025-02-22T12:00:00Z")), 1000);
  assert.equal(dueFactor(new Date("2026-12-10T12:00:00Z")), 1000 + 656);
});

test("barcode and digitable line are consistent and self-checking", () => {
  const { barcode, ourNumber } = itauBarcode({ agency: "0057", account: "12345", wallet: "109", ourNumber: "1", due: new Date("2026-12-10T12:00:00Z"), amountCents: 295000 });
  assert.equal(ourNumber, "00000001");
  assert.match(barcode, /^3419\d{40}$/);
  assert.equal(barcode.slice(5, 9), "1656");
  assert.equal(barcode.slice(9, 19), "0000295000");
  assert.equal(Number(barcode[4]), mod11Barcode(barcode.slice(0, 4) + barcode.slice(5)));
  const line = digitableLine(barcode);
  assert.equal(line.length, 47);
  for (const [start, end] of [[0, 9], [10, 20], [21, 31]] as const)
    assert.equal(Number(line[end]), mod10(line.slice(start, end)));
  assert.equal(line.slice(33), barcode.slice(5, 19));
  assert.match(formatDigitableLine(line), /^\d{5}\.\d{5} \d{5}\.\d{6} \d{5}\.\d{6} \d \d{14}$/);
  assert.throws(() => itauBarcode({ agency: "0057", account: "12345", wallet: "109", ourNumber: "1", due: new Date(), amountCents: 0 }));
});

test("mode defaults to test; nothing reaches the bank unless switched on", () => {
  assert.equal(boletoMode({}), "teste");
  assert.equal(boletoMode({ ITAU_BOLETO_MODE: "sandbox" }), "sandbox");
  assert.equal(boletoMode({ ITAU_BOLETO_MODE: "producao" }), "producao");
  assert.equal(boletoMode({ ITAU_BOLETO_MODE: "qualquer" }), "teste");
  assert.deepEqual(beneficiaryAccount({ ITAU_AGENCIA: "57", ITAU_CONTA: "12345-7" }), { agency: "0057", account: "23457", wallet: "109" });
});

test("payer must have document and full address", () => {
  assert.deepEqual(payerProblems({ name: "Café X", taxId: "12.345.678/0001-90", address: "Rua A", city: "Londrina", state: "PR", zipCode: "86000-000" }), []);
  assert.deepEqual(payerProblems({ name: "Café X", taxId: "", address: "", city: "Londrina", state: "Paraná", zipCode: "" }), ["CPF ou CNPJ do cliente", "endereço", "estado (UF)", "CEP"]);
});

test("Itaú payload and response", () => {
  const body = itauBoletoPayload({
    mode: "sandbox", agency: "0057", account: "12345", wallet: "109", ourNumber: "12", yourNumber: "PV-000123",
    issueDate: new Date("2026-11-27T12:00:00Z"), due: new Date("2026-12-10T12:00:00Z"), amountCents: 295000,
    payer: { name: "Café X Ltda", taxId: "12.345.678/0001-90", address: "Rua A", addressNumber: "10", district: "Centro", city: "Londrina", state: "pr", zipCode: "86000-000" },
    pixKey: "13008726000112",
  });
  assert.equal(body.etapa_processo_boleto, "validacao");
  assert.equal(body.beneficiario.id_beneficiario, "000057123457");
  assert.equal(body.dado_boleto.valor_total_titulo, "00000000000295000");
  assert.equal(body.dado_boleto.pagador.pessoa.tipo_pessoa.codigo_tipo_pessoa, "J");
  assert.equal(body.dado_boleto.pagador.endereco.sigla_UF, "PR");
  assert.equal(body.dado_boleto.dados_individuais_boleto[0]!.numero_nosso_numero, "00000012");
  assert.equal(body.dado_boleto.dados_individuais_boleto[0]!.data_vencimento, "2026-12-10");
  const { barcode } = itauBarcode({ agency: "0057", account: "12345", wallet: "109", ourNumber: "12", due: new Date("2026-12-10T12:00:00Z"), amountCents: 295000 });
  const read = readItauBoleto({ data: { dado_boleto: { dados_individuais_boleto: [{ codigo_barras: barcode }] }, dados_qrcode: { emv: "000201..." } } });
  assert.equal(read.digitableLine, digitableLine(barcode));
  assert.equal(read.pixCopyPaste, "000201...");
  assert.throws(() => readItauBoleto({ data: {} }));
});

test("boleto endpoints: policy, test mode never settles a receivable, lock column readable", () => {
  const controller = readFileSync(join(__dirname, "receivable-boleto.controller.ts"), "utf8");
  const guard = readFileSync(join(__dirname, "role-access.guard.ts"), "utf8");
  assert.match(guard, /ReceivableBoletoController: ACCOUNTING_WRITE/);
  assert.doesNotMatch(controller, /accountsReceivable\.update|payment\.create|finance\.receive/);
  assert.match(controller, /pg_advisory_xact_lock\(hashtext\(\$1\)\) IS NULL AS locked/);
  const migration = readFileSync(join(__dirname, "../../../packages/database/prisma/migrations/20261127090000_receivable_boleto/migration.sql"), "utf8");
  assert.doesNotMatch(migration, /^\s*(ALTER|DROP|DELETE|UPDATE|TRUNCATE)\b/im);
});
