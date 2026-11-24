import { Injectable, Logger } from "@nestjs/common";
import { prisma } from "@bbos/database";
import { geocodeQuery } from "./nearby";

type Target = "Customer" | "Prospect";
type Row = {
  id: string;
  address: string | null;
  addressNumber: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
};

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
/** Nominatim's public policy: at most one request per second. We use one every 2 s. */
const MIN_INTERVAL_MS = 2_000;

/**
 * Turns stored addresses into coordinates for "Por perto", one address at a
 * time in the background worker. Only runs with BBOS_GEOCODING_ENABLED=true.
 * Rows located by GPS ("Estou aqui") are never touched. A failed address is
 * retried only after the address changes.
 */
@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);
  private readonly db: any = prisma;
  private lastRunAt = 0;
  private turn: Target = "Prospect";

  /** Replaceable in tests. */
  fetchImpl: typeof fetch = (...args) => fetch(...args);

  enabled() {
    return process.env.BBOS_GEOCODING_ENABLED === "true";
  }

  async sync(now = Date.now()) {
    if (!this.enabled() || now - this.lastRunAt < MIN_INTERVAL_MS) return;
    this.lastRunAt = now;
    // Alternate tables so neither waits for the other.
    const order: Target[] = this.turn === "Prospect" ? ["Prospect", "Customer"] : ["Customer", "Prospect"];
    this.turn = order[1]!;
    for (const table of order) {
      const row = await this.nextPending(table);
      if (row) return this.geocode(table, row);
    }
  }

  private async nextPending(table: Target): Promise<Row | null> {
    const rows = await this.db.$queryRawUnsafe(
      `SELECT id,address,"addressNumber",district,city,state,"postalCode" FROM "${table}"
        WHERE latitude IS NULL AND city IS NOT NULL AND (address IS NOT NULL OR "postalCode" IS NOT NULL)
          AND ("geocodeAttemptedAt" IS NULL OR "geocodeAttemptedAt" < "updatedAt")
          ${table === "Customer" ? "AND active" : "AND stage NOT IN ('CLIENTE','SEM_INTERESSE')"}
        ORDER BY "geocodeAttemptedAt" NULLS FIRST
        LIMIT 1`,
    );
    return rows[0] ?? null;
  }

  private async geocode(table: Target, row: Row) {
    const query = geocodeQuery(row);
    let found: { lat: number; lng: number } | null = null;
    if (query) {
      try {
        found = await this.search(query);
      } catch (error) {
        // Network or service failure: try again on a later tick, without marking.
        this.logger.warn(`Geocodificação indisponível: ${error instanceof Error ? error.message : String(error)}`);
        return;
      }
    }
    await this.db.$executeRawUnsafe(
      found
        ? `UPDATE "${table}" SET latitude=$2,longitude=$3,"geocodedAt"=NOW(),"geocodeSource"='ENDERECO',"geocodeAttemptedAt"=NOW()
            WHERE id=$1 AND latitude IS NULL`
        : `UPDATE "${table}" SET "geocodeAttemptedAt"=NOW() WHERE id=$1`,
      row.id,
      ...(found ? [found.lat, found.lng] : []),
    );
  }

  /** Structured search first (street + city); then postal code + city. */
  async search(query: NonNullable<ReturnType<typeof geocodeQuery>>) {
    const attempts: Array<Record<string, string>> = [];
    const base = { city: query.city, country: "Brasil", ...(query.state ? { state: query.state } : {}) };
    if (query.street) attempts.push({ ...base, street: query.street });
    if (query.postalcode) attempts.push({ ...base, postalcode: query.postalcode });
    for (const params of attempts) {
      const url = `${NOMINATIM_URL}?${new URLSearchParams({ ...params, format: "jsonv2", limit: "1", countrycodes: "br" })}`;
      const response = await this.fetchImpl(url, {
        headers: { "User-Agent": "BBOS-ERP/1.0 (geocodificacao de enderecos)", "Accept-Language": "pt-BR" },
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const [first] = (await response.json()) as Array<{ lat?: string; lon?: string }>;
      const lat = Number(first?.lat);
      const lng = Number(first?.lon);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }
    return null;
  }
}
