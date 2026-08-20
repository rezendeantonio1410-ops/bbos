import { UnauthorizedException, ForbiddenException } from "@nestjs/common";
import type { Request } from "express";
import { AuthService } from "./auth.service";

export type AuthenticatedActor = NonNullable<Awaited<ReturnType<AuthService["resolve"]>>>;

/** Resolve the actor exclusively from the signed session cookie. */
export async function requireSession(req: Request, auth: AuthService): Promise<AuthenticatedActor> {
  const actor = await auth.resolve(auth.readToken(req));
  if (!actor) throw new UnauthorizedException("Sessão inválida ou expirada.");
  return actor;
}

export function assertCompany(actor: AuthenticatedActor, companyId?: string) {
  if (companyId && companyId !== actor.companyId) {
    throw new ForbiddenException("Acesso negado para esta empresa.");
  }
  return actor.companyId;
}
