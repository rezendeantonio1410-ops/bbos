import { BadRequestException, Body, Controller, Get, Param, Post, Query, Req, UnauthorizedException } from "@nestjs/common";
import { Prisma } from "@bbos/database";
import { createHash, randomBytes, randomInt, randomUUID } from "node:crypto";
import { AuthService } from "./auth.service";
import { Public } from "./auth.guard";
import { publicAppUrl } from "./public-app-url";
import { SalesOrdersService } from "./sales-orders.service";
import { SalesOrderCustomerLifecycleService } from "./sales-order-customer-lifecycle.service";
import { SalesOrderPaymentsService } from "./sales-order-payments.service";
import { resolveSalesOrderPaymentPolicy } from "./sales-order-payment-policy";

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const OTP_THRESHOLD = Number(process.env.SALES_ORDER_ACCEPTANCE_OTP_THRESHOLD_CENTS ?? 1_000_000);
const TERMS_VERSION = "sales-order-acceptance-v2";
const BASE_TERMS_TEXT = "Confirmo que revisei os produtos, quantidades, valores, frete, prazo e condições comerciais desta proposta e autorizo a Bispo Coffees a confirmar o pedido.";
const termsTextFor = (freightResponsibility: unknown) => freightResponsibility === "CUSTOMER_CARRIER"
  ? `${BASE_TERMS_TEXT} Confirmo também que a transportadora indicada será contratada por minha conta e risco, incluindo custo, seguro, coleta e acompanhamento da entrega.`
  : BASE_TERMS_TEXT;
const maskPhone = (phone: string | null) => {
  const digits = String(phone ?? "").replace(/\D/g, "");
  return digits ? `${"•".repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}` : null;
};
const isCashTerm = (value: unknown) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  return !normalized || normalized === "à vista" || normalized === "a vista";
};

@Controller("sales-order-approvals")
export class SalesOrderApprovalsController {
  constructor(
    private readonly salesOrders: SalesOrdersService,
    private readonly auth: AuthService,
    private readonly customerLifecycle: SalesOrderCustomerLifecycleService,
    private readonly payments: SalesOrderPaymentsService,
  ) {}

  private async actor(request: any) {
    const actor = await this.auth.resolve(this.auth.readToken(request));
    if (!actor) throw new UnauthorizedException("Sessão inválida.");
    return actor;
  }

  private async snapshot(orderId: string, database: any = this.salesOrders.database) {
    const orders = await database.$queryRawUnsafe(
      `SELECT so.id, so."companyId", so."orderNumber", so.code, so.status,
              so.subtotal, so.discount, so.freight, so."totalAmount",
              so."expectedDeliveryDate", so."paymentType", so."paymentTermsSnapshot",
              so."freightResponsibility", so."carrierName", so."shippingServiceName",
              so."estimatedDeliveryDays", so."customerReference", so.incoterm,
              so."incotermLocation", so.notes, so."orderType",
              c.name AS "customerName", c.phone AS "customerPhone"
         FROM "SalesOrder" so JOIN "Customer" c ON c.id = so."customerId"
        WHERE so.id=$1`, orderId,
    ) as any[];
    const order = orders[0];
    if (!order) throw new BadRequestException("Pedido não encontrado.");
    const items = await database.$queryRawUnsafe(
      `SELECT id, "productName", sku, quantity, "unitPrice", "totalAmount"
         FROM "SalesOrderItem" WHERE "salesOrderId"=$1 ORDER BY id`, orderId,
    ) as any[];
    return {
      orderId: order.id,
      orderNumber: order.orderNumber ?? order.code,
      customerName: order.customerName,
      status: order.status,
      subtotal: Number(order.subtotal ?? 0),
      discount: Number(order.discount ?? 0),
      freight: Number(order.freight ?? 0),
      totalAmount: Number(order.totalAmount ?? 0),
      paymentType: order.paymentType,
      paymentTerms: order.paymentTermsSnapshot,
      orderType: order.orderType,
      freightResponsibility: order.freightResponsibility,
      carrierName: order.carrierName,
      shippingServiceName: order.shippingServiceName,
      estimatedDeliveryDays: order.estimatedDeliveryDays,
      expectedDeliveryDate: order.expectedDeliveryDate,
      customerReference: order.customerReference,
      incoterm: order.incoterm,
      incotermLocation: order.incotermLocation,
      notes: order.notes,
      items: items.map((item) => ({ productName: item.productName, sku: item.sku, quantity: Number(item.quantity), unitPrice: Number(item.unitPrice), totalAmount: Number(item.totalAmount) })),
      companyId: order.companyId,
      customerPhone: order.customerPhone as string | null,
    };
  }

  @Post(":orderId/link")
  async createLink(@Param("orderId") orderId: string, @Req() request: any, @Body() body: { expiresInDays?: number }) {
    const actor = await this.actor(request);
    const snapshot = await this.snapshot(orderId);
    if (snapshot.companyId !== actor.companyId) throw new UnauthorizedException("Pedido fora da empresa do usuário.");
    if (snapshot.orderType === "SAMPLE") throw new BadRequestException("Pedido de amostra é confirmado internamente e não exige aceite comercial do cliente.");
    if (snapshot.status !== "DRAFT") throw new BadRequestException("Somente pedidos provisórios podem ser enviados para confirmação do cliente.");
    const pending = await this.salesOrders.database.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*)::int AS count FROM "SalesDiscountRequest" WHERE "salesOrderId"=$1 AND status='PENDING'`, orderId,
    );
    if (Number(pending[0]?.count ?? 0) > 0) throw new BadRequestException("Resolva as solicitações de desconto pendentes antes de enviar o pedido ao cliente.");

    const expiresInDays = Math.min(30, Math.max(1, Number(body.expiresInDays ?? 7)));
    const expiresAt = new Date(Date.now() + expiresInDays * 86_400_000);
    const token = randomBytes(32).toString("base64url");
    const verificationRequired = Math.round(snapshot.totalAmount * 100) >= OTP_THRESHOLD;
    const confirmationCode = verificationRequired ? String(randomInt(0, 1_000_000)).padStart(6, "0") : null;
    const publicSnapshot = { ...snapshot } as any;
    delete publicSnapshot.companyId;
    delete publicSnapshot.customerPhone;
    const snapshotJson = JSON.stringify(publicSnapshot);
    const id = randomUUID();
    const termsText = termsTextFor(snapshot.freightResponsibility);

    await this.salesOrders.database.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `UPDATE "SalesOrderCustomerApproval" SET status='REVOKED', "revokedAt"=NOW(), "updatedAt"=NOW()
          WHERE "salesOrderId"=$1 AND status IN ('PENDING','VIEWED')`, orderId,
      );
      await tx.$executeRawUnsafe(
        `INSERT INTO "SalesOrderCustomerApproval"
          (id,"companyId","salesOrderId","tokenHash",snapshot,"snapshotHash",status,"expiresAt",
           "createdById","createdByName","createdAt","updatedAt","destinationMasked","customerPhoneSnapshot",
           "verificationRequired","verificationCodeHash","verificationCodeExpiresAt","termsVersion","termsText")
         VALUES ($1,$2,$3,$4,$5::jsonb,$6,'PENDING',$7,$8,$9,NOW(),NOW(),$10,$11,$12,$13,$14,$15,$16)`,
        id, actor.companyId, orderId, sha256(token), snapshotJson, sha256(snapshotJson), expiresAt,
        actor.id, actor.name, maskPhone(snapshot.customerPhone), snapshot.customerPhone, verificationRequired,
        confirmationCode ? sha256(confirmationCode) : null, confirmationCode ? expiresAt : null, TERMS_VERSION, termsText,
      );
    });

    const url = `${publicAppUrl()}/pedido/aprovar/${token}`;
    const codeText = confirmationCode ? `\n\nCódigo de confirmação: *${confirmationCode}*` : "";
    const deliveryMessage = snapshot.freightResponsibility === "PICKUP"
      ? "com retirada na Bispo Coffees"
      : snapshot.freightResponsibility === "CUSTOMER_CARRIER"
        ? `com transporte por sua conta e risco${snapshot.carrierName ? ` pela *${snapshot.carrierName}*` : ""}`
        : `já com o frete de *${money(snapshot.freight)}*`;
    const message = `Olá, ${snapshot.customerName}.\n\nA Bispo Coffees preparou o pedido *${snapshot.orderNumber}* no valor total de *${money(snapshot.totalAmount)}*, ${deliveryMessage}.\n\nConfira e confirme pelo celular:\n${url}${codeText}\n\nBispo Coffees`;
    const phoneDigits = String(snapshot.customerPhone ?? "").replace(/\D/g, "");
    return {
      id, token, url, path: `/pedido/aprovar/${token}`,
      whatsappUrl: phoneDigits ? `https://wa.me/${phoneDigits}?text=${encodeURIComponent(message)}` : null,
      message, destinationMasked: maskPhone(snapshot.customerPhone), expiresAt, status: "PENDING",
      verificationRequired, confirmationCode,
    };
  }

  @Get(":orderId/history")
  async history(@Param("orderId") orderId: string, @Req() request: any) {
    const actor = await this.actor(request);
    return this.salesOrders.database.$queryRawUnsafe<any[]>(
      `SELECT id,status,"expiresAt","createdByName","createdAt","viewedAt","acceptedByName","acceptedByEmail",
              "acceptedAt","customerNote","revokedAt","destinationMasked","verificationRequired","verificationCodeVerifiedAt"
         FROM "SalesOrderCustomerApproval" WHERE "salesOrderId"=$1 AND "companyId"=$2 ORDER BY "createdAt" DESC`,
      orderId, actor.companyId,
    );
  }

  @Public()
  @Get("public/:token")
  async publicView(@Param("token") token: string) {
    const rows = await this.salesOrders.database.$queryRawUnsafe<any[]>(
      `SELECT a.id,a."salesOrderId",a.status,a.snapshot,a."expiresAt",a."acceptedByName",a."acceptedAt",a."viewedAt",
              a."verificationRequired",a."termsText",(NULLIF(TRIM(c.email),'') IS NOT NULL) AS "emailConfigured",
              so."paymentType",so."totalAmount",c.active,c."creditStatus",c."creditLimit",
              (
                COALESCE((SELECT SUM(ar."openAmount") FROM "AccountsReceivable" ar
                           WHERE ar."customerId"=c.id AND ar.status NOT IN ('PAID','CANCELLED')),0)
                + COALESCE((SELECT SUM(pending."totalAmount") FROM "SalesOrder" pending
                             WHERE pending."customerId"=c.id
                               AND pending."paymentType"='TERM'
                               AND pending.status IN ('CONFIRMED','RESERVED','PICKING','READY_TO_SHIP','INVOICED','IN_PRODUCTION','SHIPPED')
                               AND NOT EXISTS (SELECT 1 FROM "AccountsReceivable" ar2 WHERE ar2."salesOrderId"=pending.id)),0)
              )::numeric AS "openReceivables"
         FROM "SalesOrderCustomerApproval" a
         JOIN "SalesOrder" so ON so.id=a."salesOrderId"
         JOIN "Customer" c ON c.id=so."customerId"
        WHERE a."tokenHash"=$1 LIMIT 1`, sha256(token),
    );
    const approval = rows[0];
    if (!approval) throw new BadRequestException("Link de confirmação inválido.");
    if (approval.status === "REVOKED") throw new BadRequestException("Este link foi substituído por uma versão mais recente do pedido.");
    if (["PENDING", "VIEWED"].includes(approval.status) && new Date(approval.expiresAt).getTime() < Date.now()) {
      await this.salesOrders.database.$executeRawUnsafe(
        `UPDATE "SalesOrderCustomerApproval" SET status='EXPIRED', "updatedAt"=NOW() WHERE id=$1 AND status IN ('PENDING','VIEWED')`, approval.id,
      );
      throw new BadRequestException("Este link de confirmação expirou.");
    }
    if (approval.status === "PENDING") {
      await this.salesOrders.database.$executeRawUnsafe(
        `UPDATE "SalesOrderCustomerApproval" SET status='VIEWED', "viewedAt"=NOW(), "updatedAt"=NOW() WHERE id=$1 AND status='PENDING'`, approval.id,
      );
      approval.status = "VIEWED";
      approval.viewedAt = new Date();
    }
    const payment = approval.status === "APPROVED"
      ? await this.payments.forOrder(approval.salesOrderId, true)
      : null;
    const paymentPreview = resolveSalesOrderPaymentPolicy({
      paymentType: approval.paymentType,
      customerActive: Boolean(approval.active),
      creditStatus: approval.creditStatus,
      creditLimit: approval.creditLimit,
      openReceivables: approval.openReceivables,
      orderTotal: approval.totalAmount,
    });
    delete approval.paymentType;
    delete approval.totalAmount;
    delete approval.active;
    delete approval.creditStatus;
    delete approval.creditLimit;
    delete approval.openReceivables;
    return { ...approval, payment, paymentPreview };
  }

  @Public()
  @Post("public/:token/accept")
  async accept(@Param("token") token: string, @Req() request: any, @Body() body: { name: string; email?: string; note?: string; code?: string }) {
    const name = String(body.name ?? "").trim();
    if (!name) throw new BadRequestException("Informe o nome de quem está confirmando o pedido.");
    const forwarded = String(request.headers?.["x-forwarded-for"] ?? "").split(",")[0]?.trim() ?? "";
    const ip = forwarded || request.ip || request.socket?.remoteAddress || "unknown";

    const result = await this.salesOrders.database.$transaction(async (tx) => {
      const approvals = await tx.$queryRawUnsafe<any[]>(
        `SELECT * FROM "SalesOrderCustomerApproval" WHERE "tokenHash"=$1 LIMIT 1 FOR UPDATE`, sha256(token),
      );
      const approval = approvals[0];
      if (!approval) throw new BadRequestException("Link de confirmação inválido.");
      const alreadyApproved = approval.status === "APPROVED";
      if (!alreadyApproved && !["PENDING", "VIEWED"].includes(approval.status)) throw new BadRequestException("Este link não está mais disponível para confirmação.");
      if (!alreadyApproved && new Date(approval.expiresAt).getTime() < Date.now()) throw new BadRequestException("Este link de confirmação expirou.");
      if (!alreadyApproved && approval.verificationRequired && (!body.code || sha256(String(body.code).trim()) !== approval.verificationCodeHash)) {
        throw new BadRequestException("Código de confirmação inválido.");
      }

      const locked = await tx.$queryRawUnsafe<any[]>(
        `SELECT so.id,so.status,so."paymentType",so."paymentTermsSnapshot",so."totalAmount",
                c.id AS "customerId",c.active,c.email,c."paymentTerms",c."creditStatus",c."creditLimit"
           FROM "SalesOrder" so JOIN "Customer" c ON c.id=so."customerId"
          WHERE so.id=$1 FOR UPDATE OF so`, approval.salesOrderId,
      );
      const order = locked[0];
      if (!order) throw new BadRequestException("Pedido não encontrado.");
      if (alreadyApproved) {
        const previous = await tx.$queryRawUnsafe<any[]>(
          `SELECT "paymentReason",status FROM "SalesOrderPaymentAttempt"
            WHERE "salesOrderId"=$1 ORDER BY "attemptNumber" DESC LIMIT 1`,
          approval.salesOrderId,
        );
        return {
          ok: true,
          status: "APPROVED",
          idempotent: true,
          orderStatus: order.status,
          salesOrderId: approval.salesOrderId,
          requiresPix: order.status === "DRAFT" && previous[0]?.status !== "PAID",
          paymentReason: previous[0]?.paymentReason ?? "CASH_ORDER",
        };
      }
      if (order.status !== "DRAFT") throw new BadRequestException("Este pedido não está mais provisório e não pode ser confirmado por este link.");
      const suppliedEmail = String(body.email ?? "").trim().toLowerCase();
      if (!String(order.email ?? "").trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(suppliedEmail)) {
        throw new BadRequestException("Informe um e-mail válido para receber a confirmação e acompanhar o pedido.");
      }
      if (!String(order.email ?? "").trim()) {
        await tx.$executeRawUnsafe(
          `UPDATE "Customer" SET email=$2,"updatedAt"=NOW() WHERE id=$1`,
          order.customerId,
          suppliedEmail,
        );
      }

      const current = await this.snapshot(approval.salesOrderId, tx);
      const publicSnapshot = { ...current } as any;
      delete publicSnapshot.companyId;
      delete publicSnapshot.customerPhone;
      if (sha256(JSON.stringify(publicSnapshot)) !== approval.snapshotHash) {
        throw new BadRequestException("O pedido foi alterado. Solicite à Bispo Coffees um novo link para revisar a versão atualizada.");
      }
      const pending = await tx.$queryRawUnsafe<any[]>(
        `SELECT COUNT(*)::int AS count FROM "SalesDiscountRequest" WHERE "salesOrderId"=$1 AND status='PENDING'`, approval.salesOrderId,
      );
      if (Number(pending[0]?.count ?? 0) > 0) throw new BadRequestException("O pedido possui uma condição comercial pendente de aprovação.");

      const exposure = await tx.$queryRawUnsafe<any[]>(
        `SELECT (
                  COALESCE((SELECT SUM(ar."openAmount") FROM "AccountsReceivable" ar
                             WHERE ar."customerId"=$1 AND ar.status NOT IN ('PAID','CANCELLED')),0)
                  + COALESCE((SELECT SUM(pending."totalAmount") FROM "SalesOrder" pending
                               WHERE pending."customerId"=$1
                                 AND pending."paymentType"='TERM'
                                 AND pending.status IN ('CONFIRMED','RESERVED','PICKING','READY_TO_SHIP','INVOICED','IN_PRODUCTION','SHIPPED')
                                 AND NOT EXISTS (SELECT 1 FROM "AccountsReceivable" ar2 WHERE ar2."salesOrderId"=pending.id)),0)
                )::numeric AS total`,
        order.customerId,
      );
      const normalizedPaymentType = order.paymentType === "LEGACY"
        ? (isCashTerm(order.paymentTerms) ? "CASH" : "TERM")
        : order.paymentType;
      const paymentPolicy = resolveSalesOrderPaymentPolicy({
        paymentType: normalizedPaymentType,
        customerActive: Boolean(order.active),
        creditStatus: order.creditStatus,
        creditLimit: order.creditLimit,
        openReceivables: exposure[0]?.total,
        orderTotal: order.totalAmount,
      });
      if (paymentPolicy.mode === "BLOCKED") {
        throw new BadRequestException("Cliente inativo. O pedido não pode ser confirmado.");
      }
      const requiresPix = paymentPolicy.mode === "PIX";

      const acceptedAt = new Date();
      const updated = await tx.$executeRawUnsafe(
        `UPDATE "SalesOrderCustomerApproval"
            SET status='APPROVED',"acceptedByName"=$2,"acceptedByEmail"=$3,"customerNote"=$4,"acceptedAt"=$5,
                "acceptedIpHash"=$6,"acceptedUserAgent"=$7,
                "verificationCodeVerifiedAt"=CASE WHEN "verificationRequired" THEN $5 ELSE NULL END,"updatedAt"=NOW()
          WHERE id=$1 AND status IN ('PENDING','VIEWED')`,
        approval.id, name, String(body.email ?? "").trim() || null, String(body.note ?? "").trim() || null,
        acceptedAt, sha256(ip), String(request.headers?.["user-agent"] ?? "").slice(0, 500) || null,
      );
      if (!updated) throw new BadRequestException("O pedido já foi respondido em outra sessão.");
      await tx.$executeRawUnsafe(
        `UPDATE "SalesOrder"
            SET status=CASE WHEN $2::boolean THEN status ELSE 'CONFIRMED'::"SalesOrderStatus" END,
                "paymentType"=CASE WHEN $2::boolean THEN 'CASH' ELSE "paymentType" END,
                "paymentTermsSnapshot"=CASE WHEN $2::boolean THEN 'Pix' ELSE "paymentTermsSnapshot" END,
                "updatedAt"=NOW()
          WHERE id=$1 AND status='DRAFT'`,
        approval.salesOrderId,
        requiresPix,
      );
      return {
        ok: true,
        status: "APPROVED",
        orderStatus: requiresPix ? "DRAFT" : "CONFIRMED",
        acceptedAt,
        salesOrderId: approval.salesOrderId,
        requiresPix,
        paymentReason: requiresPix ? paymentPolicy.reason : null,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if (result.requiresPix) {
      const paymentUrl = `${publicAppUrl()}/pedido/aprovar/${token}#pagamento`;
      try {
        const payment = await this.payments.ensurePix(
          result.salesOrderId,
          result.paymentReason,
          paymentUrl,
        );
        return { ...result, payment };
      } catch (error) {
        return {
          ...result,
          payment: null,
          paymentWarning: error instanceof Error
            ? error.message
            : "O Pix ainda não pôde ser preparado.",
        };
      }
    }

    await this.customerLifecycle.record(
      result.salesOrderId,
      "ORDER_CONFIRMED",
      "Pedido confirmado",
      "Recebemos sua confirmação. Seu pedido seguirá agora para separação e preparação.",
      "BBOS",
      `sales-order:confirmed:${result.salesOrderId}`,
      { acceptedByName: name },
    );
    return result;
  }

  @Public()
  @Post("public/:token/pix")
  async retryPix(@Param("token") token: string) {
    const rows = await this.salesOrders.database.$queryRawUnsafe<any[]>(
      `SELECT a."salesOrderId",a.status,so.status AS "orderStatus"
         FROM "SalesOrderCustomerApproval" a
         JOIN "SalesOrder" so ON so.id=a."salesOrderId"
        WHERE a."tokenHash"=$1 LIMIT 1`,
      sha256(token),
    );
    const approval = rows[0];
    if (!approval || approval.status !== "APPROVED") {
      throw new BadRequestException("Confirme o pedido antes de gerar o Pix.");
    }
    if (approval.orderStatus !== "DRAFT") {
      return { payment: await this.payments.forOrder(approval.salesOrderId, true) };
    }
    const previous = await this.salesOrders.database.$queryRawUnsafe<any[]>(
      `SELECT "paymentReason" FROM "SalesOrderPaymentAttempt"
        WHERE "salesOrderId"=$1 ORDER BY "attemptNumber" DESC LIMIT 1`,
      approval.salesOrderId,
    );
    const payment = await this.payments.ensurePix(
      approval.salesOrderId,
      previous[0]?.paymentReason ?? "CASH_ORDER",
      `${publicAppUrl()}/pedido/aprovar/${token}#pagamento`,
    );
    return { payment };
  }

  @Public()
  @Get("public/tracking/:orderId")
  async tracking(@Param("orderId") orderId: string, @Query("token") token: string) {
    if (!this.customerLifecycle.validTrackingToken(orderId, String(token ?? ""))) {
      throw new UnauthorizedException("Acompanhamento do pedido não autorizado.");
    }
    const orders = await this.salesOrders.database.$queryRawUnsafe<any[]>(
      `SELECT so.id,COALESCE(so."orderNumber",so.code) AS "orderNumber",so.status,
              so."totalAmount",so."updatedAt",c.name AS "customerName"
         FROM "SalesOrder" so JOIN "Customer" c ON c.id=so."customerId"
        WHERE so.id=$1 LIMIT 1`,
      orderId,
    );
    if (!orders[0]) throw new BadRequestException("Pedido não encontrado.");
    const [events, shipments] = await Promise.all([
      this.salesOrders.database.$queryRawUnsafe<any[]>(
        `SELECT "eventType",title,detail,"occurredAt"
           FROM "SalesOrderCustomerEvent"
          WHERE "salesOrderId"=$1 AND public=TRUE ORDER BY "occurredAt" ASC`,
        orderId,
      ),
      this.salesOrders.database.$queryRawUnsafe<any[]>(
        `SELECT status,"serviceName","carrierName","trackingCode","trackingUrl","postedAt","deliveredAt"
           FROM "Shipment" WHERE "salesOrderId"=$1 ORDER BY "createdAt" DESC LIMIT 1`,
        orderId,
      ),
    ]);
    return { ...orders[0], events, shipment: shipments[0] ?? null };
  }
}
