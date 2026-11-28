import test from "node:test";
import assert from "node:assert/strict";
import { founderPhotos, goalProgress, groupBars, journeyStations, monthReading, productPhoto, stuckStation, type DayGroups } from "./central-clean";

test("foto do produto pelo nome; sem foto quando não reconhece", () => {
  assert.equal(productPhoto("2× Caramelo Chocolate"), "/brand/products/frontal/caramelo.jpg");
  assert.equal(productPhoto("1× Singular Frutado e mais 1"), "/brand/products/frontal/singular.jpg");
  assert.equal(productPhoto("3× Espresso Clássico"), null);
  assert.equal(productPhoto(null), null);
});

test("jornada: só o estado; vermelho onde o café parou", () => {
  const ok = journeyStations({ greenDays: 60, roastBehindKg: 0, toShip: 0, late: 0 });
  assert.deepEqual(ok.map((s) => s.tone), ["ok", "ok", "ok", "ok"]);
  assert.equal(stuckStation(ok), -1);
  const s = journeyStations({ greenDays: 28, roastBehindKg: 56, toShip: 8, late: 0 });
  assert.deepEqual(s.map((x) => x.status), ["comprar logo", "atrasada", "8 pedidos para sair", "entregas em dia"]);
  assert.equal(stuckStation(s), 0);
  const late = journeyStations({ greenDays: 28, roastBehindKg: 0, toShip: 1, late: 1 });
  assert.equal(late[2]!.status, "1 pedido para sair");
  assert.equal(late[3]!.status, "1 entrega atrasada");
  assert.equal(stuckStation(late), 2);
});

test("meta: % feito contra onde deveria estar hoje", () => {
  assert.equal(goalProgress(20000, null, 28, 30), null);
  const g = goalProgress(18400, 20000, 28, 30)!;
  assert.equal(g.percent, 92);
  assert.equal(g.expected, 93);
  assert.equal(g.onTrack, false);
  assert.equal(g.missing, 1600);
  assert.equal(g.daysLeft, 2);
});

test("barras: semanas de segunda a domingo e os últimos 14 dias", () => {
  const days: DayGroups[] = [
    { day: "2026-10-05", groups: { "Mercado Livre": 100 } },
    { day: "2026-11-27", groups: { "Mercado Livre": 1200, Distribuidores: 1300 } },
    { day: "2026-11-28", groups: { "Loja online": 50 } },
  ];
  const weeks = groupBars(days, "weeks", "2026-10-05", "2026-11-28");
  assert.equal(weeks.length, 8);
  assert.equal(weeks[0]!.label, "05/10");
  assert.equal(weeks[0]!.total, 100);
  assert.equal(weeks[7]!.label, "23/11");
  assert.equal(weeks[7]!.total, 2550);
  const d = groupBars(days, "days", "2026-10-05", "2026-11-28");
  assert.equal(d.length, 14);
  assert.equal(d[13]!.label, "28/11");
  assert.equal(d[12]!.values.Distribuidores, 1300);
});

test("leitura do mês e fotos de quem está logado", () => {
  const text = monthReading([
    { name: "Distribuidores", revenue: 3000 }, { name: "Signa · parceira B2B", revenue: 2900 },
    { name: "White Label (Bispo)", revenue: 2000 }, { name: "Pontos de consumo", revenue: 1500 },
    { name: "Mercado Livre", revenue: 600 }, { name: "Loja online", revenue: 0 },
  ])!;
  assert.match(text, /Distribuidores e Signa somam 59% do mês/);
  assert.match(text, /R\$ 1,5 mil/);
  assert.equal(monthReading([]), null);
  assert.equal(founderPhotos("Suzi").me?.name, "Suzi");
  assert.equal(founderPhotos("José").partner?.name, "Suzi");
  assert.equal(founderPhotos("Maikon").me, null);
});
