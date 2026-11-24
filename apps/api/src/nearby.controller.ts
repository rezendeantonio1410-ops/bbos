import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import { prisma } from "@bbos/database";
import { AuthService } from "./auth.service";
import { MobileNotificationService } from "./mobile-notification.service";
import { boundingBox, buyingRhythm, distanceKm, parseNearbyQuery } from "./nearby";

/** A late recurring customer this close triggers a push to the user (once a day). */
const NOTIFY_WITHIN_KM = 1.5;

const saoPauloDate = (date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(date);

/**
 * "Por perto": customers and prospects around the user's position, nearest
 * first, with each customer's buying rhythm. Available to the whole team.
 */
@Controller("nearby")
export class NearbyController {
  private readonly db: any = prisma;

  constructor(
    private readonly auth: AuthService,
    private readonly notifications: MobileNotificationService,
  ) {}

  private async actor(request: any) {
    const actor = await this.auth.resolve(this.auth.readToken(request));
    if (!actor) throw new UnauthorizedException("Sessão inválida.");
    return actor;
  }

  @Get()
  async list(
    @Req() request: any,
    @Query() query: { lat?: string; lng?: string; radiusKm?: string; notify?: string },
  ) {
    const actor = await this.actor(request);
    const point = parseNearbyQuery(query);
    if (!point) throw new BadRequestException("Localização inválida.");
    const box = boundingBox(point.lat, point.lng, point.radiusKm);
    const here = { lat: point.lat, lng: point.lng };

    const [customerRows, prospectRows, missing] = await Promise.all([
      this.db.$queryRawUnsafe(
        `SELECT c.id,c.name,c."tradeName",c.phone,c.address,c."addressNumber",c.district,c.city,
                c.latitude,c.longitude,c."geocodeSource"
           FROM "Customer" c
          WHERE c."companyId"=$1 AND c.active
            AND c.latitude BETWEEN $2 AND $3 AND c.longitude BETWEEN $4 AND $5
          LIMIT 500`,
        actor.companyId, box.minLat, box.maxLat, box.minLng, box.maxLng,
      ),
      this.db.$queryRawUnsafe(
        `SELECT p.id,p.name,p.segment,p.phone,p.address,p."addressNumber",p.district,p.city,p.stage,
                p.potential,p."taxId",p."suggestedTaxId",p.latitude,p.longitude,p."geocodeSource",
                p."lastContactAt",p."nextAction",p."nextActionAt"
           FROM "Prospect" p
          WHERE p."companyId"=$1 AND p."customerId" IS NULL AND p.stage NOT IN ('CLIENTE','SEM_INTERESSE')
            AND p.latitude BETWEEN $2 AND $3 AND p.longitude BETWEEN $4 AND $5
          LIMIT 500`,
        actor.companyId, box.minLat, box.maxLat, box.minLng, box.maxLng,
      ),
      this.db.$queryRawUnsafe(
        `SELECT (SELECT COUNT(*)::int FROM "Customer" WHERE "companyId"=$1 AND active AND latitude IS NULL) AS customers,
                (SELECT COUNT(*)::int FROM "Prospect" WHERE "companyId"=$1 AND latitude IS NULL
                   AND stage NOT IN ('CLIENTE','SEM_INTERESSE')) AS prospects`,
        actor.companyId,
      ),
    ]);

    const within = <T extends { latitude: number; longitude: number }>(rows: T[]) =>
      rows
        .map((row) => ({ ...row, distanceKm: Math.round(distanceKm(here, { lat: row.latitude, lng: row.longitude }) * 100) / 100 }))
        .filter((row) => row.distanceKm <= point.radiusKm)
        .sort((a, b) => a.distanceKm - b.distanceKm)
        .slice(0, 100);

    const customers = within(customerRows as any[]);
    const orderRows: Array<{ customerId: string; at: Date }> = customers.length
      ? await this.db.$queryRawUnsafe(
          `SELECT so."customerId",COALESCE(so."orderDate",so."createdAt") AS at
             FROM "SalesOrder" so
            WHERE so."companyId"=$1 AND so."customerId"=ANY($2::text[])
              AND so.status NOT IN ('DRAFT','CANCELLED') AND so."orderType"<>'SAMPLE'
              AND COALESCE(so."orderDate",so."createdAt") > NOW() - INTERVAL '2 years'`,
          actor.companyId,
          customers.map((customer) => customer.id),
        )
      : [];
    const byCustomer = new Map<string, Date[]>();
    for (const row of orderRows) byCustomer.set(row.customerId, [...(byCustomer.get(row.customerId) ?? []), row.at]);
    const enriched = customers.map((customer) => ({ ...customer, rhythm: buyingRhythm(byCustomer.get(customer.id) ?? []) }));

    if (query.notify === "1" && actor.id) await this.notifyLate(actor, enriched);
    return {
      radiusKm: point.radiusKm,
      customers: enriched,
      prospects: within(prospectRows as any[]),
      withoutLocation: missing[0] ?? { customers: 0, prospects: 0 },
    };
  }

  /** One push per customer per day, only for late recurring buyers very close by. */
  private async notifyLate(
    actor: { id?: string; companyId: string },
    customers: Array<{ id: string; name: string; tradeName?: string | null; distanceKm: number; rhythm: ReturnType<typeof buyingRhythm> }>,
  ) {
    const today = saoPauloDate();
    for (const customer of customers.filter((c) => c.rhythm.suggestVisit && c.distanceKm <= NOTIFY_WITHIN_KM).slice(0, 3)) {
      const name = customer.tradeName || customer.name;
      const meters = customer.distanceKm < 1 ? `${Math.round(customer.distanceKm * 1000)} m` : `${customer.distanceKm.toFixed(1)} km`;
      await this.notifications.queue({
        companyId: actor.companyId,
        userIds: [actor.id!],
        idempotencyKey: `nearby:${customer.id}:${today}`,
        type: "NEARBY_VISIT_SUGGESTED",
        title: `Você está a ${meters} de ${name}`,
        message: `Costuma comprar a cada ${customer.rhythm.usualIntervalDays} dias e está há ${customer.rhythm.daysSinceLastOrder} sem pedir. Que tal uma visita?`,
        href: `/clientes?cliente=${encodeURIComponent(customer.id)}`,
        entityType: "Customer",
        entityId: customer.id,
      });
    }
  }

  /** "Estou aqui": saves the user's current GPS position as the customer's location. */
  @Post("customers/:id/location")
  async setCustomerLocation(@Param("id") id: string, @Req() request: any, @Body() body: { latitude?: unknown; longitude?: unknown }) {
    const actor = await this.actor(request);
    const point = parseNearbyQuery({ lat: String(body.latitude ?? ""), lng: String(body.longitude ?? "") });
    if (!point) throw new BadRequestException("Coordenadas inválidas.");
    const updated = await this.db.$executeRawUnsafe(
      `UPDATE "Customer" SET latitude=$3,longitude=$4,"geocodedAt"=NOW(),"geocodeSource"='GPS'
        WHERE id=$1 AND "companyId"=$2`,
      id, actor.companyId, point.lat, point.lng,
    );
    if (!updated) throw new NotFoundException("Cliente não encontrado.");
    return { id, latitude: point.lat, longitude: point.lng, geocodeSource: "GPS" };
  }
}
