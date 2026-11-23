import assert from "node:assert/strict";
import test from "node:test";
import { buildBillingPix, pixCrc16 } from "./billing-pix";
import { buildPartnerPixView, formatCnpj } from "./partner-pix";

test("Pix estático da Bispo: valor do saldo, chave CNPJ, CRC válido e QR em SVG", async () => {
  const pix = buildBillingPix(253000, "ar-1");
  const view = await buildPartnerPixView({
    order: { orderNumber: "P-2026-000002" },
    receivable: { dueDate: new Date("2026-12-07T00:00:00Z") },
    amountCents: 253000,
    openCents: 253000,
    pix,
  });
  assert.equal(view.orderCode, "P-2026-000002");
  assert.equal(view.pixKey, "13.008.726/0001-12");
  assert.equal(view.dueDate, "2026-12-07");
  assert.ok(view.copyPaste.includes("54072530.00"), "campo 54 com o saldo");
  assert.equal(view.copyPaste.slice(-4), pixCrc16(view.copyPaste.slice(0, -4)));
  assert.match(view.qrSvg, /^<svg[\s\S]*<\/svg>\s*$/);
  assert.doesNotMatch(view.qrSvg, /<script/i);
});

test("formata CNPJ", () => {
  assert.equal(formatCnpj("13008726000112"), "13.008.726/0001-12");
});
