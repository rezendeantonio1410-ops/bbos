import { BadRequestException, Body, Controller, Get, Param, Post, Req, UnauthorizedException } from "@nestjs/common";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { AuthService } from "./auth.service";
import { Public } from "./auth.guard";
import { SalesOrdersService } from "./sales-orders.service";

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

@Controller("sales-order-approvals")
export class SalesOrderApprovalsController {
  constructor(
    private readonly salesOrders: SalesOrdersService,
    private readonly auth: AuthService,
  ) {}

  private async actor(request: any) {
    const actor = await this.auth.resolve(this.auth.readToken(request));
    if (!actor) throw new UnauthorizedException("Sessão inválida.");
    return actor;
  }

  private async snapshot(orderId: string) {
    const orders = await this.salesOrders.database.$queryRawUnsafe<any[]>(
      `SELECT so.id, so."companyId", so."orderNumber", so.code, so.status, so."totalAmount",
              so."expectedDeliveryDate", so."paymentType", so."paymentTermsSnapshot",
              so."freightResponsibility", so."carrierName", so."customerReference",
              so.incoterm, so."incotermLocation", so.notes,
              c.name AS "customerName"
         FROM "SalesOrder" so
         JOIN "Customer" c ON c.id = so."customerId"
        WHERE so.id=$1`,
      orderId,
    );
    const order = orders[0];
    if (!order) throw new BadRequestException("Pedido não encontrado.");
    if (order.status !== "DRAFT") {
      throw new BadRequestException("Somente pedidos em rascunho podem ser enviados para aprovação do cliente.");
    }

    const pendingDiscounts = await this.salesOrders.database.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*)::int AS count FROM "SalesDiscountRequest" WHERE "salesOrderId"=$1 AND status='PENDING'`,
      orderId,
    );
    if (Number(pendingDiscounts[0]?.count ?? 0) > 0) {
      throw new BadRequestException("Resolva as solicitações de desconto pendentes antes de enviar o pedido ao cliente.");
    }

    const items = await this.salesOrders.database.$queryRawUnsafe<any[]>(
      `SELECT id, "productName", sku, quantity, "unitPrice", "totalAmount"
         FROM "SalesOrderItem"
        WHERE "salesOrderId"=$1
        ORDER BY id`,
      orderId,
    );

    return {
      orderId: order.id,
      orderNumber: order.orderNumber ?? order.code,
      customerName: order.customerName,
      status: order.status,
      totalAmount: Number(order.totalAmount ?? 0),
      paymentType: order.paymentType,
      paymentTerms: order.paymentTermsSnapshot,
      freightResponsibility: order.freightResponsibility,
      carrierName: order.carrierName,
      expectedDeliveryDate: order.expectedDeliveryDate,
      customerReference: order.customerReference,
      incoterm: order.incoterm,
      incotermLocation: order.incotermLocation,
      notes: order.notes,
      items: items.map((item) => ({
        productName: item.productName,
        sku: item.sku,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        totalAmount: Number(item.totalAmount),
      })),
      companyId: order.companyId,
    };
  }

  @Post(":orderId/link")
  async createLink(
    @Param("orderId") orderId: string,
    @Req() request: any,
    @Body() body: { expiresInDays?: number },
  ) {
    const actor = await this.actor(request);
    const snapshot = await this.snapshot(orderId);
    if (snapshot.companyId !== actor.companyId) throw new UnauthorizedException("Pedido fora da empresa do usuário.");

    const expiresInDays = Math.min(30, Math.max(1, Number(body.expiresInDays ?? 7)));
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
    const token = randomBytes(32).toString("base64url");
    const tokenHash = sha256(token);
    const publicSnapshot = { ...snapshot } as any;
    delete publicSnapshot.companyId;
    const snapshotJson = JSON.stringify(publicSnapshot);
    const snapshotHash = sha256(snapshotJson);
    const id = randomUUID();

    await this.salesOrders.database.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `UPDATE "SalesOrderCustomerApproval"
            SET status='REVOKED', "revokedAt"=NOW()
          WHERE "salesOrderId"=$1 AND status='PENDING'`,
        orderId,
      );
      await tx.$executeRawUnsafe(
        `INSERT INTO "SalesOrderCustomerApproval"
          (id,"companyId","salesOrderId","tokenHash",snapshot,"snapshotHash",status,"expiresAt","createdById","createdByName","createdAt")
         VALUES ($1,$2,$3,$4,$5::jsonb,$6,'PENDING',$7,$8,$9,NOW())`,
        id,
        actor.companyId,
        orderId,
        tokenHash,
        snapshotJson,
        snapshotHash,
        expiresAt,
        actor.id,
        actor.name,
      );
    });

    return {
      id,
      token,
      path: `/pedido/aprovar/${token}`,
      expiresAt,
      status: "PENDING",
    };
  }

  @Get(":orderId/history")
  async history(@Param("orderId") orderId: string, @Req() request: any) {
    const actor = await this.actor(request);
    return this.salesOrders.database.$queryRawUnsafe<any[]>(
      `SELECT id,status,"expiresAt","createdByName","createdAt","acceptedByName","acceptedByEmail","acceptedAt","customerNote","revokedAt"
         FROM "SalesOrderCustomerApproval"
        WHERE "salesOrderId"=$1 AND "companyId"=$2
        ORDER BY "createdAt" DESC`,
      orderId,
      actor.companyId,
    );
  }

  @Public()
  @Get("public/:token")
  async publicView(@Param("token") token: string) {
    const tokenHash = sha256(token);
    const rows = await this.salesOrders.database.$queryRawUnsafe<any[]>(
      `SELECT id,status,snapshot,"snapshotHash","expiresAt","acceptedByName","acceptedAt"
         FROM "SalesOrderCustomerApproval"
        WHERE "tokenHash"=$1
        LIMIT 1`,
      tokenHash,
    );
    const approval = rows[0];
    if (!approval) throw new BadRequestException("Link de aprovação inválido.");
    if (approval.status === "REVOKED") throw new BadRequestException("Este link foi substituído por uma versão mais recente do pedido.");
    if (approval.status === "PENDING" && new Date(approval.expiresAt).getTime() < Date.now()) {
      await this.salesOrders.database.$executeRawUnsafe(
        `UPDATE "SalesOrderCustomerApproval" SET status='EXPIRED' WHERE id=$1 AND status='PENDING'`,
        approval.id,
      );
      throw new BadRequestException("Este link de aprovação expirou.");
    }
    return {
      id: approval.id,
      status: approval.status,
      expiresAt: approval.expiresAt,
      acceptedByName: approval.acceptedByName,
      acceptedAt: approval.acceptedAt,
      snapshot: approval.snapshot,
    };
  }

  @Public()
  @Post("public/:token/accept")
  async accept(
    @Param("token") token: string,
    @Body() body: { name: string; email?: string; note?: string },
  ) {
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim() || null;
    const note = String(body.note ?? "").trim() || null;
    if (!name) throw new BadRequestException("Informe o nome de quem está aprovando o pedido.");

    const tokenHash = sha256(token);
    const rows = await this.salesOrders.database.$queryRawUnsafe<any[]>(
      `SELECT id,status,"expiresAt" FROM "SalesOrderCustomerApproval" WHERE "tokenHash"=$1 LIMIT 1`,
      tokenHash,
    );
    const approval = rows[0];
    if (!approval) throw new BadRequestException("Link de aprovação inválido.");
    if (approval.status === "APPROVED") return { ok: true, status: "APPROVED", idempotent: true };
    if (approval.status !== "PENDING") throw new BadRequestException("Este link não está mais disponível para aprovação.");
    if (new Date(approval.expiresAt).getTime() < Date.now()) {
      await this.salesOrders.database.$executeRawUnsafe(
        `UPDATE "SalesOrderCustomerApproval" SET status='EXPIRED' WHERE id=$1 AND status='PENDING'`,
        approval.id,
      );
      throw new BadRequestException("Este link de aprovação expirou.");
    }

    const updated = await this.salesOrders.database.$executeRawUnsafe(
      `UPDATE "SalesOrderCustomerApproval"
          SET status='APPROVED', "acceptedByName"=$2, "acceptedByEmail"=$3, "customerNote"=$4, "acceptedAt"=NOW()
        WHERE id=$1 AND status='PENDING'`,
      approval.id,
      name,
      email,
      note,
    );
    if (!updated) throw new BadRequestException("O pedido já foi respondido em outra sessão.");

    return { ok: true, status: "APPROVED" };
  }
}
