import assert from "node:assert/strict";
import test from "node:test";
import { buildSellerBi, buildSellerHome, whatsappNumber, type HomeOrder } from "./seller-home";

// Sábado, 28/11/2026, 14h em São Paulo.
const now = new Date("2026-11-28T17:00:00Z");
const d = (iso: string) => new Date(`${iso}T15:00:00Z`);
const order = (id: string, customerId: string, total: number, date: string, status = "DELIVERED", expected: string | null = null): HomeOrder => ({
  id, number: `B-${id}`, customerId, customerName: `Cliente ${customerId}`, status, total, orderDate: d(date), expectedDeliveryDate: expected ? d(expected) : null,
});
const customers = [
  { id: "a", name: "Cliente a", city: "Londrina", phone: "(43) 99999-0001" },
  { id: "b", name: "Cliente b", city: "Cambé", phone: "5543999990002" },
  { id: "c", name: "Cliente c", city: "Rolândia", phone: null },
];
const orders = [
  order("1", "a", 200, "2026-11-03"),
  order("2", "b", 3000, "2026-11-11"),
  order("3", "a", 2700, "2026-11-18"),
  order("4", "b", 4500, "2026-11-23"),
  order("5", "a", 300, "2026-11-27", "READY_TO_SHIP", "2026-11-27"),
  order("6", "b", 900, "2026-11-27", "CONFIRMED", "2026-11-30"),
  order("7", "c", 999, "2026-11-20", "CANCELLED"),
];
const items = [
  { orderId: "2", productName: "Tradicional 1 kg", amount: 3000, kg: 50 },
  { orderId: "4", productName: "Tradicional 1 kg", amount: 2500, kg: 40 },
  { orderId: "4", productName: "Espresso 500 g", amount: 2000, kg: 30 },
  { orderId: "3", productName: "Espresso 500 g", amount: 2700, kg: 40 },
];

test("WhatsApp: só dígitos, com 55; vazio quando não dá para usar", () => {
  assert.equal(whatsappNumber("(43) 99999-0001"), "5543999990001");
  assert.equal(whatsappNumber("+55 43 99999-0002"), "5543999990002");
  assert.equal(whatsappNumber("1234"), "");
  assert.equal(whatsappNumber(null), "");
});

test("Hoje: semanas de segunda a domingo, mês, ticket, projeção e cancelados fora", () => {
  const home = buildSellerHome({ orders, items, receivables: [], customers, visitsThisMonth: 0, now });
  assert.deepEqual(home.weeks.map((w) => [w.start, w.revenue]), [["02/11", 200], ["09/11", 3000], ["16/11", 2700], ["23/11", 5700]]);
  assert.equal(home.weekDeltaPct, 111); // 5700 vs 2700
  assert.equal(home.month.revenue, 11600);
  assert.equal(home.month.orders, 6);
  assert.equal(home.month.ticket, 1933);
  assert.equal(home.month.kg, 160);
  assert.equal(home.month.activeCustomers, 2);
  assert.equal(home.month.portfolio, 3);
  assert.equal(home.month.daysLeft, 2);
  assert.equal(home.month.projection, Math.round((11600 / 28) * 30));
  assert.equal(home.streak, 4);
  assert.equal(home.products[0]?.name, "Tradicional 1 kg");
  assert.equal(home.products[0]?.share, 47);
});

test("Precisa de você: entrega atrasada primeiro, depois vencimentos, com o WhatsApp do cliente", () => {
  const receivables = [
    { orderId: "3", customerId: "a", amount: 720, dueDate: d("2026-11-30"), status: "OPEN" },
    { orderId: "2", customerId: "b", amount: 1000, dueDate: d("2026-12-20"), status: "OPEN" },
    { orderId: "1", customerId: "a", amount: 200, dueDate: d("2026-11-20"), status: "PAID" },
  ];
  const home = buildSellerHome({ orders, items, receivables, customers, visitsThisMonth: 2, now });
  assert.deepEqual(home.needs.map((n) => [n.kind, n.orderNumber]), [["DELIVERY_LATE", "B-5"], ["DUE_SOON", "B-3"], ["DELIVERY_SOON", "B-6"]]);
  assert.equal(home.needs[0]?.daysLate, 1);
  assert.equal(home.needs[0]?.phone, "5543999990001");
  assert.equal(home.receivable.open, 1720);
  assert.equal(home.receivable.next7, 720);
  assert.match(home.insights.map((i) => i.text).join(" "), /registradas no mês/);
});

test("Minha BI: concentração, tempo por cliente e R$ por hora", () => {
  const days = [{
    stops: [{ minutes: 40, place: { id: "b", kind: "CUSTOMER" } }, { minutes: 20, place: { id: "a", kind: "CUSTOMER" } }, { minutes: 15, place: null }],
    customerMinutes: 60, drivingMinutes: 90, stoppedMinutes: 15, pauseMinutes: 30, totalMinutes: 195, km: 84.2,
  }];
  const bi = buildSellerBi({ orders, items, receivables: [], customers, days, from: new Date("2026-11-01T03:00:00Z"), now });
  assert.equal(bi.customers[0]?.id, "b");
  assert.equal(bi.customers[0]?.share, 72); // 8400 / 11600
  assert.equal(bi.customers[0]?.minutes, 40);
  assert.equal(bi.customers[0]?.perHour, 12600);
  assert.equal(bi.customers[2]?.revenue, 0); // cancelado não conta
  assert.equal(bi.time?.customer, 60);
  assert.equal(bi.time?.km, 84.2);
  assert.match(bi.reading, /72% da sua venda vem de um cliente só/);
});

test("Minha BI sem dias em campo: tempo fica vazio, sem inventar", () => {
  const bi = buildSellerBi({ orders, items, receivables: [], customers, days: [], from: new Date("2026-11-01T03:00:00Z"), now });
  assert.equal(bi.time, null);
  assert.equal(bi.customers[0]?.minutes, null);
  assert.equal(bi.customers[0]?.perHour, null);
});
