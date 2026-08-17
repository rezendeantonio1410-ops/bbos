import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import {
  PayableStatus,
  Prisma,
  PrismaClient,
  PurchaseInstallmentStatus,
  PurchaseExternalAcceptanceStatus,
} from "@bbos/database";

const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

@Controller("purchase-acceptance")
export class PurchaseAcceptanceController {
  private readonly db = new PrismaClient();

  @Get(":token")
  async view(@Param("token") token: string) {
    const acceptance = await this.db.greenCoffeePurchaseAcceptance.findUnique({
      where: { tokenHash: hashToken(token) },
    });
    if (!acceptance) throw new NotFoundException("Link de aceite inválido.");
    if (acceptance.tokenRevokedAt)
      throw new BadRequestException("Este link foi revogado.");
    if (
      acceptance.status !== PurchaseExternalAcceptanceStatus.ACCEPTED &&
      acceptance.tokenExpiresAt < new Date()
    ) {
      await this.db.greenCoffeePurchaseAcceptance.update({
        where: { id: acceptance.id },
        data: { status: PurchaseExternalAcceptanceStatus.EXPIRED },
      });
      throw new BadRequestException("Este link expirou.");
    }
    if (acceptance.status !== PurchaseExternalAcceptanceStatus.ACCEPTED && !acceptance.viewedAt) {
      await this.db.$transaction([
        this.db.greenCoffeePurchaseAcceptance.update({
          where: { id: acceptance.id },
          data: {
            viewedAt: acceptance.viewedAt ?? new Date(),
            status: PurchaseExternalAcceptanceStatus.VIEWED,
          },
        }),
        this.db.greenCoffeePurchase.update({
          where: { id: acceptance.purchaseId },
          data: { externalAcceptanceStatus: PurchaseExternalAcceptanceStatus.VIEWED },
        }),
        this.db.greenCoffeeAuditEvent.create({
          data: {
            companyId: (acceptance.snapshot as any).companyId ?? "",
            purchaseId: acceptance.purchaseId,
            action: "PURCHASE_ACCEPTANCE_VIEWED",
            actorId: "EXTERNAL_SUPPLIER",
            actorName: acceptance.contactName ?? "Fornecedor",
            metadata: { acceptanceId: acceptance.id },
          },
        }),
      ]).catch(() => undefined);
    }
    return {
      acceptanceId: acceptance.id,
      status: acceptance.status,
      acceptedAt: acceptance.acceptedAt,
      contactName: acceptance.contactName,
      contactRole: acceptance.contactRole,
      contactPhoneSnapshot: acceptance.contactPhoneSnapshot,
      contactEmailSnapshot: acceptance.contactEmailSnapshot,
      snapshot: acceptance.snapshot,
      termsVersion: acceptance.termsVersion,
      termsDocumentUrl: acceptance.termsDocumentUrl,
      tokenExpiresAt: acceptance.tokenExpiresAt,
    };
  }

  @Post(":token/accept")
  async accept(
    @Param("token") token: string,
    @Body() body: { name: string; role?: string; agreed: boolean },
  ) {
    if (!body.agreed || !body.name?.trim())
      throw new BadRequestException(
        "Informe o nome e confirme que leu e está de acordo.",
      );
    return this.db.$transaction(
      async (tx) => {
        const acceptance = await tx.greenCoffeePurchaseAcceptance.findUnique({
          where: { tokenHash: hashToken(token) },
          include: { purchase: { include: { installments: true } } },
        });
        if (!acceptance) throw new NotFoundException("Link de aceite inválido.");
        if (acceptance.status === PurchaseExternalAcceptanceStatus.ACCEPTED)
          return {
            status: "ACCEPTED",
            acceptedAt: acceptance.acceptedAt,
            purchaseNumber: acceptance.purchase.purchaseNumber,
            alreadyAccepted: true,
          };
        if (acceptance.tokenRevokedAt)
          throw new BadRequestException("Este link foi revogado.");
        if (acceptance.tokenExpiresAt < new Date())
          throw new BadRequestException("Este link expirou.");
        if (acceptance.purchase.approvalStatus !== "APPROVED")
          throw new BadRequestException("A compra ainda não foi aprovada internamente.");
        const acceptedAt = new Date();
        const updated = await tx.greenCoffeePurchaseAcceptance.update({
          where: { id: acceptance.id },
          data: {
            status: PurchaseExternalAcceptanceStatus.ACCEPTED,
            acceptedAt,
            acceptedByName: body.name.trim(),
            acceptedByRole: body.role?.trim() || null,
            viewedAt: acceptance.viewedAt ?? acceptedAt,
          },
        });
        await tx.greenCoffeePurchase.update({
          where: { id: acceptance.purchaseId },
          data: { externalAcceptanceStatus: PurchaseExternalAcceptanceStatus.ACCEPTED, operationalStatus: "AWAITING_DELIVERY" },
        });
        for (const installment of acceptance.purchase.installments) {
          if (installment.accountsPayableId) continue;
          const payable = await tx.accountsPayable.create({
            data: {
              companyId: acceptance.purchase.companyId,
              supplierId: acceptance.purchase.supplierId,
              purchaseId: acceptance.purchase.id,
              description: `${acceptance.purchase.purchaseNumber} · parcela ${installment.installmentNumber}`,
              issueDate: acceptance.purchase.purchasedAt,
              dueDate: installment.dueDate,
              amount: installment.amount,
              openAmount: installment.amount,
              status: PayableStatus.OPEN,
              category: "COMPRA_CAFE_VERDE",
              notes: `Compromisso confirmado pelo aceite externo ${acceptance.id}`,
            },
          });
          await tx.greenCoffeePurchaseInstallment.update({
            where: { id: installment.id },
            data: {
              status: PurchaseInstallmentStatus.COMMITTED,
              accountsPayableId: payable.id,
            },
          });
        }
        await tx.greenCoffeeAuditEvent.create({
          data: {
            companyId: acceptance.purchase.companyId,
            purchaseId: acceptance.purchase.id,
            action: "PURCHASE_ACCEPTED_EXTERNALLY",
            actorId: "EXTERNAL_SUPPLIER",
            actorName: body.name.trim(),
            metadata: {
              acceptanceId: acceptance.id,
              termsVersion: acceptance.termsVersion,
              documentHash: acceptance.documentHash,
            },
          },
        });
        return {
          status: updated.status,
          acceptedAt,
          purchaseNumber: acceptance.purchase.purchaseNumber,
          alreadyAccepted: false,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  @Post(":token/decline")
  async decline(@Param("token") token: string, @Body() body: { name: string; reason: string }) {
    const reason = body.reason?.trim();
    if (!body.name?.trim() || !reason) throw new BadRequestException("Informe seu nome e o motivo da recusa.");
    return this.db.$transaction(async (tx) => {
      const acceptance = await tx.greenCoffeePurchaseAcceptance.findUnique({ where: { tokenHash: hashToken(token) }, include: { purchase: true } });
      if (!acceptance) throw new NotFoundException("Link de aceite inválido.");
      if (acceptance.status === PurchaseExternalAcceptanceStatus.ACCEPTED) throw new BadRequestException("Este negócio já foi confirmado.");
      if (acceptance.status === PurchaseExternalAcceptanceStatus.DECLINED) return { status: "DECLINED", alreadyDeclined: true, declinedAt: acceptance.declinedAt };
      if (acceptance.tokenRevokedAt) throw new BadRequestException("Este link foi revogado.");
      if (acceptance.tokenExpiresAt < new Date()) throw new BadRequestException("Este link expirou.");
      if (acceptance.purchase.approvalStatus !== "APPROVED") throw new BadRequestException("A compra ainda não foi aprovada internamente.");
      const declinedAt = new Date();
      await tx.greenCoffeePurchaseAcceptance.update({ where: { id: acceptance.id }, data: { status: PurchaseExternalAcceptanceStatus.DECLINED, declinedAt, acceptedByName: body.name.trim() } });
      await tx.greenCoffeePurchase.update({ where: { id: acceptance.purchaseId }, data: { externalAcceptanceStatus: PurchaseExternalAcceptanceStatus.DECLINED, operationalStatus: "NOT_STARTED" } });
      await tx.greenCoffeeAuditEvent.create({ data: { companyId: acceptance.purchase.companyId, purchaseId: acceptance.purchaseId, action: "PURCHASE_CORRECTION_REQUESTED", actorId: "EXTERNAL_SUPPLIER", actorName: body.name.trim(), metadata: { acceptanceId: acceptance.id, reason } } });
      return { status: "DECLINED", declinedAt, purchaseNumber: acceptance.purchase.purchaseNumber };
    });
  }
}
