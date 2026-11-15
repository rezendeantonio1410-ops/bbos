import assert from "node:assert/strict";
import test from "node:test";
import { parseInboundNfe } from "./nfe-inbound";

const key = "41260912345678000123550010000001231000001234";
const xml = `<?xml version="1.0"?><nfeProc versao="4.00"><NFe><infNFe Id="NFe${key}" versao="4.00"><ide><natOp>Venda de café</natOp><serie>1</serie><nNF>123</nNF><dhEmi>2026-09-23T10:00:00-03:00</dhEmi></ide><emit><CNPJ>12345678000123</CNPJ><xNome>Cooperativa Café</xNome></emit><dest><CNPJ>98765432000199</CNPJ></dest><det nItem="1"><prod><cProd>CAFE-01</cProd><xProd>Café verde arábica</xProd><NCM>09011110</NCM><CFOP>5101</CFOP><uCom>KG</uCom><qCom>1000.0000</qCom><vUnCom>35.500000</vUnCom><vProd>35500.00</vProd></prod><imposto><ICMS><ICMS00><orig>0</orig><CST>00</CST><vBC>35500.00</vBC><pICMS>12.00</pICMS><vICMS>4260.00</vICMS></ICMS00></ICMS></imposto></det><total><ICMSTot><vProd>35500.00</vProd><vFrete>800.00</vFrete><vDesc>0.00</vDesc><vNF>36300.00</vNF></ICMSTot></total><cobr><dup><nDup>001</nDup><dVenc>2026-10-23</dVenc><vDup>36300.00</vDup></dup></cobr></infNFe></NFe><protNFe><infProt><chNFe>${key}</chNFe><nProt>141260000000001</nProt><cStat>100</cStat><xMotivo>Autorizado o uso da NF-e</xMotivo></infProt></protNFe></nfeProc>`;

test("parses an authorized inbound NFe", () => {
  const parsed = parseInboundNfe(xml);
  assert.equal(parsed.accessKey, key);
  assert.equal(parsed.number, "123");
  assert.equal(parsed.totalAmount, 36300);
  assert.equal(parsed.items[0]?.quantity, 1000);
  assert.equal(parsed.items[0]?.taxSnapshot.vICMS, "4260.00");
  assert.equal(parsed.payments[0]?.dueDate, "2026-10-23");
});

test("rejects XML without SEFAZ authorization", () => {
  assert.throws(() => parseInboundNfe(xml.replace("<cStat>100</cStat>", "<cStat>302</cStat>")), /não está autorizada/);
});

test("rejects external entities", () => {
  assert.throws(() => parseInboundNfe(`<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>${xml}`), /não permitida/);
});
