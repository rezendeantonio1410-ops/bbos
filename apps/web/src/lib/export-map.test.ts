import assert from "node:assert/strict";
import test from "node:test";
import { buildDestinations, cityCoords, destinationNote, normalizeName } from "./export-map";

test("cities are found in Portuguese, Italian or English, with or without accents", () => {
  assert.deepEqual(cityCoords("Florença"), [11.25, 43.77]);
  assert.deepEqual(cityCoords("Firenze"), [11.25, 43.77]);
  assert.deepEqual(cityCoords("Shenzhen"), [114.06, 22.54]);
  assert.deepEqual(cityCoords("Nova Iorque"), [-74.01, 40.71]);
  assert.equal(cityCoords("Cidade que não existe"), null);
  assert.equal(cityCoords(null), null);
  assert.equal(normalizeName("HainanLaoyouqian International Trade Co., Ltd."), normalizeName("Hainan Laoyouqian International Trade Co., Ltd."));
});

test("destinations of 26/11: Shenzhen with a sample and an order, Florence with a sample", () => {
  const buyers = [
    { id: "h", name: "Hainan Laoyouqian International Trade Co., Ltd.", country: "CN", city: "Shenzhen" },
    { id: "d", name: "D612 Coffee Roasters", country: "IT", city: "Florença" },
    { id: "x", name: "Sem movimento", country: "JP", city: "Tokyo" },
  ];
  const destinations = buildDestinations({
    buyers,
    samples: [{ buyerId: "h", status: "SENT" }, { buyerId: "d", status: "SENT" }],
    contracts: [{ buyerId: "d", status: "CANCELLED" }],
    orders: [{ customer: { name: "HainanLaoyouqian International Trade Co., Ltd." }, status: "INVOICED" }, { customer: { name: "Cliente do Brasil" }, status: "INVOICED" }],
  });
  assert.equal(destinations.length, 2);
  const shenzhen = destinations.find((d) => d.country === "CN")!;
  assert.equal(shenzhen.samplesOnTheWay, 1);
  assert.equal(shenzhen.deals, 1);
  assert.equal(destinationNote(shenzhen), "1 amostra a caminho · 1 negócio");
  const florence = destinations.find((d) => d.country === "IT")!;
  assert.equal(florence.deals, 0);
  assert.deepEqual(florence.coords, [11.25, 43.77]);
});

test("a city outside the table keeps no coordinates (the map uses the country center)", () => {
  const [only] = buildDestinations({
    buyers: [{ id: "a", name: "Café Andino", country: "CL", city: "Valparaíso" }],
    samples: [{ buyerId: "a", status: "DELIVERED" }],
    contracts: [],
    orders: [],
  });
  assert.equal(only!.coords, null);
  assert.equal(destinationNote(only!), "1 entregue");
});
