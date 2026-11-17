import { ForbiddenException } from "@nestjs/common";
import { Prisma, UserRole } from "@bbos/database";

export type SalesPortfolioActor = {
  companyId: string;
  role: UserRole | string;
  storefrontPartnerId?: string | null;
};

export function salesPortfolioPartnerId(actor: SalesPortfolioActor) {
  if (actor.role !== UserRole.SALES) return null;
  const partnerId = String(actor.storefrontPartnerId ?? "").trim();
  if (!partnerId) {
    throw new ForbiddenException(
      "Este vendedor ainda não possui uma carteira vinculada. Solicite a José ou Suzi a configuração do perfil de representante.",
    );
  }
  return partnerId;
}

export function customerPortfolioWhere(
  partnerId: string,
): Prisma.CustomerWhereInput {
  return { storefrontPartners: { some: { partnerId } } };
}

export function salesOrderPortfolioWhere(
  partnerId: string,
): Prisma.SalesOrderWhereInput {
  return {
    OR: [
      { createdByStorefrontPartnerId: partnerId },
      {
        customer: {
          is: { storefrontPartners: { some: { partnerId } } },
        },
      },
    ],
  };
}

export async function assertCustomerInSalesPortfolio(
  database: Pick<Prisma.TransactionClient, "customer">,
  actor: SalesPortfolioActor,
  customerId: string,
) {
  const partnerId = salesPortfolioPartnerId(actor);
  if (!partnerId) return null;
  const customer = await database.customer.findFirst({
    where: {
      id: customerId,
      companyId: actor.companyId,
      ...customerPortfolioWhere(partnerId),
    },
    select: { id: true },
  });
  if (!customer) {
    throw new ForbiddenException(
      "Este cliente não pertence à carteira deste representante.",
    );
  }
  return partnerId;
}
