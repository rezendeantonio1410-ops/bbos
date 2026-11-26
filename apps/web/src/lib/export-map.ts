/**
 * Destinations of the export map: where samples and deals go, grouped by
 * city. Coordinates come from a table of coffee-importing cities; a city that
 * is not in it is placed at its country's center (the screen computes it from
 * the world map).
 */

export const ORIGIN = { name: "Londrina", coords: [-51.16, -23.31] as [number, number] };

/** [longitude, latitude] of cities that buy specialty coffee, by normalized name. */
const CITY_COORDS: Record<string, [number, number]> = {
  shenzhen: [114.06, 22.54], shanghai: [121.47, 31.23], beijing: [116.41, 39.9], pequim: [116.41, 39.9], guangzhou: [113.26, 23.13],
  hongkong: [114.17, 22.32], haikou: [110.35, 20.02], tokyo: [139.69, 35.69], toquio: [139.69, 35.69], osaka: [135.5, 34.69],
  seoul: [126.98, 37.57], seul: [126.98, 37.57], busan: [129.08, 35.18], taipei: [121.56, 25.03], singapore: [103.82, 1.35],
  singapura: [103.82, 1.35], bangkok: [100.5, 13.76], kualalumpur: [101.69, 3.14], jakarta: [106.85, -6.21], manila: [120.98, 14.6],
  dubai: [55.27, 25.2], riyadh: [46.68, 24.71], riade: [46.68, 24.71], jeddah: [39.19, 21.49], doha: [51.53, 25.29],
  istanbul: [28.98, 41.01], istambul: [28.98, 41.01], athens: [23.73, 37.98], atenas: [23.73, 37.98], moscow: [37.62, 55.76], moscou: [37.62, 55.76],
  florence: [11.25, 43.77], florenca: [11.25, 43.77], firenze: [11.25, 43.77], milan: [9.19, 45.46], milao: [9.19, 45.46], milano: [9.19, 45.46],
  rome: [12.5, 41.9], roma: [12.5, 41.9], trieste: [13.78, 45.65], genoa: [8.95, 44.41], genova: [8.95, 44.41], turin: [7.69, 45.07], torino: [7.69, 45.07],
  naples: [14.27, 40.85], napoles: [14.27, 40.85], napoli: [14.27, 40.85], hamburg: [9.99, 53.55], hamburgo: [9.99, 53.55], bremen: [8.8, 53.08],
  berlin: [13.4, 52.52], berlim: [13.4, 52.52], munich: [11.58, 48.14], munique: [11.58, 48.14], frankfurt: [8.68, 50.11], antwerp: [4.4, 51.22],
  antuerpia: [4.4, 51.22], antwerpen: [4.4, 51.22], brussels: [4.35, 50.85], bruxelas: [4.35, 50.85], amsterdam: [4.9, 52.37], rotterdam: [4.48, 51.92],
  roterda: [4.48, 51.92], london: [-0.13, 51.51], londres: [-0.13, 51.51], paris: [2.35, 48.86], lyon: [4.84, 45.76], madrid: [-3.7, 40.42],
  barcelona: [2.17, 41.39], lisbon: [-9.14, 38.72], lisboa: [-9.14, 38.72], porto: [-8.61, 41.15], zurich: [8.54, 47.38], geneva: [6.14, 46.2],
  genebra: [6.14, 46.2], vienna: [16.37, 48.21], viena: [16.37, 48.21], oslo: [10.75, 59.91], stockholm: [18.07, 59.33], estocolmo: [18.07, 59.33],
  copenhagen: [12.57, 55.68], copenhague: [12.57, 55.68], helsinki: [24.94, 60.17], gothenburg: [11.97, 57.71], gotemburgo: [11.97, 57.71],
  warsaw: [21.01, 52.23], varsovia: [21.01, 52.23], prague: [14.44, 50.08], praga: [14.44, 50.08], dublin: [-6.26, 53.35],
  newyork: [-74.01, 40.71], novaiorque: [-74.01, 40.71], losangeles: [-118.24, 34.05], seattle: [-122.33, 47.61], portland: [-122.68, 45.52],
  sanfrancisco: [-122.42, 37.77], chicago: [-87.63, 41.88], miami: [-80.19, 25.76], houston: [-95.37, 29.76], boston: [-71.06, 42.36],
  toronto: [-79.38, 43.65], vancouver: [-123.12, 49.28], montreal: [-73.57, 45.5], mexicocity: [-99.13, 19.43], cidadedomexico: [-99.13, 19.43],
  santiago: [-70.67, -33.45], buenosaires: [-58.38, -34.6], lima: [-77.04, -12.05], bogota: [-74.07, 4.71], sydney: [151.21, -33.87],
  melbourne: [144.96, -37.81], auckland: [174.76, -36.85], johannesburg: [28.05, -26.2], capetown: [18.42, -33.92],
};

export function normalizeName(text?: string | null) {
  return (text ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** City coordinates when known; null means "use the country's center". */
export function cityCoords(city?: string | null): [number, number] | null {
  const key = normalizeName(city);
  return key ? (CITY_COORDS[key] ?? null) : null;
}

export type MapBuyer = { id: string; name: string; country: string; city: string | null };
export type MapSample = { buyerId: string; status: string };
export type MapContract = { buyerId: string; status: string };
export type MapOrder = { customer?: { name?: string | null } | null; status: string };

export type Destination = {
  key: string;
  country: string;
  city: string | null;
  coords: [number, number] | null;
  buyers: string[];
  samplesOnTheWay: number;
  samplesDelivered: number;
  deals: number;
};

const ON_THE_WAY = new Set(["PREPARED", "SENT", "IN_TRANSIT", "CUSTOMS"]);
const DELIVERED = new Set(["DELIVERED", "EVALUATED"]);

/**
 * One destination per country + city, with the samples on the way or
 * delivered and the deals (contracts not cancelled, plus export orders whose
 * customer matches a buyer by name).
 */
export function buildDestinations(input: { buyers: MapBuyer[]; samples: MapSample[]; contracts: MapContract[]; orders: MapOrder[] }): Destination[] {
  const byBuyer = new Map(input.buyers.map((buyer) => [buyer.id, buyer]));
  const byName = new Map(input.buyers.map((buyer) => [normalizeName(buyer.name), buyer]));
  const places = new Map<string, Destination>();
  const place = (buyer: MapBuyer) => {
    const key = `${buyer.country}|${normalizeName(buyer.city)}`;
    let entry = places.get(key);
    if (!entry) {
      entry = { key, country: buyer.country, city: buyer.city, coords: cityCoords(buyer.city), buyers: [], samplesOnTheWay: 0, samplesDelivered: 0, deals: 0 };
      places.set(key, entry);
    }
    if (!entry.buyers.includes(buyer.name)) entry.buyers.push(buyer.name);
    return entry;
  };
  for (const sample of input.samples) {
    const buyer = byBuyer.get(sample.buyerId);
    if (!buyer) continue;
    if (ON_THE_WAY.has(sample.status)) place(buyer).samplesOnTheWay += 1;
    else if (DELIVERED.has(sample.status)) place(buyer).samplesDelivered += 1;
  }
  for (const contract of input.contracts) {
    const buyer = byBuyer.get(contract.buyerId);
    if (buyer && contract.status !== "CANCELLED") place(buyer).deals += 1;
  }
  for (const order of input.orders) {
    const buyer = byName.get(normalizeName(order.customer?.name));
    if (buyer && order.status !== "CANCELLED") place(buyer).deals += 1;
  }
  return [...places.values()].filter((d) => d.samplesOnTheWay + d.samplesDelivered + d.deals > 0);
}

/** "1 amostra a caminho · 1 pedido" */
export function destinationNote(d: Destination) {
  const parts: string[] = [];
  if (d.samplesOnTheWay) parts.push(`${d.samplesOnTheWay} ${d.samplesOnTheWay === 1 ? "amostra a caminho" : "amostras a caminho"}`);
  if (d.samplesDelivered) parts.push(`${d.samplesDelivered} ${d.samplesDelivered === 1 ? "entregue" : "entregues"}`);
  if (d.deals) parts.push(`${d.deals} ${d.deals === 1 ? "negócio" : "negócios"}`);
  return parts.join(" · ");
}
