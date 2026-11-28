import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Header, Post, Query, Req, UnauthorizedException } from "@nestjs/common";
import { prisma } from "@bbos/database";
import type { Request } from "express";
import { randomUUID } from "node:crypto";
import { AuthService } from "./auth.service";
import { salesPortfolioPartnerId } from "./sales-portfolio";
import { SellerPortfolioService } from "./seller-portfolio.service";
import { distanceKm } from "./nearby";
import { FIELD_CONSENT_VERSION, daySummary, dayInsights, parseDayAction, parsePoints, placeHere, type GpsPoint, type Place } from "./field-day";

const DAY = 86_400_000;
type DayRow = { id: string; userId: string; userName: string | null; status: string; startedAt: Date; endedAt: Date | null; pausedAt: Date | null; pausedMinutes: number; km: number | null; consentVersion: number };

function saoPauloDayStart(date: Date) {
  const local = new Date(date.getTime() - 3 * 3_600_000);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), 3, 0, 0));
}

/**
 * BBOS Campo: dia em campo do vendedor. O GPS do tablet só é gravado entre
 * "Iniciar dia" e "Encerrar dia", fora da pausa, e só com concordância na
 * versão atual do texto. O vendedor vê o próprio dia; a liderança, o relatório.
 */
@Controller("field")
export class FieldController {
  private readonly db = prisma;

  constructor(private readonly auth: AuthService, private readonly portfolios: SellerPortfolioService) {}

  private async actor(req: Request) {
    const actor = await this.auth.resolve(this.auth.readToken(req));
    if (!actor) throw new UnauthorizedException("Sessão inválida.");
    return actor;
  }

  private async consent(companyId: string, userId: string) {
    const rows = await this.db.$queryRawUnsafe<Array<{ acceptedAt: Date }>>(
      `SELECT "acceptedAt" FROM "FieldConsent" WHERE "companyId"=$1 AND "userId"=$2 AND version=$3 AND "revokedAt" IS NULL LIMIT 1`,
      companyId, userId, FIELD_CONSENT_VERSION,
    );
    return rows[0] ?? null;
  }

  private async openDay(companyId: string, userId: string) {
    const rows = await this.db.$queryRawUnsafe<DayRow[]>(
      `SELECT id,"userId","userName",status,"startedAt","endedAt","pausedAt","pausedMinutes"::float AS "pausedMinutes",km::float AS km,"consentVersion"
         FROM "FieldDay" WHERE "companyId"=$1 AND "userId"=$2 AND status<>'ENDED' LIMIT 1`,
      companyId, userId,
    );
    return rows[0] ?? null;
  }

  /** Clientes e prospects com mapa, para reconhecer paradas e "você está no cliente". */
  private async places(companyId: string): Promise<Place[]> {
    const rows = await this.db.$queryRawUnsafe<Array<{ id: string; name: string; lat: number; lng: number; kind: "CUSTOMER" | "PROSPECT" }>>(
      `SELECT id,COALESCE(NULLIF("tradeName",''),name) AS name,latitude::float AS lat,longitude::float AS lng,'CUSTOMER' AS kind
         FROM "Customer" WHERE "companyId"=$1 AND active AND latitude IS NOT NULL AND longitude IS NOT NULL
       UNION ALL
       SELECT id,name,latitude::float,longitude::float,'PROSPECT'
         FROM "Prospect" WHERE "companyId"=$1 AND "customerId" IS NULL AND latitude IS NOT NULL AND longitude IS NOT NULL
       LIMIT 5000`,
      companyId,
    ).catch(() => []);
    return rows;
  }

  private async points(dayId: string): Promise<GpsPoint[]> {
    const rows = await this.db.$queryRawUnsafe<Array<{ at: Date; lat: number; lng: number; accuracy: number | null; speed: number | null }>>(
      `SELECT "at",lat,lng,accuracy,speed FROM "FieldPoint" WHERE "dayId"=$1 ORDER BY "at"`,
      dayId,
    );
    return rows.map((r) => ({ at: new Date(r.at), lat: r.lat, lng: r.lng, accuracy: r.accuracy, speed: r.speed }));
  }

  /** Pedidos do dia dos clientes visitados (para vendas por km). */
  private async orders(companyId: string, from: Date, to: Date) {
    return this.db.$queryRawUnsafe<Array<{ customerId: string; amount: number }>>(
      `SELECT "customerId",SUM("totalAmount")::float AS amount FROM "SalesOrder"
        WHERE "companyId"=$1 AND "orderType"='COMMERCIAL' AND status::text<>'CANCELLED' AND "orderedAt">=$2 AND "orderedAt"<$3
        GROUP BY "customerId"`,
      companyId, from, to,
    );
  }

  private async summarize(companyId: string, day: DayRow, places: Place[], now = new Date()) {
    const end = day.endedAt ?? now;
    const pausedNow = day.status === "PAUSED" && day.pausedAt ? (now.getTime() - new Date(day.pausedAt).getTime()) / 60_000 : 0;
    const [points, orders] = await Promise.all([this.points(day.id), this.orders(companyId, new Date(day.startedAt), new Date(new Date(end).getTime() + 60_000))]);
    const summary = daySummary({ startedAt: new Date(day.startedAt), endedAt: day.endedAt ? new Date(day.endedAt) : null, pausedMinutes: day.pausedMinutes + pausedNow, points, places, orders, now });
    return { summary, insights: dayInsights(summary), last: points[points.length - 1] ?? null };
  }

  @Get("consent")
  @Header("Cache-Control", "private, no-store")
  async getConsent(@Req() req: Request) {
    const actor = await this.actor(req);
    const accepted = await this.consent(actor.companyId, actor.id);
    return { version: FIELD_CONSENT_VERSION, accepted: Boolean(accepted), acceptedAt: accepted?.acceptedAt ?? null };
  }

  /** "Li e concordo": guarda quem, quando e a versão do texto. */
  @Post("consent")
  async acceptConsent(@Req() req: Request, @Body() body: { version?: unknown }) {
    const actor = await this.actor(req);
    if (Number(body?.version) !== FIELD_CONSENT_VERSION) throw new BadRequestException("O texto de concordância mudou. Abra o app de novo para ler a versão atual.");
    await this.db.$executeRawUnsafe(
      `INSERT INTO "FieldConsent" (id,"companyId","userId","userName",version,"acceptedAt")
       VALUES ($1,$2,$3,$4,$5,NOW())
       ON CONFLICT ("companyId","userId",version) DO UPDATE SET "acceptedAt"=NOW(),"revokedAt"=NULL`,
      randomUUID(), actor.companyId, actor.id, actor.name ?? null, FIELD_CONSENT_VERSION,
    );
    return { ok: true, version: FIELD_CONSENT_VERSION };
  }

  /** Retirar a concordância: encerra o dia aberto e para de registrar na hora. */
  @Delete("consent")
  async revokeConsent(@Req() req: Request) {
    const actor = await this.actor(req);
    await this.db.$executeRawUnsafe(
      `UPDATE "FieldDay" SET status='ENDED',"endedAt"=NOW(),"updatedAt"=NOW() WHERE "companyId"=$1 AND "userId"=$2 AND status<>'ENDED'`,
      actor.companyId, actor.id,
    );
    await this.db.$executeRawUnsafe(
      `UPDATE "FieldConsent" SET "revokedAt"=NOW() WHERE "companyId"=$1 AND "userId"=$2 AND "revokedAt" IS NULL`,
      actor.companyId, actor.id,
    );
    return { ok: true };
  }

  /** Iniciar, pausar, retomar e encerrar o dia. */
  @Post("day")
  async day(@Req() req: Request, @Body() body: { action?: unknown }) {
    const actor = await this.actor(req);
    let action: ReturnType<typeof parseDayAction>;
    try { action = parseDayAction(body?.action); } catch (e) { throw new BadRequestException((e as Error).message); }
    const open = await this.openDay(actor.companyId, actor.id);
    if (action === "START") {
      if (!(await this.consent(actor.companyId, actor.id))) throw new ForbiddenException("Para registrar o dia, leia e concorde com o texto do BBOS Campo.");
      if (open) return { ok: true, dayId: open.id, status: open.status };
      const id = randomUUID();
      await this.db.$executeRawUnsafe(
        `INSERT INTO "FieldDay" (id,"companyId","userId","userName",status,"startedAt","consentVersion") VALUES ($1,$2,$3,$4,'ACTIVE',NOW(),$5)`,
        id, actor.companyId, actor.id, actor.name ?? null, FIELD_CONSENT_VERSION,
      );
      return { ok: true, dayId: id, status: "ACTIVE" };
    }
    if (!open) throw new BadRequestException("Nenhum dia iniciado.");
    if (action === "PAUSE") {
      await this.db.$executeRawUnsafe(`UPDATE "FieldDay" SET status='PAUSED',"pausedAt"=NOW(),"updatedAt"=NOW() WHERE id=$1 AND status='ACTIVE'`, open.id);
      return { ok: true, dayId: open.id, status: "PAUSED" };
    }
    if (action === "RESUME") {
      await this.db.$executeRawUnsafe(
        `UPDATE "FieldDay" SET status='ACTIVE',"pausedMinutes"="pausedMinutes"+EXTRACT(EPOCH FROM (NOW()-"pausedAt"))/60,"pausedAt"=NULL,"updatedAt"=NOW()
          WHERE id=$1 AND status='PAUSED'`,
        open.id,
      );
      return { ok: true, dayId: open.id, status: "ACTIVE" };
    }
    const { summary } = await this.summarize(actor.companyId, open, await this.places(actor.companyId));
    await this.db.$executeRawUnsafe(
      `UPDATE "FieldDay" SET status='ENDED',"endedAt"=NOW(),km=$2,
              "pausedMinutes"="pausedMinutes"+CASE WHEN status='PAUSED' AND "pausedAt" IS NOT NULL THEN EXTRACT(EPOCH FROM (NOW()-"pausedAt"))/60 ELSE 0 END,
              "pausedAt"=NULL,"updatedAt"=NOW()
        WHERE id=$1`,
      open.id, summary.km,
    );
    return { ok: true, dayId: open.id, status: "ENDED", km: summary.km };
  }

  /** Pontos de GPS do app. Só entram com o dia ativo (fora da pausa) e dentro do horário do dia. */
  @Post("points")
  async addPoints(@Req() req: Request, @Body() body: unknown) {
    const actor = await this.actor(req);
    let points: GpsPoint[];
    try { points = parsePoints(body); } catch (e) { throw new BadRequestException((e as Error).message); }
    const open = await this.openDay(actor.companyId, actor.id);
    if (!open || open.status !== "ACTIVE" || !(await this.consent(actor.companyId, actor.id))) return { ok: true, saved: 0, recording: false };
    const valid = points.filter((p) => p.at.getTime() >= new Date(open.startedAt).getTime());
    if (!valid.length) return { ok: true, saved: 0, recording: true };
    const saved = await this.db.$executeRawUnsafe(
      `INSERT INTO "FieldPoint" ("dayId","at",lat,lng,accuracy,speed)
       SELECT $1,x.at,x.lat,x.lng,x.accuracy,x.speed
         FROM unnest($2::timestamp[],$3::float8[],$4::float8[],$5::float4[],$6::float4[]) AS x(at,lat,lng,accuracy,speed)
       ON CONFLICT ("dayId","at") DO NOTHING`,
      open.id,
      valid.map((p) => p.at),
      valid.map((p) => p.lat),
      valid.map((p) => p.lng),
      valid.map((p) => p.accuracy),
      valid.map((p) => p.speed),
    );
    return { ok: true, saved: Number(saved), recording: true };
  }

  /** "Meu dia": status, resumo ao vivo, onde estou e a rota sugerida da carteira. */
  @Get("today")
  @Header("Cache-Control", "private, no-store")
  async today(@Req() req: Request) {
    const actor = await this.actor(req);
    const [consent, open, places] = await Promise.all([this.consent(actor.companyId, actor.id), this.openDay(actor.companyId, actor.id), this.places(actor.companyId)]);
    const now = new Date();
    let day = open;
    if (!day) {
      const rows = await this.db.$queryRawUnsafe<DayRow[]>(
        `SELECT id,"userId","userName",status,"startedAt","endedAt","pausedAt","pausedMinutes"::float AS "pausedMinutes",km::float AS km,"consentVersion"
           FROM "FieldDay" WHERE "companyId"=$1 AND "userId"=$2 AND "startedAt">=$3 ORDER BY "startedAt" DESC LIMIT 1`,
        actor.companyId, actor.id, saoPauloDayStart(now),
      );
      day = rows[0] ?? null;
    }
    const live = day ? await this.summarize(actor.companyId, day, places, now) : null;
    const here = live?.last && day?.status === "ACTIVE" && now.getTime() - live.last.at.getTime() < 15 * 60_000 ? placeHere(live.last, places) : null;

    // Rota sugerida: clientes da carteira com motivo, na ordem do vizinho mais perto.
    const partnerId = salesPortfolioPartnerId(actor as never);
    let route: Array<{ customerId: string; name: string; reason: string; value: number | null; distanceKm: number | null; visited: boolean }> = [];
    if (partnerId) {
      const portfolio = await this.portfolios.portfolio(actor.companyId, partnerId, "").catch(() => null);
      if (portfolio) {
        const reasons = new Map<string, { reason: string; value: number | null }>();
        for (const o of portfolio.path.opportunities) reasons.set(o.customerId, { reason: o.reason, value: o.value });
        for (const t of portfolio.tasks) if (!reasons.has(t.customerId)) reasons.set(t.customerId, { reason: t.title.split(" · ").slice(1).join(" · ") || t.detail, value: null });
        const visited = new Set((live?.summary.stops ?? []).map((s) => s.place?.id).filter(Boolean) as string[]);
        let from = live?.last ?? null;
        const pending = [...reasons.entries()].map(([id, r]) => ({ id, ...r, place: places.find((p) => p.id === id) ?? null }));
        const ordered: typeof pending = [];
        while (pending.length) {
          pending.sort((a, b) => (a.place && from ? distanceKm(from, a.place) : 999) - (b.place && from ? distanceKm(from, b.place) : 999));
          const next = pending.shift()!;
          ordered.push(next);
          if (next.place) from = { ...next.place, at: now, accuracy: null, speed: null };
        }
        const nameOf = new Map(portfolio.customers.map((c) => [c.id, c.name]));
        route = ordered.slice(0, 8).map((r) => ({
          customerId: r.id, name: nameOf.get(r.id) ?? r.place?.name ?? "Cliente", reason: r.reason, value: r.value,
          distanceKm: r.place && live?.last ? Math.round(distanceKm(live.last, r.place) * 10) / 10 : null, visited: visited.has(r.id),
        }));
      }
    }
    return {
      consent: { version: FIELD_CONSENT_VERSION, accepted: Boolean(consent) },
      day: day ? { id: day.id, status: day.status, startedAt: day.startedAt, endedAt: day.endedAt } : null,
      summary: live?.summary ? { ...live.summary, track: undefined } : null,
      insights: live?.insights ?? [],
      here: here ? { id: here.id, name: here.name, kind: here.kind, since: live?.summary.stops.at(-1)?.start ?? null } : null,
      route,
    };
  }

  /** Relatório "Equipe em campo" (liderança): um dia ou a semana de um vendedor. */
  @Get("report")
  @Header("Cache-Control", "private, no-store")
  async report(@Req() req: Request, @Query("userId") userIdParam?: string, @Query("date") dateParam?: string, @Query("days") daysParam?: string) {
    const actor = await this.actor(req);
    if (!["ADMIN", "EXECUTIVE"].includes(String(actor.role))) throw new ForbiddenException("Relatório disponível para a liderança.");
    const team = await this.db.$queryRawUnsafe<Array<{ userId: string; name: string | null; days: number; lastAt: Date }>>(
      `SELECT "userId",MAX("userName") AS name,COUNT(*)::int AS days,MAX("startedAt") AS "lastAt"
         FROM "FieldDay" WHERE "companyId"=$1 GROUP BY "userId" ORDER BY MAX("startedAt") DESC`,
      actor.companyId,
    );
    const userId = String(userIdParam ?? team[0]?.userId ?? "");
    if (!userId) return { team: [], days: [], selected: null };
    const span = [1, 7, 30].includes(Number(daysParam)) ? Number(daysParam) : 1;
    const ref = /^\d{4}-\d{2}-\d{2}$/.test(String(dateParam ?? "")) ? new Date(`${dateParam}T12:00:00Z`) : new Date();
    const to = new Date(saoPauloDayStart(ref).getTime() + DAY);
    const from = new Date(to.getTime() - span * DAY);
    const rows = await this.db.$queryRawUnsafe<DayRow[]>(
      `SELECT id,"userId","userName",status,"startedAt","endedAt","pausedAt","pausedMinutes"::float AS "pausedMinutes",km::float AS km,"consentVersion"
         FROM "FieldDay" WHERE "companyId"=$1 AND "userId"=$2 AND "startedAt">=$3 AND "startedAt"<$4 ORDER BY "startedAt"`,
      actor.companyId, userId, from, to,
    );
    const places = await this.places(actor.companyId);
    const days = [];
    for (const day of rows) {
      const { summary, insights } = await this.summarize(actor.companyId, day, places);
      days.push({ id: day.id, status: day.status, startedAt: day.startedAt, endedAt: day.endedAt, summary, insights });
    }
    const totals = days.reduce((t, d) => ({ km: t.km + d.summary.km, visits: t.visits + d.summary.visits, revenue: t.revenue + d.summary.revenue, customerMinutes: t.customerMinutes + d.summary.customerMinutes, totalMinutes: t.totalMinutes + d.summary.totalMinutes }), { km: 0, visits: 0, revenue: 0, customerMinutes: 0, totalMinutes: 0 });
    return {
      team: team.map((t) => ({ userId: t.userId, name: t.name ?? "Vendedor", days: t.days, lastAt: t.lastAt })),
      selected: { userId, name: team.find((t) => t.userId === userId)?.name ?? "Vendedor", from: from.toISOString(), to: to.toISOString(), span },
      totals: { ...totals, km: Math.round(totals.km * 10) / 10, revenuePerKm: totals.km > 0 ? Math.round(totals.revenue / totals.km) : null, kmPerVisit: totals.visits ? Math.round((totals.km / totals.visits) * 10) / 10 : null },
      days,
    };
  }
}
