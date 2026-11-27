import assert from "node:assert/strict";
import test from "node:test";
import {
  assertDirectShipmentFile,
  directShipmentDocumentKind,
  directShipmentEmailTarget,
  directShipmentTrackingUrl,
  partnerFromAddress,
  renderDirectShipmentEmail,
  safeFileName,
  validateDirectShipment,
} from "./direct-shipment";

const base = {
  recipientName: "Escritório Exemplo Ltda",
  recipientTaxId: "11.222.333/0001-81",
  recipientEmail: "Compras@Exemplo.com.br",
  postalCode: "01310-100",
  street: "Avenida Exemplo",
  number: "100",
  complement: "Sala 12",
  city: "São Paulo",
  state: "sp",
  carrier: "LATAM Cargo",
  trackingCode: " 12345678901 ",
  volumes: "2",
  weightKg: "34,5",
};

test("normaliza a ficha do envio direto", () => {
  const data = validateDirectShipment(base);
  assert.equal(data.postalCode, "01310100");
  assert.equal(data.state, "SP");
  assert.equal(data.trackingCode, "12345678901");
  assert.equal(data.recipientEmail, "compras@exemplo.com.br");
  assert.equal(data.recipientTaxId, "11222333000181");
  assert.equal(data.volumes, 2);
  assert.equal(data.weightKg, 34.5);
  assert.equal(data.notifyEndCustomer, false);
});

test("recusa ficha incompleta com mensagem clara", () => {
  assert.throws(() => validateDirectShipment({ ...base, postalCode: "123" }), /CEP/);
  assert.throws(() => validateDirectShipment({ ...base, state: "XX" }), /UF/);
  assert.throws(() => validateDirectShipment({ ...base, trackingCode: "" }), /rastreio/);
  assert.throws(() => validateDirectShipment({ ...base, carrier: " " }), /transportadora/);
  assert.throws(() => validateDirectShipment({ ...base, volumes: 0 }), /Volumes/);
  assert.throws(() => validateDirectShipment({ ...base, trackingUrl: "http://x.com" }), /https/);
});

test("avisar o cliente exige o e-mail dele", () => {
  assert.throws(
    () => validateDirectShipment({ ...base, recipientEmail: "", notifyEndCustomer: true }),
    /e-mail/,
  );
  assert.equal(validateDirectShipment({ ...base, notifyEndCustomer: true }).notifyEndCustomer, true);
});

test("link de rastreio: informado, Correios ou Melhor Rastreio", () => {
  assert.equal(directShipmentTrackingUrl("X", "https://exemplo.com/r/1"), "https://exemplo.com/r/1");
  assert.match(directShipmentTrackingUrl("AB123456789BR"), /correios\.com\.br.*AB123456789BR/);
  assert.equal(directShipmentTrackingUrl("12345678901"), "https://melhorrastreio.com.br/rastreio/12345678901");
});

test("aviso em teste vai para quem postou; em produção, para o cliente", () => {
  assert.deepEqual(
    directShipmentEmailTarget({ live: false, recipientEmail: "cliente@exemplo.com", testEmail: "equipe@exemplo.com" }),
    { to: "equipe@exemplo.com", test: true },
  );
  assert.deepEqual(
    directShipmentEmailTarget({ live: true, recipientEmail: "cliente@exemplo.com", testEmail: "equipe@exemplo.com" }),
    { to: "cliente@exemplo.com", test: false },
  );
  assert.equal(directShipmentEmailTarget({ live: false, recipientEmail: "c@e.com", testEmail: null }), null);
});

test("remetente usa o nome do parceiro e o endereço verificado", () => {
  assert.equal(
    partnerFromAddress("Parceiro Exemplo", "Loja <envios@exemplo.com>"),
    '"Parceiro Exemplo" <envios@exemplo.com>',
  );
  assert.equal(partnerFromAddress('Má"<x>', "envios@exemplo.com"), '"Máx" <envios@exemplo.com>');
});

test("e-mail em nome do parceiro não menciona a Bispo", () => {
  const email = renderDirectShipmentEmail({
    partnerName: "Parceiro Exemplo",
    recipientName: "Ana Exemplo",
    carrier: "LATAM Cargo",
    trackingCode: "12345678901",
    trackingUrl: "https://melhorrastreio.com.br/rastreio/12345678901",
    volumes: 2,
    city: "São Paulo",
    state: "SP",
    postedAt: "2026-11-27T15:00:00Z",
  });
  assert.equal(email.subject, "Seu pedido Parceiro Exemplo está a caminho");
  assert.match(email.html, /Olá, Ana!/);
  assert.match(email.html, /2 volumes/);
  assert.doesNotMatch(email.html, /bispo/i);
  const test = renderDirectShipmentEmail({
    partnerName: "P",
    recipientName: "A",
    carrier: "C",
    trackingCode: "1",
    trackingUrl: "https://x",
    volumes: null,
    city: "X",
    state: "SP",
    postedAt: "2026-11-27T15:00:00Z",
    test: true,
    intendedRecipient: "cliente@exemplo.com",
  });
  assert.match(test.subject, /^\[TESTE\]/);
  assert.match(test.html, /cliente@exemplo\.com/);
});

test("documentos: tipo, formato e nome seguro", () => {
  assert.equal(directShipmentDocumentKind("label"), "LABEL");
  assert.throws(() => directShipmentDocumentKind("foto"), /tipo/);
  assert.doesNotThrow(() => assertDirectShipmentFile({ mimetype: "application/pdf", buffer: Buffer.from("%PDF-1.7 x") }));
  assert.throws(() => assertDirectShipmentFile({ mimetype: "application/pdf", buffer: Buffer.from("nada") }), /PDF/);
  assert.throws(() => assertDirectShipmentFile({ mimetype: "text/plain", buffer: Buffer.from("x") }), /PDF, PNG/);
  assert.throws(() => assertDirectShipmentFile(undefined), /Selecione/);
  assert.equal(safeFileName("Etiqueta São Paulo (1).pdf"), "Etiqueta-Sao-Paulo-1-.pdf");
});
