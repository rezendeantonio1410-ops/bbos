import { PrismaClient, UserRole } from "@bbos/database";
import { hashPassword } from "./auth.service";

const COMPANY_TAX_ID = "12.345.678/0001-90";

type BootstrapResult = { created: boolean; email: string; companyId: string };

/**
 * Creates the first real administrator only when explicitly enabled. It is
 * intentionally not exposed through HTTP and never changes an existing
 * user's password or role on restart.
 */
export async function bootstrapAdminFromEnvironment(): Promise<BootstrapResult | null> {
  if (process.env.BBOS_BOOTSTRAP_ADMIN_ENABLED !== "true") return null;

  const email = process.env.BBOS_BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.BBOS_BOOTSTRAP_ADMIN_PASSWORD;
  const name = process.env.BBOS_BOOTSTRAP_ADMIN_NAME?.trim() || "Administrador BBOS";
  if (!email) throw new Error("BBOS bootstrap: e-mail do administrador não configurado.");

  const database = new PrismaClient();
  try {
    return await database.$transaction(async (transaction) => {
      const company = await transaction.company.findFirst({
        where: { OR: [{ taxId: COMPANY_TAX_ID }, { tradeName: "Bispo Coffees" }] },
        select: { id: true },
      });
      const ensuredCompany = company ?? await transaction.company.create({
        data: { name: "Bispo Cafés Especiais Ltda.", tradeName: "Bispo Coffees", taxId: COMPANY_TAX_ID },
        select: { id: true },
      });
      const existing = await transaction.user.findUnique({
        where: { email },
        select: { id: true, companyId: true, role: true, active: true },
      });
      if (existing) {
        if (existing.companyId !== ensuredCompany.id || existing.role !== UserRole.ADMIN || !existing.active) {
          throw new Error("BBOS bootstrap: usuário administrador existente está associado a escopo ou permissão incompatível.");
        }
        return { created: false, email, companyId: ensuredCompany.id };
      }
      if (!password) throw new Error("BBOS bootstrap: senha do administrador não configurada.");
      const created = await transaction.user.create({
        data: { companyId: ensuredCompany.id, name, email, passwordHash: hashPassword(password), role: UserRole.ADMIN, active: true },
        select: { id: true, companyId: true },
      });
      return { created: true, email, companyId: created.companyId };
    });
  } finally {
    await database.$disconnect();
  }
}
