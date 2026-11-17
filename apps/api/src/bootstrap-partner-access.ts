import { PrismaClient, UserRole } from "@bbos/database";
import { hashPassword } from "./auth.service";
import { passwordPolicyError } from "./auth-security";

type BootstrapResult = { email: string; userId: string };

/**
 * Performs an explicit, short-lived recovery of an existing partner portal
 * credential. It never creates a user, changes a role or changes the partner
 * association. Disable the environment flag immediately after the recovery
 * deploy becomes live so later restarts cannot rotate the password again.
 */
export async function bootstrapPartnerAccessFromEnvironment(): Promise<BootstrapResult | null> {
  if (process.env.BBOS_BOOTSTRAP_PARTNER_ACCESS_ENABLED !== "true") return null;

  const email = process.env.BBOS_BOOTSTRAP_PARTNER_ACCESS_EMAIL?.trim().toLowerCase();
  const password = process.env.BBOS_BOOTSTRAP_PARTNER_ACCESS_PASSWORD;
  const expiresAtRaw = process.env.BBOS_BOOTSTRAP_PARTNER_ACCESS_EXPIRES_AT;
  if (!email || !password || !expiresAtRaw)
    throw new Error(
      "BBOS partner recovery: e-mail, senha e expiração não configurados.",
    );

  const expiresAt = new Date(expiresAtRaw);
  if (Number.isNaN(expiresAt.getTime()))
    throw new Error("BBOS partner recovery: expiração inválida.");
  if (expiresAt.getTime() <= Date.now()) return null;

  const passwordError = passwordPolicyError(password);
  if (passwordError) throw new Error(`BBOS partner recovery: ${passwordError}`);

  const database = new PrismaClient();
  try {
    return await database.$transaction(async (transaction) => {
      const user = await transaction.user.findUnique({
        where: { email },
        select: {
          id: true,
          role: true,
          active: true,
          storefrontPartnerId: true,
        },
      });
      if (
        !user ||
        user.role !== UserRole.PARTNER ||
        !user.active ||
        !user.storefrontPartnerId
      ) {
        throw new Error(
          "BBOS partner recovery: o acesso existente não é um parceiro ativo e vinculado.",
        );
      }

      await transaction.user.update({
        where: { id: user.id },
        data: { passwordHash: hashPassword(password) },
      });
      await transaction.authSession.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return { email, userId: user.id };
    });
  } finally {
    await database.$disconnect();
  }
}
