import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import { prisma, ReceivableStatus } from "@bbos/database";
import { randomUUID } from "node:crypto";
import type { Request } from "express";
import { AuthService } from "./auth.service";
import { BISPO_PIX_KEY } from "./billing-pix";
import {
  beneficiaryAccount,
  boletoDueDate,
  BoletoUnavailable,
  boletoMode,
  digitableLine,
  itauBarcode,
  itauBoletoPayload,
  payerProblems,
  registerItauBoleto,
  type BoletoMode,
} from "./boleto-itau";

type BoletoRow = {
  id: string;
  accountsReceivableId: string;
  mode: BoletoMode;
  status: "ISSUED" | "PAID" | "CANCELLED";
  ourNumber: string;
  digitableLine: string;
  barcode: string;
  pixCopyPaste: string | null;
  amount: string;
  dueDate: Date;
  issuedByName: string | null;
  paidAt: Date | null;
  createdAt: Date;
};

const COLUMNS = `"id", "accountsReceivableId", "mode", "status", "ourNumber", "digitableLine", "barcode", "pixCopyPaste", "amount"::text AS "amount", "dueDate", "issuedByName", "paidAt", "createdAt"`;

/**
 * Boleto com Pix (Itaú) a partir de Contas a receber.
 * Em modo "teste" nada é enviado ao banco e nenhuma conta é baixada.
 */
@Controller("finance/boletos")
export class ReceivableBoletoController {
  constructor(private readonly auth: AuthService) {}

  private async actor(req: Request) {
    const actor = await this.auth.resolve(this.auth.readToken(req));
    if (!actor) throw new UnauthorizedException("Sessão inválida.");
    return actor;
  }

  @Get()
  async list(@Req() req: Request) {
    const actor = await this.actor(req);
    const rows = await prisma.$queryRawUnsafe<BoletoRow[]>(
      `SELECT ${COLUMNS} FROM "ReceivableBoleto" WHERE "companyId" = $1 AND "status" <> 'CANCELLED' ORDER BY "createdAt" DESC LIMIT 500`,
      actor.companyId,
    );
    return { mode: boletoMode(), boletos: rows };
  }

  @Post()
  async issue(@Body() body: { receivableId?: string; dueDate?: string }, @Req() req: Request) {
    const actor = await this.actor(req);
    const mode = boletoMode();
    const receivable = await prisma.accountsReceivable.findFirst({
      where: { id: String(body?.receivableId ?? ""), companyId: actor.companyId },
      include: { customer: true, salesOrder: { select: { orderNumber: true, code: true } } },
    });
    if (!receivable) throw new NotFoundException("Conta a receber não encontrada.");
    if (receivable.status === ReceivableStatus.PAID || receivable.status === ReceivableStatus.CANCELLED || Number(receivable.openAmount) <= 0)
      throw new BadRequestException("Esta conta não tem saldo em aberto.");
    const customer = receivable.customer;
    const payer = {
      name: customer.legalName || customer.name,
      taxId: customer.taxId ?? "",
      address: customer.address,
      addressNumber: customer.addressNumber,
      district: customer.district,
      city: customer.city,
      state: customer.state,
      zipCode: customer.postalCode,
    };
    const missing = payerProblems(payer);
    if (missing.length)
      throw new BadRequestException(`Complete o cadastro do cliente antes de emitir o boleto: ${missing.join(", ")}.`);
    let due: Date;
    try {
      due = boletoDueDate(body?.dueDate, receivable.dueDate);
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
    const amountCents = Math.round(Number(receivable.openAmount) * 100);
    const bank = beneficiaryAccount();
    if (mode !== "teste" && (bank.agency === "0000" || bank.account === "00000"))
      throw new BadRequestException("Informe ITAU_AGENCIA e ITAU_CONTA no Render antes de emitir boletos reais.");

    return prisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe(`SELECT pg_advisory_xact_lock(hashtext($1)) IS NULL AS locked`, `receivable-boleto:${actor.companyId}`);
      const open = await tx.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT "id" FROM "ReceivableBoleto" WHERE "accountsReceivableId" = $1 AND "status" = 'ISSUED' LIMIT 1`,
        receivable.id,
      );
      if (open.length) throw new BadRequestException("Esta conta já tem um boleto em aberto.");
      const last = await tx.$queryRawUnsafe<Array<{ max: string | null }>>(
        `SELECT MAX("ourNumber") AS "max" FROM "ReceivableBoleto" WHERE "companyId" = $1 AND "mode" = $2`,
        actor.companyId,
        mode,
      );
      const ourNumber = String(Number(last[0]?.max ?? 0) + 1).padStart(8, "0");
      let issued: { barcode: string; digitableLine: string; pixCopyPaste: string | null; externalId: string | null };
      if (mode === "teste") {
        const local = itauBarcode({ ...bank, ourNumber, due, amountCents });
        // Sem Pix no modo teste: um QR real cairia na conta da Bispo.
        issued = { barcode: local.barcode, digitableLine: digitableLine(local.barcode), pixCopyPaste: null, externalId: null };
      } else {
        try {
          issued = await registerItauBoleto(
            itauBoletoPayload({
              mode,
              ...bank,
              ourNumber,
              yourNumber: receivable.salesOrder?.orderNumber ?? receivable.salesOrder?.code ?? receivable.id.slice(-10),
              issueDate: new Date(),
              due,
              amountCents,
              payer,
              pixKey: BISPO_PIX_KEY,
            }),
            mode,
          );
        } catch (error) {
          if (error instanceof BoletoUnavailable) throw new BadRequestException(error.message);
          throw new BadRequestException("Não foi possível falar com o Itaú agora. Tente de novo em alguns minutos.");
        }
      }
      const rows = await tx.$queryRawUnsafe<BoletoRow[]>(
        `INSERT INTO "ReceivableBoleto" ("id", "companyId", "accountsReceivableId", "mode", "ourNumber", "digitableLine", "barcode", "pixCopyPaste", "externalId", "amount", "dueDate", "issuedById", "issuedByName")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::numeric, $11, $12, $13)
         RETURNING ${COLUMNS}`,
        randomUUID(),
        actor.companyId,
        receivable.id,
        mode,
        ourNumber,
        issued.digitableLine,
        issued.barcode,
        issued.pixCopyPaste,
        issued.externalId,
        (amountCents / 100).toFixed(2),
        due,
        actor.id,
        actor.name,
      );
      return { mode, boleto: rows[0] };
    }, { timeout: 45_000, maxWait: 10_000 });
  }

  /** Só no modo teste: mostra como fica um boleto pago, sem baixar a conta a receber. */
  @Post(":id/simulate-payment")
  async simulatePayment(@Param("id") id: string, @Req() req: Request) {
    const actor = await this.actor(req);
    const row = await this.find(id, actor.companyId);
    if (row.mode !== "teste") throw new BadRequestException("Simulação só vale para boletos de teste.");
    if (row.status !== "ISSUED") throw new BadRequestException("Este boleto não está em aberto.");
    const rows = await prisma.$queryRawUnsafe<BoletoRow[]>(
      `UPDATE "ReceivableBoleto" SET "status" = 'PAID', "paidAt" = NOW(), "paidAmount" = "amount", "updatedAt" = NOW() WHERE "id" = $1 RETURNING ${COLUMNS}`,
      row.id,
    );
    return { boleto: rows[0], message: "Pagamento simulado. Em produção, o Itaú avisa o BBOS e a conta a receber é baixada sozinha." };
  }

  @Post(":id/cancel")
  async cancel(@Param("id") id: string, @Req() req: Request) {
    const actor = await this.actor(req);
    const row = await this.find(id, actor.companyId);
    if (row.status !== "ISSUED") throw new BadRequestException("Este boleto não está em aberto.");
    if (row.mode !== "teste")
      throw new BadRequestException("Por enquanto, a baixa de boleto registrado é feita no app Itaú Empresas.");
    await prisma.$executeRawUnsafe(
      `UPDATE "ReceivableBoleto" SET "status" = 'CANCELLED', "cancelledAt" = NOW(), "updatedAt" = NOW() WHERE "id" = $1`,
      row.id,
    );
    return { cancelled: true };
  }

  private async find(id: string, companyId: string) {
    const rows = await prisma.$queryRawUnsafe<BoletoRow[]>(
      `SELECT ${COLUMNS} FROM "ReceivableBoleto" WHERE "id" = $1 AND "companyId" = $2`,
      id,
      companyId,
    );
    if (!rows[0]) throw new NotFoundException("Boleto não encontrado.");
    return rows[0];
  }
}
