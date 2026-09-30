import { BadRequestException, HttpException, HttpStatus, Injectable, UnauthorizedException } from "@nestjs/common";
import { prisma, User } from "@bbos/database";
import { createHash, randomBytes, pbkdf2Sync, timingSafeEqual } from "node:crypto";
import { LoginAttemptLimiter } from "./auth-security";

export const SESSION_COOKIE = "bbos_session";
const SESSION_DAYS = 7;

type SessionUser = Pick<User, "id" | "companyId" | "name" | "email" | "role" | "active" | "avatarUrl"> & { company: { id: string; name: string; tradeName: string | null } };

export function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const iterations = 210000;
  const derived = pbkdf2Sync(password, salt, iterations, 32, "sha256").toString("hex");
  return `pbkdf2$${iterations}$${salt}$${derived}`;
}

function verifyPassword(password: string, encoded: string) {
  const [scheme, rawIterations, salt, expected] = encoded.split("$");
  if (scheme !== "pbkdf2" || !rawIterations || !salt || !expected) return false;
  const actual = pbkdf2Sync(password, salt, Number(rawIterations), 32, "sha256").toString("hex");
  return actual.length === expected.length && timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

function tokenHash(token: string) { return createHash("sha256").update(token).digest("hex"); }

@Injectable()
export class AuthService {
  private readonly db = prisma;
  private readonly loginLimiter = new LoginAttemptLimiter();

  async login(email: string, password: string, clientKey = "unknown") {
    if (!email || !password) throw new BadRequestException("E-mail e senha são obrigatórios.");
    const normalizedEmail = email.trim().toLowerCase();
    const limiterKey = createHash("sha256").update(`${clientKey}|${normalizedEmail}`).digest("hex");
    const retryAfter = this.loginLimiter.retryAfterSeconds(limiterKey);
    if (retryAfter > 0) {
      throw new HttpException(
        `Muitas tentativas de acesso. Tente novamente em ${Math.ceil(retryAfter / 60)} minuto(s).`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const user = await this.db.user.findUnique({ where: { email: normalizedEmail }, include: { company: true } });
    if (!user || !user.active || !verifyPassword(password, user.passwordHash)) {
      this.loginLimiter.recordFailure(limiterKey);
      throw new UnauthorizedException("E-mail ou senha inválidos.");
    }
    this.loginLimiter.clear(limiterKey);
    const token = randomBytes(32).toString("base64url");
    await this.db.authSession.create({ data: { userId: user.id, tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + SESSION_DAYS * 86400000) } });
    return { token, user: this.publicUser(user) };
  }

  async resolve(token?: string): Promise<SessionUser | null> {
    if (!token) return null;
    const session = await this.db.authSession.findUnique({ where: { tokenHash: tokenHash(token) }, include: { user: { include: { company: true } } } });
    if (!session || session.revokedAt || session.expiresAt <= new Date() || !session.user.active) return null;
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (session.lastSeenAt < fiveMinutesAgo) {
      await this.db.authSession.updateMany({
        where: { id: session.id, lastSeenAt: { lt: fiveMinutesAgo }, revokedAt: null },
        data: { lastSeenAt: new Date() },
      });
    }
    return this.publicUser(session.user) as SessionUser;
  }

  async revoke(token?: string) { if (token) await this.db.authSession.updateMany({ where: { tokenHash: tokenHash(token), revokedAt: null }, data: { revokedAt: new Date() } }); }
  async updateAvatar(userId: string, avatarUrl: string | null) {
    if (avatarUrl !== null && (!/^data:image\/(jpeg|png|webp);base64,/i.test(avatarUrl) || avatarUrl.length > 3_000_000)) throw new BadRequestException("Envie uma imagem JPG, PNG ou WebP de até 2 MB.");
    const user = await this.db.user.update({ where: { id: userId }, data: { avatarUrl }, include: { company: true } });
    return this.publicUser(user);
  }
  publicUser(user: any) { return { id: user.id, companyId: user.companyId, name: user.name, email: user.email, role: user.role, active: user.active, avatarUrl: user.avatarUrl ?? null, company: user.company ? { id: user.company.id, name: user.company.name, tradeName: user.company.tradeName } : undefined }; }
  readToken(req: { headers?: { cookie?: string } }) { const raw = req.headers?.cookie ?? ""; return raw.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${SESSION_COOKIE}=`))?.split("=").slice(1).join("="); }
}
