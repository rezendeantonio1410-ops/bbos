import { randomUUID } from "node:crypto";
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { prisma } from "@bbos/database";
import { stepEffects, type SampleStatus } from "./export-input";
import { scheduledJobsDisabled } from "./scheduled-jobs";
import {
  TRACK17_CARRIER,
  TrackingUnavailable,
  eventNote,
  nextStatus,
  readTrackInfo,
  track17,
} from "./sample-tracking";

// A prepared sample with a tracking code is synced too: the carrier tells when it left.
const ACTIVE = ["PREPARED", "SENT", "IN_TRANSIT", "CUSTOMS"];
const SIX_HOURS = 6 * 3_600_000;

type SampleRow = { id: string; status: string; carrier: string | null; trackingCode: string; responseDays: number | null; trackingRegisteredAt: Date | null };

export type SyncResult = { synced: number; changed: number; message: string | null };

/** Keeps export samples in step with the carrier through 17TRACK. */
@Injectable()
export class SampleTrackingService implements OnModuleInit, OnModuleDestroy {
  private readonly db: any = prisma;
  private readonly logger = new Logger(SampleTrackingService.name);
  private timer?: NodeJS.Timeout;

  enabled() {
    return Boolean(process.env.TRACK17_API_KEY?.trim());
  }

  onModuleInit() {
    if (scheduledJobsDisabled() || !this.enabled()) return;
    this.timer = setInterval(() => void this.syncAll().catch(() => undefined), SIX_HOURS);
    this.timer.unref?.();
    setTimeout(() => void this.syncAll().catch(() => undefined), 60_000).unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private item(sample: SampleRow) {
    const carrier = sample.carrier ? TRACK17_CARRIER[sample.carrier] : undefined;
    return carrier ? { number: sample.trackingCode, carrier } : { number: sample.trackingCode };
  }

  /** Samples on the way (or a single one) for one company or for all. */
  async sync(options: { companyId?: string; sampleId?: string } = {}): Promise<SyncResult> {
    const params: unknown[] = [];
    const filters = [`"trackingCode" IS NOT NULL`];
    if (options.sampleId) {
      params.push(options.sampleId);
      filters.push(`id=$${params.length}`);
    } else {
      params.push(ACTIVE);
      filters.push(`status = ANY($${params.length}::text[])`);
    }
    if (options.companyId) {
      params.push(options.companyId);
      filters.push(`"companyId"=$${params.length}`);
    }
    const where = filters.join(" AND ");
    const samples: SampleRow[] = await this.db.$queryRawUnsafe(
      `SELECT id,status,carrier,"trackingCode","responseDays","trackingRegisteredAt" FROM "ExportSample" WHERE ${where} LIMIT 40`,
      ...params,
    );
    if (!samples.length) return { synced: 0, changed: 0, message: null };

    try {
      const toRegister = samples.filter((s) => !s.trackingRegisteredAt);
      if (toRegister.length) {
        const result = await track17("register", toRegister.map((s) => this.item(s)));
        // Already registered (-18019901) also counts as registered.
        const ok = new Set<string>([
          ...(result.accepted ?? []).map((a: any) => String(a.number)),
          ...(result.rejected ?? []).filter((r: any) => r?.error?.code === -18019901).map((r: any) => String(r.number)),
        ]);
        for (const sample of toRegister) {
          if (!ok.has(sample.trackingCode)) continue;
          await this.db.$executeRawUnsafe(`UPDATE "ExportSample" SET "trackingRegisteredAt"=NOW() WHERE id=$1`, sample.id);
          sample.trackingRegisteredAt = new Date();
        }
      }
      const registered = samples.filter((s) => s.trackingRegisteredAt);
      if (!registered.length) return { synced: 0, changed: 0, message: "A transportadora ainda não reconheceu o código. Tente de novo mais tarde." };
      const info = await track17("gettrackinfo", registered.map((s) => this.item(s)));
      let changed = 0;
      for (const entry of info.accepted ?? []) {
        const sample = registered.find((s) => s.trackingCode === String(entry?.number));
        if (sample && (await this.apply(sample, entry))) changed += 1;
      }
      return { synced: registered.length, changed, message: null };
    } catch (error) {
      if (error instanceof TrackingUnavailable) return { synced: 0, changed: 0, message: error.message };
      this.logger.warn(`Sample tracking failed: ${error instanceof Error ? error.message : String(error)}`);
      return { synced: 0, changed: 0, message: "Não foi possível consultar o rastreio agora. Tente de novo em alguns minutos." };
    }
  }

  async syncAll() {
    return this.sync();
  }

  /** Writes new carrier events and moves the sample forward. True when the step changed. */
  private async apply(sample: SampleRow, entry: unknown) {
    const reading = readTrackInfo(entry);
    const next = nextStatus(sample.status, reading.step);
    for (const event of reading.events) {
      await this.db.$executeRawUnsafe(
        `INSERT INTO "ExportSampleEvent" (id,"sampleId",status,note,source,"occurredAt","recordedByName")
         SELECT $1,$2,$3,$4,'TRACKING',$5,'Rastreio automático'
          WHERE NOT EXISTS (SELECT 1 FROM "ExportSampleEvent" WHERE "sampleId"=$2 AND source='TRACKING' AND "occurredAt"=$5 AND note=$4)`,
        randomUUID(), sample.id, next ?? sample.status, eventNote(event), event.at,
      );
    }
    const effects = next
      ? stepEffects(next as SampleStatus, next === "DELIVERED" ? (reading.deliveredAt ?? new Date()) : (reading.events[0]?.at ?? new Date()), sample.responseDays ?? 7)
      : {};
    // COALESCE: a date typed by the team is never overwritten by the carrier.
    const sets = Object.keys(effects).map((field, index) => `"${field}"=COALESCE("${field}",$${index + 5})`);
    await this.db.$executeRawUnsafe(
      `UPDATE "ExportSample" SET "trackingSyncedAt"=NOW(),"trackingStatusText"=$2,"trackingProblem"=$3,
              status=COALESCE($4,status)${sets.length ? "," + sets.join(",") : ""},"updatedAt"=NOW()
        WHERE id=$1`,
      sample.id, reading.statusText, reading.problem, next, ...Object.values(effects),
    );
    return Boolean(next);
  }
}
