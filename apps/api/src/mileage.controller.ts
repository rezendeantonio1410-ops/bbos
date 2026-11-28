import { BadRequestException, Body, Controller, Get, Post, Query, Req } from "@nestjs/common";
import { PrismaClient } from "@bbos/database";
import type { Request } from "express";
import type { AuthenticatedActor } from "./auth-context";

const dayFormat = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" });
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
type SignedRequest = Request & { user: AuthenticatedActor };

@Controller("mileage")
export class MileageController {
  private readonly db = new PrismaClient();

  @Get()
  async list(@Req() { user }: SignedRequest, @Query("month") month: string) {
    if (typeof month !== "string" || !/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)) {
      throw new BadRequestException("Informe o mês no formato AAAA-MM.");
    }
    const start = new Date(`${month}-01T00:00:00Z`);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);
    // Include the UTC overlap, then filter by the actual local date.
    end.setUTCDate(end.getUTCDate() + 1);
    const team = user.role === "ADMIN" || user.role === "EXECUTIVE";
    const trips = await this.db.mileageTrip.findMany({
      where: {
        user: { companyId: user.companyId },
        userId: team ? undefined : user.id,
        startedAt: { gte: start, lt: end },
      },
      include: { user: { select: { name: true } } },
      orderBy: { startedAt: "desc" },
    });
    return { trips: trips.map(trip => ({ ...trip, day: dayFormat.format(trip.startedAt) }))
      .filter(trip => trip.day.startsWith(month)) };
  }

  @Post()
  async save(@Req() { user }: SignedRequest, @Body() body: Record<string, unknown>) {
    const { id, owner, vehicle, startedAt, endedAt, distanceMeters, incomplete } = body ?? {};
    if (owner !== user.id || typeof id !== "string" || !uuid.test(id)
      || typeof vehicle !== "string" || !vehicle.trim() || vehicle.trim().length > 80
      || typeof startedAt !== "number" || !Number.isSafeInteger(startedAt) || startedAt <= 0
      || typeof endedAt !== "number" || !Number.isSafeInteger(endedAt) || endedAt < startedAt
      || endedAt > Date.now() + 300_000
      || typeof distanceMeters !== "number" || !Number.isSafeInteger(distanceMeters)
      || distanceMeters < 0 || distanceMeters > 2_147_483_647 || typeof incomplete !== "boolean") {
      throw new BadRequestException("Registro de percurso inválido.");
    }
    const data = {
      id, userId: user.id, vehicle: vehicle.trim(), startedAt: new Date(startedAt),
      endedAt: new Date(endedAt), distanceMeters, incomplete,
    };
    await this.db.mileageTrip.upsert({
      where: { userId_id: { userId: user.id, id } },
      create: data,
      update: {},
    });
    return { id };
  }
}
