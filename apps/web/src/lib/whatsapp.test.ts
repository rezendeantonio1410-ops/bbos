import test from "node:test";
import assert from "node:assert/strict";
import { friendlyDate, whatsMessage, whatsNumber, whatsUrl } from "./whatsapp";

const sat = new Date("2026-11-28T17:00:00Z"); // sábado, 14h em São Paulo

test("datas amigáveis: hoje, amanhã e dia da semana", () => {
  assert.equal(friendlyDate("2026-11-28", sat), "hoje");
  assert.equal(friendlyDate("2026-11-29", sat), "amanhã");
  assert.equal(friendlyDate("2026-11-27", sat), "ontem");
  assert.equal(friendlyDate("2026-11-30", sat), "segunda, 30/11");
});

test("lembrete de vencimento com pedido, valor e data reais", () => {
  const text = whatsMessage("DUE_SOON", { seller: "Maikon", orderNumber: "B-2026-000027", amount: 720, date: "2026-11-30" }, sat);
  assert.equal(text, "Olá! Aqui é o Maikon, da Bispo Coffees. Passando para lembrar que o pagamento do pedido B-2026-000027, de R$ 720,00, vence na segunda, 30/11. Qualquer dúvida, estou à disposição!");
});

test("pedido atrasado e reposição", () => {
  assert.match(whatsMessage("DELIVERY_LATE", { seller: "Maikon", orderNumber: "B-2026-000037" }, sat), /Seu pedido B-2026-000037 já está pronto e sai para entrega/);
  assert.equal(whatsMessage("RESTOCK", { seller: "Maikon" }, sat), "Olá! Aqui é o Maikon, da Bispo Coffees. Quer que eu já separe a reposição do seu café desta semana?");
  assert.equal(whatsMessage("FREE", { seller: "Maikon" }, sat), "");
});

test("número e link do WhatsApp", () => {
  assert.equal(whatsNumber("(43) 99999-0001"), "5543999990001");
  assert.equal(whatsNumber("123"), "");
  assert.equal(whatsUrl("43999990001", "Oi tudo bem?"), "https://wa.me/5543999990001?text=Oi%20tudo%20bem%3F");
  assert.equal(whatsUrl("43999990001", ""), "https://wa.me/5543999990001");
  assert.equal(whatsUrl("", "x"), "");
});
