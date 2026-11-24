import assert from "node:assert/strict";
import test from "node:test";
import { deflateRawSync } from "node:zlib";
import {
  inferSegment,
  mapProspectSheet,
  parseKg,
  parseMachine,
  parsePotential,
  parseProspectPatch,
  prospectImportKey,
  splitAddress,
} from "./prospect-input";
import { readXlsxRows, xlsxSheetNames } from "./xlsx-reader";

test("café list: segments, address split, phone and default stage", () => {
  const { prospects, skipped } = mapProspectSheet([
    ["Cidade", "Estabelecimento", "Endereço", "Bairro", "Telefone", "Perfil / região", "Máquina espresso?", "Fornecedor atual", "Consumo (kg/mês)", "Prioridade", "Status do contato", "Último contato", "Próxima ação", "Observações"],
    ["Londrina", "Pane Puro", "R. Foz do Iguaçu, 90", "Bancários", "(43) 98827-3546", "Bairro", "Não verificado", "", "", "A avaliar", "Não contatado", "", "", "Confirmar telefone"],
    ["Cambé", "Pão Pérola Fórum", "Av. Roberto Conceição, 456", "Jardim São José", "(43) 3154-4030", "Bairro", "Não verificado", "", "", "A avaliar", "Não contatado", "", "", ""],
    ["Cambé", "Docce Donut", "R. Planalto, 13", "Não informado", "", "", "", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    ["lixo sem nome", "", "x", "", "", "", "", "", "", "", "", "", "", ""],
  ]);
  assert.equal(prospects.length, 3);
  assert.equal(skipped, 1);
  const [pane, pao, donut] = prospects;
  assert.equal(pane?.segment, "CAFETERIA");
  assert.equal(pane?.address, "R. Foz do Iguaçu");
  assert.equal(pane?.addressNumber, "90");
  assert.equal(pane?.phone, "43988273546");
  assert.equal(pane?.state, "PR");
  assert.equal(pane?.stage, "NAO_CONTATADO");
  assert.equal(pane?.potential, "A_VERIFICAR");
  assert.equal(pao?.segment, "PADARIA_CONFEITARIA");
  assert.equal(donut?.segment, "PADARIA_CONFEITARIA");
  assert.equal(donut?.district, null);
  assert.equal(donut?.phone, null);
});

test("gas-station list maps potential, hours and buyer", () => {
  const { prospects } = mapProspectSheet([
    ["Cidade", "Posto / estabelecimento", "Endereço informado", "Telefone", "Estrutura da conveniência", "Situação do horário", "Potencial comercial", "Bairro", "Responsável pelas compras", "Máquina de café", "Fornecedor atual", "Consumo mensal (kg)", "Data da visita", "Status da prospecção", "Observações"],
    ["Cambé", "Posto Trevo", "Rodovia Celso Garcia Cid, km 83", "(43) 3251-1659", "Padaria, confeitaria e conveniência", "Conveniência 24h indicada", "Muito alta", "", "Sr. Paulo", "Sim — Nespresso", "Café X", "12,5", "", "Contatado", ""],
    ["Londrina", "Posto (nome a confirmar) — Rio Branco", "Av. Rio Branco (número a confirmar)", "(43) 3382-0500", "Conveniência", "Posto 24h indicado", "Média/alta", "", "", "", "", "", "", "Não contatado", ""],
  ]);
  const [trevo, rio] = prospects;
  assert.equal(trevo?.segment, "POSTO_CONVENIENCIA");
  assert.equal(trevo?.potential, "MUITO_ALTA");
  assert.equal(trevo?.openingHours, "Conveniência 24h indicada");
  assert.equal(trevo?.contactName, "Sr. Paulo");
  assert.equal(trevo?.espressoMachine, "SIM");
  assert.equal(trevo?.machineNotes, "Nespresso");
  assert.equal(trevo?.monthlyVolumeKg, 12.5);
  assert.equal(trevo?.stage, "CONTATADO");
  assert.equal(trevo?.addressNumber, null);
  assert.equal(rio?.potential, "ALTA");
  assert.equal(rio?.address, "Av. Rio Branco (número a confirmar)");
});

test("unified sheet keeps explicit segment and drops duplicates", () => {
  const header = ["Segmento", "Cidade", "Estabelecimento", "Endereço", "Potencial", "Status"];
  const { prospects, duplicates } = mapProspectSheet([
    header,
    ["Empresa / escritório", "Londrina (confirmar)", "Laboratório Sabin", "", "Muito alta", "Contatado"],
    ["Cafeteria", "Londrina", "Laboratorio  Sabin", "", "", ""],
  ]);
  assert.equal(prospects.length, 1);
  assert.equal(duplicates, 1);
  assert.equal(prospects[0]?.segment, "EMPRESA");
  assert.equal(prospects[0]?.city, "Londrina");
  assert.equal(prospects[0]?.importKey, prospectImportKey("Laboratório Sabin", "Londrina"));
});

test("small parsers", () => {
  assert.equal(parsePotential("Média"), "MEDIA");
  assert.equal(parsePotential("qualquer"), "A_VERIFICAR");
  assert.equal(parseKg("28 kg"), 28);
  assert.equal(parseKg("1.200,5"), 1200.5);
  assert.equal(parseKg("-3"), null);
  assert.deepEqual(parseMachine("Não"), { machine: "NAO", notes: null });
  assert.deepEqual(splitAddress("Av. Inglaterra, 81, sala A"), { address: "Av. Inglaterra (sala A)", addressNumber: "81" });
  assert.equal(inferSegment("Hotel Fazenda Boa Vista"), "HOTEL");
  assert.equal(inferSegment("Coffee Mood"), "CAFETERIA");
});

test("visit confirmation patch validates CNPJ, kg and coordinates", () => {
  const patch = parseProspectPatch({ taxId: "13.008.726/0001-12", monthlyVolumeKg: "8,5", stage: "DEGUSTACAO", phone: "(43) 99999-0000" });
  assert.equal(patch.taxId, "13008726000112");
  assert.equal(patch.monthlyVolumeKg, 8.5);
  assert.equal(patch.phone, "43999990000");
  assert.throws(() => parseProspectPatch({ taxId: "123" }), /CNPJ inválido/);
  assert.throws(() => parseProspectPatch({ monthlyVolumeKg: "muito" }), /Volume/);
  assert.throws(() => parseProspectPatch({ stage: "GANHO" }), /Etapa/);
  assert.throws(() => parseProspectPatch({ latitude: 200, longitude: 0 }), /Coordenadas/);
  assert.deepEqual(Object.keys(parseProspectPatch({ hacker: "x", "name\"=1;--": "y" })), []);
});

// ---- xlsx: build a tiny workbook in memory (one stored, one deflated entry).
function zip(entries: Array<{ name: string; data: string; deflate?: boolean }>) {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const raw = Buffer.from(entry.data, "utf8");
    const body = entry.deflate ? deflateRawSync(raw) : raw;
    const name = Buffer.from(entry.name, "utf8");
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(entry.deflate ? 8 : 0, 8);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(entry.deflate ? 8 : 0, 10);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, name, body);
    centrals.push(central, name);
    offset += local.length + name.length + body.length;
  }
  const centralBuffer = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuffer.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBuffer, end]);
}

test("xlsx reader handles shared, inline, numeric and sparse cells", () => {
  const book = zip([
    { name: "xl/workbook.xml", data: '<workbook><sheets><sheet name="Resumo" r:id="rId2"/><sheet name="Contatos &amp; leads" r:id="rId1"/></sheets></workbook>' },
    { name: "xl/_rels/workbook.xml.rels", data: '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="worksheets/sheet2.xml"/></Relationships>' },
    { name: "xl/sharedStrings.xml", data: "<sst><si><t>Cidade</t></si><si><r><t>Caf</t></r><r><t>é &amp; Cia</t></r></si></sst>", deflate: true },
    { name: "xl/worksheets/sheet1.xml", data: '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="inlineStr"><is><t>Kg</t></is></c></row><row r="2"><c r="A2" t="s"><v>1</v></c><c r="C2"><v>12.5</v></c></row></sheetData></worksheet>', deflate: true },
    { name: "xl/worksheets/sheet2.xml", data: '<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>outra</t></is></c></row></sheetData></worksheet>' },
  ]);
  assert.deepEqual(xlsxSheetNames(book), ["Resumo", "Contatos & leads"]);
  assert.deepEqual(readXlsxRows(book, "Contatos & leads"), [["Cidade", "", "Kg"], ["Café & Cia", "", "12.5"]]);
  assert.deepEqual(readXlsxRows(book), [["outra"]]);
  assert.throws(() => readXlsxRows(Buffer.from("not a zip")), /inválido/);
});
