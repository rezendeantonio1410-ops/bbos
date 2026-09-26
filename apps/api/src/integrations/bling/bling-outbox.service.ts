import { Injectable } from "@nestjs/common";
import { PrismaClient } from "@bbos/database";
import { createHash } from "node:crypto";
import { BlingService } from "./bling.service";
import { StorefrontLifecycleService } from "../../storefront-lifecycle.service";
import { MelhorEnvioShipmentService } from "../../melhor-envio-shipment.service";
import { SalesOrderCustomerLifecycleService } from "../../sales-order-customer-lifecycle.service";

function stableId(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

function toBlingDate(value: unknown) {
  const parsed = value instanceof Date ? value : new Date(String(value ?? ""));
  const resolved = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  return resolved.toISOString().slice(0, 10);
}

@Injectable()
export class BlingOutboxService {
  private readonly database = new PrismaClient();

  constructor(
    private readonly bling: BlingService,
    private readonly lifecycle: StorefrontLifecycleService,
    private readonly shipment: MelhorEnvioShipmentService,
    private readonly customerLifecycle: SalesOrderCustomerLifecycleService,
  ) {}

  private async mapResource(
    companyId: string,
    resourceType: string,
    internalKey: string,
    externalId: string,
    metadata: unknown = {},
  ) {
    const id = `bling-map-${stableId(`${companyId}:${resourceType}:${internalKey}`)}`;
    await this.database.$executeRawUnsafe(
      `INSERT INTO "IntegrationResourceMap"
        (id,"companyId",provider,"resourceType","internalKey","externalId",metadata,"lastSyncedAt","createdAt","updatedAt")
       VALUES ($1,$2,'BLING',$3,$4,$5,$6::jsonb,NOW(),NOW(),NOW())
       ON CONFLICT ("companyId",provider,"resourceType","internalKey") DO UPDATE SET
         "externalId"=EXCLUDED."externalId",metadata=EXCLUDED.metadata,"lastSyncedAt"=NOW(),"updatedAt"=NOW()`,
      id,
      companyId,
      resourceType,
      internalKey,
      externalId,
      JSON.stringify(metadata ?? {}),
    );
  }

  private async getMap(companyId: string, resourceType: string, internalKey: string) {
    const rows = await this.database.$queryRawUnsafe<any[]>(
      `SELECT "externalId",metadata FROM "IntegrationResourceMap"
       WHERE "companyId"=$1 AND provider='BLING' AND "resourceType"=$2 AND "internalKey"=$3
       LIMIT 1`,
      companyId,
      resourceType,
      internalKey,
    );
    return rows[0] ?? null;
  }

  private normalizeBlingPhone(value: unknown) {
    let normalized = String(value ?? "").replace(/\D/g, "");
    if (normalized.startsWith("55") && normalized.length > 11) {
      normalized = normalized.slice(2);
    }
    return normalized;
  }

  private async findContactByDocument(companyId: string, document: string) {
    const paths = [
      `/contatos?numeroDocumento=${encodeURIComponent(document)}`,
      `/contatos?criterio=${encodeURIComponent(document)}`,
    ];
    for (const path of paths) {
      try {
        const result = await this.bling.request(companyId, path, { method: "GET" });
        const list = Array.isArray(result?.data) ? result.data : [];
        const exact = list.find(
          (contact: any) =>
            String(contact?.numeroDocumento ?? contact?.cnpj ?? contact?.cpf ?? "")
              .replace(/\D/g, "") === document,
        );
        if (exact?.id) return String(exact.id);
        // Never accept the first fuzzy search result for fiscal identity.
        // A non-exact result must be treated as not found so ensureContact can create the correct contact.
      } catch {
        // tenta o próximo filtro disponível na API
      }
    }
    return null;
  }

  private async ensureContact(companyId: string, customer: any, delivery: any) {
    const document = String(customer?.cpf ?? customer?.taxId ?? "").replace(/\D/g, "");
    if (!document) throw new Error("Pedido sem CPF/CNPJ para integração Bling.");

    const existing = await this.getMap(companyId, "CONTACT_DOCUMENT", document);
    if (existing?.externalId) {
      const detail = await this.bling.request(companyId, `/contatos/${encodeURIComponent(existing.externalId)}`, { method: "GET" }).catch(() => null);
      const remote = detail?.data ?? detail ?? {};
      const remoteDocument = String(remote?.numeroDocumento ?? remote?.cnpj ?? remote?.cpf ?? "").replace(/\D/g, "");
      if (remoteDocument === document) return existing.externalId as string;
      await this.database.$executeRawUnsafe(
        `DELETE FROM "IntegrationResourceMap" WHERE "companyId"=$1 AND provider='BLING' AND "resourceType"='CONTACT_DOCUMENT' AND "internalKey"=$2`,
        companyId,
        document,
      );
    }

    // Always resolve the contact fresh by fiscal document after a stale mapping is discarded.
    const remoteId = await this.findContactByDocument(companyId, document);
    if (remoteId) {
      const detail = await this.bling.request(companyId, `/contatos/${encodeURIComponent(remoteId)}`, { method: "GET" }).catch(() => null);
      const remote = detail?.data ?? detail ?? {};
      const remoteDocument = String(remote?.numeroDocumento ?? remote?.cnpj ?? remote?.cpf ?? "").replace(/\D/g, "");
      if (remoteDocument !== document) throw new Error("Emissão fiscal bloqueada: o contato localizado no Bling possui CPF/CNPJ diferente do cliente do pedido.");
      await this.mapResource(companyId, "CONTACT_DOCUMENT", document, remoteId, {
        email: customer?.email,
        source: "FOUND_BY_DOCUMENT_VERIFIED",
      });
      return remoteId;
    }

    const phone = this.normalizeBlingPhone(customer?.phone);
    const payload = await this.bling.request(companyId, "/contatos", {
      method: "POST",
      body: JSON.stringify({
        nome: customer?.name,
        tipo: document.length === 11 ? "F" : "J",
        situacao: "A",
        numeroDocumento: document,
        email: customer?.email,
        celular: phone || undefined,
        endereco: {
          geral: {
            endereco: delivery?.street,
            numero: delivery?.number,
            complemento: delivery?.complement,
            bairro: delivery?.district,
            cep: String(delivery?.postalCode ?? "").replace(/\D/g, ""),
            municipio: delivery?.city,
            uf: delivery?.state,
          },
        },
      }),
    });
    const externalId = String(payload?.data?.id ?? payload?.id ?? "");
    if (!externalId) throw new Error("Bling criou/recebeu contato sem retornar ID.");
    await this.mapResource(companyId, "CONTACT_DOCUMENT", document, externalId, {
      email: customer?.email,
    });
    return externalId;
  }

  private async productExternalId(companyId: string, item: any) {
    const internalKey = String(item?.id ?? "").trim();
    if (!internalKey) throw new Error("Item e-commerce sem identificador interno.");
    const mapping = await this.getMap(companyId, "STOREFRONT_PRODUCT", internalKey);
    if (!mapping?.externalId) {
      throw new Error(
        `Produto ${internalKey} ainda não está mapeado no Bling. Sincronize o catálogo antes de processar o pedido.`,
      );
    }
    return mapping.externalId as string;
  }

  private async processStorefrontPaid(row: any) {
    const orders = await this.database.$queryRawUnsafe<any[]>(
      `SELECT * FROM "StorefrontOrder" WHERE id=$1 AND "companyId"=$2 LIMIT 1`,
      row.aggregateId,
      row.companyId,
    );
    const order = orders[0];
    if (!order) throw new Error("StorefrontOrder da fila não foi encontrado.");
    if (order.status !== "PAID") throw new Error(`StorefrontOrder ${order.code} não está pago.`);

    const prior = await this.getMap(row.companyId, "STOREFRONT_ORDER", order.id);
    if (prior?.externalId) {
      await this.database.$executeRawUnsafe(
        `UPDATE "StorefrontOrder" SET status='PREPARING',"updatedAt"=NOW() WHERE id=$1 AND status='PAID'`,
        order.id,
      );
      await this.lifecycle.record(
        order.id,
        "PREPARING",
        "Pedido em preparação",
        "Seu café entrou na fila de separação e preparação da Bispo Coffees.",
        "BLING",
        `storefront:preparing:${order.id}`,
        { blingOrderId: prior.externalId },
      );
      return { externalId: prior.externalId, idempotent: true };
    }

    const contactId = await this.ensureContact(row.companyId, order.customer, order.delivery);
    const items = Array.isArray(order.items) ? order.items : [];
    if (!items.length) throw new Error("StorefrontOrder pago sem itens.");

    const blingItems = [];
    for (const item of items) {
      const productId = await this.productExternalId(row.companyId, item);
      blingItems.push({
        produto: { id: Number(productId) },
        quantidade: Number(item.quantity),
        valor: Number(item.unitPriceCents) / 100,
        descricao: item.grind ? `${item.name} — ${item.grind}` : item.name,
      });
    }

    const result = await this.bling.request(row.companyId, "/pedidos/vendas", {
      method: "POST",
      body: JSON.stringify({
        numeroLoja: order.code,
        data: toBlingDate(order.createdAt),
        contato: { id: Number(contactId) },
        itens: blingItems,
        observacoes: `Origem: ECOMMERCE | BBOS: ${order.code}`,
      }),
    });
    const externalId = String(result?.data?.id ?? result?.id ?? "");
    if (!externalId) throw new Error("Bling não retornou o ID do pedido de venda criado.");

    await this.mapResource(row.companyId, "STOREFRONT_ORDER", order.id, externalId, {
      code: order.code,
      origin: "ECOMMERCE",
    });
    await this.database.$executeRawUnsafe(
      `UPDATE "StorefrontOrder" SET status='PREPARING',"updatedAt"=NOW() WHERE id=$1 AND status='PAID'`,
      order.id,
    );
    await this.lifecycle.record(
      order.id,
      "PREPARING",
      "Pedido em preparação",
      "Seu café entrou na fila de separação e preparação da Bispo Coffees.",
      "BLING",
      `storefront:preparing:${order.id}`,
      { blingOrderId: externalId },
    );
    return { externalId, idempotent: false };
  }

  private async processSalesOrderInvoice(row: any) {
    const orders = await this.database.$queryRawUnsafe<any[]>(
      `SELECT so.*,c.name AS "customerName",c."taxId" AS "customerTaxId",
              c.email AS "customerEmail",c.phone AS "customerPhone",
              c."postalCode" AS "customerPostalCode",c.address AS "customerAddress",
              c.district AS "customerDistrict",c.city AS "customerCity",c.state AS "customerState"
         FROM "SalesOrder" so
         JOIN "Customer" c ON c.id=so."customerId"
        WHERE so.id=$1 AND so."companyId"=$2 LIMIT 1`,
      row.aggregateId,
      row.companyId,
    );
    const order = orders[0];
    if (!order) throw new Error("SalesOrder da fila não foi encontrado.");
    if (!["READY_TO_SHIP", "INVOICED"].includes(String(order.status))) {
      throw new Error(
        `SalesOrder ${order.code} precisa estar pronto para expedição antes do faturamento.`,
      );
    }

    const items = await this.database.$queryRawUnsafe<any[]>(
      `SELECT soi.*,pv.id AS "variantId",pv.sku,p."slug"
         FROM "SalesOrderItem" soi
         JOIN "ProductVariant" pv ON pv.id=soi."productVariantId"
         JOIN "Product" p ON p.id=pv."productId"
        WHERE soi."salesOrderId"=$1
        ORDER BY soi."createdAt" ASC`,
      order.id,
    );
    if (!items.length) throw new Error("Pedido comercial sem itens.");

    let salesMap = await this.getMap(row.companyId, "SALES_ORDER", order.id);
    if (!salesMap?.externalId) {
      const rawAddress = String(order.customerAddress || "").trim();
      const addressMatch = rawAddress.match(/^(.*?)(?:,|\s)+(\d+[A-Za-z0-9/-]*)\s*$/);
      const street = String(addressMatch?.[1] || rawAddress).trim();
      const number = String(addressMatch?.[2] || "S/N").trim();

      const contactId = await this.ensureContact(
        row.companyId,
        {
          name: order.customerName,
          cpf: order.customerTaxId,
          email: order.customerEmail,
          phone: order.customerPhone,
        },
        {
          street,
          number,
          complement: "",
          district: order.customerDistrict,
          postalCode: order.customerPostalCode,
          city: order.customerCity,
          state: order.customerState,
        },
      );

      const blingItems = [];
      for (const item of items) {
        const productId = await this.productExternalId(row.companyId, {
          id: item.slug,
        });
        blingItems.push({
          produto: { id: Number(productId) },
          quantidade: Number(item.quantity),
          valor: Number(item.unitPrice),
          descricao: item.productName,
          codigo: item.sku,
        });
      }

      const packageRows = order.shippingQuoteId
        ? await this.database.$queryRawUnsafe<any[]>(
            `SELECT package FROM "ShippingQuote" WHERE id=$1 LIMIT 1`,
            order.shippingQuoteId,
          )
        : [];
      const packagePayload = packageRows[0]?.package;
      const packageCount = Array.isArray(packagePayload)
        ? packagePayload.length
        : packagePayload
          ? 1
          : 0;
      const grossWeight =
        Array.isArray(packagePayload)
          ? packagePayload.reduce(
              (sum: number, pkg: any) =>
                sum + Number(pkg?.weight ?? pkg?.weightGrams ?? 0) / (pkg?.weightGrams ? 1000 : 1),
              0,
            )
          : Number(packagePayload?.weight ?? 0);

      const result = await this.bling.request(row.companyId, "/pedidos/vendas", {
        method: "POST",
        body: JSON.stringify({
          numeroLoja: order.orderNumber ?? order.code,
          data: toBlingDate(order.orderDate ?? order.orderedAt ?? order.createdAt),
          contato: { id: Number(contactId) },
          itens: blingItems,
          observacoes: `Origem: BBOS COMERCIAL | BBOS: ${order.code}`,
          transporte: {
            fretePorConta: order.freightResponsibility === "CUSTOMER" ? 1 : 0,
            frete: Number(order.freight ?? 0),
            quantidadeVolumes: packageCount || undefined,
            pesoBruto: grossWeight || undefined,
            prazoEntrega: Number(order.estimatedDeliveryDays ?? 0) || undefined,
          },
        }),
      });
      const externalId = String(result?.data?.id ?? result?.id ?? "");
      if (!externalId)
        throw new Error("Bling não retornou o ID do pedido de venda comercial.");
      await this.mapResource(row.companyId, "SALES_ORDER", order.id, externalId, {
        code: order.code,
        origin: "BBOS_COMERCIAL",
      });
      salesMap = { externalId };
    }

    const priorFiscal = await this.database.$queryRawUnsafe<any[]>(
      `SELECT * FROM "FiscalDocument"
        WHERE "companyId"=$1 AND "salesOrderId"=$2 AND direction='OUTBOUND'
        ORDER BY "createdAt" DESC LIMIT 1`,
      row.companyId,
      order.id,
    );
    const priorFiscalExternalId = String(priorFiscal[0]?.externalId ?? "").trim();
    if (
      priorFiscalExternalId &&
      priorFiscalExternalId !== "0" &&
      ["SENT", "AUTHORIZED"].includes(String(priorFiscal[0]?.status))
    ) {
      return {
        blingOrderId: salesMap.externalId,
        fiscalId: priorFiscal[0].id,
        blingNfeId: priorFiscalExternalId,
        idempotent: true,
      };
    }

    const expectedDocument = String(order.customerTaxId ?? "").replace(/\D/g, "");
    const salesOrderDetail = await this.bling.request(row.companyId, `/pedidos/vendas/${encodeURIComponent(salesMap.externalId)}`, { method: "GET" });
    const remoteOrder = salesOrderDetail?.data ?? salesOrderDetail ?? {};
    const remoteContactId = String(remoteOrder?.contato?.id ?? "");
    if (!remoteContactId) throw new Error("Emissão fiscal bloqueada: pedido do Bling sem contato destinatário.");
    const remoteContactDetail = await this.bling.request(row.companyId, `/contatos/${encodeURIComponent(remoteContactId)}`, { method: "GET" });
    const remoteContact = remoteContactDetail?.data ?? remoteContactDetail ?? {};
    const remoteDocument = String(remoteContact?.numeroDocumento ?? remoteContact?.cnpj ?? remoteContact?.cpf ?? "").replace(/\D/g, "");
    if (!expectedDocument || remoteDocument !== expectedDocument) {
      throw new Error(`Emissão fiscal bloqueada: CPF/CNPJ do destinatário no Bling (${remoteDocument || "ausente"}) difere do cliente do pedido BBOS (${expectedDocument || "ausente"}).`);
    }

    const remoteSalesOrder = await this.bling
      .request(
        row.companyId,
        `/pedidos/vendas/${encodeURIComponent(salesMap.externalId)}`,
        { method: "GET" },
      )
      .catch(() => null);
    let blingNfeId = String(
      remoteSalesOrder?.data?.notaFiscal?.id ??
      remoteSalesOrder?.notaFiscal?.id ??
      "",
    ).trim();
    if (blingNfeId === "0") blingNfeId = "";
    let nfeResult: any = {
      data: { idNotaFiscal: blingNfeId },
      recoveredFromSalesOrder: Boolean(blingNfeId),
    };
    if (!blingNfeId) {
      nfeResult = await this.bling.request(
        row.companyId,
        `/pedidos/vendas/${encodeURIComponent(salesMap.externalId)}/gerar-nfe`,
        { method: "POST" },
      );
      blingNfeId = String(
        nfeResult?.data?.idNotaFiscal ??
          nfeResult?.idNotaFiscal ??
          nfeResult?.data?.id ??
          nfeResult?.id ??
          "",
      );
    }
    if (!blingNfeId) throw new Error("Bling não retornou o ID da NF-e criada.");

    const fiscalId = priorFiscal[0]?.id || `fiscal-${stableId(`${row.companyId}:${order.id}:NFE`)}`;
    if (priorFiscal[0]) {
      await this.database.$executeRawUnsafe(
        `UPDATE "FiscalDocument"
            SET status='SENT',"externalProvider"='BLING',"externalId"=$2,
                "payloadSnapshot"=$3::jsonb,"updatedAt"=NOW()
          WHERE id=$1`,
        fiscalId,
        blingNfeId,
        JSON.stringify({ create: nfeResult, blingOrderId: salesMap.externalId }),
      );
    } else {
      await this.database.$executeRawUnsafe(
        `INSERT INTO "FiscalDocument"
          (id,"companyId",direction,"documentType",status,"customerId","salesOrderId",
           "externalProvider","externalId","totalAmount","payloadSnapshot","createdAt","updatedAt")
         VALUES ($1,$2,'OUTBOUND','NFE','SENT',$3,$4,'BLING',$5,$6,$7::jsonb,NOW(),NOW())`,
        fiscalId,
        row.companyId,
        order.customerId,
        order.id,
        blingNfeId,
        Number(order.totalAmount),
        JSON.stringify({ create: nfeResult, blingOrderId: salesMap.externalId }),
      );
    }
    await this.mapResource(
      row.companyId,
      "FISCAL_DOCUMENT",
      fiscalId,
      blingNfeId,
      { salesOrderId: order.id, blingOrderId: salesMap.externalId },
    );

    const authorizationRequestedAt = new Date().toISOString();
    const sendResult = await this.bling.request(
      row.companyId,
      `/nfe/${encodeURIComponent(blingNfeId)}/enviar?enviarEmail=false`,
      { method: "POST" },
    );
    const sefaz = this.sefazAuthorization(sendResult);
    let authorizedNote: any = null;
    if (sefaz.status === "AUTHORIZED") {
      authorizedNote = await this.bling
        .request(
          row.companyId,
          `/nfe/${encodeURIComponent(blingNfeId)}`,
          { method: "GET" },
        )
        .then((detail) => detail?.data ?? detail ?? null)
        .catch(() => null);
    }
    const accessKey = String(
      authorizedNote?.chaveAcesso ?? authorizedNote?.chave ?? "",
    ).trim() || null;
    const number = authorizedNote?.numero == null
      ? null
      : String(authorizedNote.numero);
    const series = authorizedNote?.serie == null
      ? null
      : String(authorizedNote.serie);
    await this.database.$executeRawUnsafe(
      `UPDATE "FiscalDocument"
          SET status=$2,
              number=COALESCE($3,number),series=COALESCE($4,series),
              "accessKey"=COALESCE($5,"accessKey"),
              "payloadSnapshot"=COALESCE("payloadSnapshot",'{}'::jsonb) || $6::jsonb,
              "updatedAt"=NOW()
        WHERE id=$1`,
      fiscalId,
      sefaz.status,
      number,
      series,
      accessKey,
      JSON.stringify({
        authorizationAttemptCount: 1,
        authorizationRequestedAt,
        blingSend: sendResult,
        blingNfe: authorizedNote,
        reconciledAt: authorizedNote ? new Date().toISOString() : null,
        sefazStatusCode: sefaz.code,
        sefazMessage: sefaz.message,
      }),
    );

    return {
      blingOrderId: salesMap.externalId,
      fiscalId,
      blingNfeId,
      idempotent: false,
    };
  }

  private fiscalStatus(value: unknown) {
    const code = Number(
      typeof value === "object" && value !== null
        ? ((value as any).id ?? (value as any).valor ?? (value as any).codigo)
        : value,
    );
    // Bling NF-e status codes (API v3):
    // 1 pending, 3 cancelled, 4 awaiting receipt, 5 rejected,
    // 6 authorized, 7 DANFE issued, 9 awaiting protocol,
    // 10 denied, 11 status query and 12 blocked.
    if (code === 6 || code === 7) return "AUTHORIZED";
    if (code === 2 || code === 3) return "CANCELLED";
    if (code === 5 || code === 10 || code === 12) return "REJECTED";
    return "SENT";
  }

  private fiscalStatusCode(value: unknown) {
    return Number(
      typeof value === "object" && value !== null
        ? ((value as any).id ?? (value as any).valor ?? (value as any).codigo)
        : value,
    );
  }

  private authorizationRetry(snapshot: any) {
    const count = Number(snapshot?.authorizationAttemptCount ?? 0);
    if (count >= 3) return { allowed: false, count };
    const lastAttempt = new Date(
      String(snapshot?.authorizationRequestedAt ?? snapshot?.authorizationRetriedAt ?? ""),
    ).getTime();
    const waitMs = count <= 1 ? 2 * 60_000 : 10 * 60_000;
    return {
      allowed: !Number.isFinite(lastAttempt) || Date.now() - lastAttempt >= waitMs,
      count,
    };
  }

  private sefazAuthorization(response: any) {
    const xml = String(response?.data?.xml ?? response?.xml ?? "");
    const codes = [...xml.matchAll(/<cStat>(\d+)<\/cStat>/g)].map((match) => Number(match[1]));
    const messages = [...xml.matchAll(/<xMotivo>([^<]+)<\/xMotivo>/g)].map((match) => match[1]);
    const code = codes.at(-1) ?? null;
    const message = messages.at(-1) ?? null;
    return {
      code,
      message,
      status:
        code === 100 || code === 150
          ? "AUTHORIZED"
          : code !== null && code >= 200
            ? "REJECTED"
            : "SENT",
    } as const;
  }

  private async processLegacyFiscalReady(row: any) {
    const documents = await this.database.$queryRawUnsafe<any[]>(
      `SELECT id,status,"externalId","salesOrderId" FROM "FiscalDocument"
        WHERE id=$1 AND "companyId"=$2 LIMIT 1`,
      row.aggregateId,
      row.companyId,
    );
    const document = documents[0];
    if (!document) throw new Error("FiscalDocument da fila não foi encontrado.");

    if (
      document.externalId ||
      ["SENT", "AUTHORIZED", "REJECTED", "CANCELLED"].includes(String(document.status))
    ) {
      return {
        fiscalId: document.id,
        blingNfeId: document.externalId,
        status: document.status,
        idempotent: true,
        legacyEvent: true,
      };
    }
    if (!document.salesOrderId) {
      throw new Error("Documento fiscal sem pedido comercial vinculado.");
    }
    return this.processSalesOrderInvoice({
      ...row,
      aggregateId: document.salesOrderId,
      aggregateType: "SALES_ORDER",
      eventType: "SALES_ORDER_INVOICE_REQUESTED",
    });
  }

  private async reconcileSentInvoice() {
    const rows = await this.database.$queryRawUnsafe<any[]>(
      `SELECT f.id,f."companyId",f."externalId",f."salesOrderId",f."payloadSnapshot"
         FROM "FiscalDocument" f
        WHERE f."externalProvider"='BLING'
          AND f."externalId" IS NOT NULL
          AND (
            f.status='SENT'
            OR (
              f.status='AUTHORIZED'
              AND NOT (COALESCE(f."payloadSnapshot",'{}'::jsonb) ? 'blingNfe')
            )
          )
        ORDER BY f."updatedAt" ASC
        LIMIT 1`,
    );
    const row = rows[0];
    if (!row) return { processed: false, reason: "EMPTY" };

    try {
      const detail = await this.bling.request(
        row.companyId,
        `/nfe/${encodeURIComponent(row.externalId)}`,
        { method: "GET" },
      );
      let note = detail?.data ?? detail ?? {};
      let status = this.fiscalStatus(note?.situacao);
      let retrySnapshot: Record<string, unknown> = {};
      const storedSefaz = this.sefazAuthorization(row.payloadSnapshot?.blingSend);
      if (storedSefaz.status !== "SENT") {
        status = storedSefaz.status;
        retrySnapshot = {
          sefazStatusCode: storedSefaz.code,
          sefazMessage: storedSefaz.message,
        };
      }

      if (status === "SENT" && this.fiscalStatusCode(note?.situacao) === 1) {
        const retry = this.authorizationRetry(row.payloadSnapshot);
        if (retry.allowed) {
          const requestedAt = new Date().toISOString();
          let sendResult: unknown = null;
          let authorizationLastError: string | null = null;
          let sefazStatusCode: number | null = null;
          let sefazMessage: string | null = null;
          try {
            sendResult = await this.bling.request(
              row.companyId,
              `/nfe/${encodeURIComponent(row.externalId)}/enviar?enviarEmail=false`,
              { method: "POST" },
            );
            const sefaz = this.sefazAuthorization(sendResult);
            sefazStatusCode = sefaz.code;
            sefazMessage = sefaz.message;
            const refreshed = await this.bling.request(
              row.companyId,
              `/nfe/${encodeURIComponent(row.externalId)}`,
              { method: "GET" },
            );
            note = refreshed?.data ?? refreshed ?? note;
            status =
              sefaz.status === "SENT" ? this.fiscalStatus(note?.situacao) : sefaz.status;
          } catch (error) {
            authorizationLastError = error instanceof Error ? error.message : String(error);
          }
          retrySnapshot = {
            authorizationAttemptCount: retry.count + 1,
            authorizationRequestedAt: requestedAt,
            blingSend: sendResult,
            authorizationLastError,
            sefazStatusCode,
            sefazMessage,
          };
        }
      }
      const accessKey = String(note?.chaveAcesso ?? note?.chave ?? "").trim() || null;
      const number = note?.numero == null ? null : String(note.numero);
      const series = note?.serie == null ? null : String(note.serie);

      await this.database.$executeRawUnsafe(
        `UPDATE "FiscalDocument"
            SET status=$2,number=COALESCE($3,number),series=COALESCE($4,series),
                "accessKey"=COALESCE($5,"accessKey"),
                "payloadSnapshot"=COALESCE("payloadSnapshot",'{}'::jsonb) || $6::jsonb,
                "updatedAt"=NOW()
          WHERE id=$1`,
        row.id,
        status,
        number,
        series,
        accessKey,
        JSON.stringify({
          blingNfe: note,
          reconciledAt: new Date().toISOString(),
          ...retrySnapshot,
        }),
      );

      let fulfillment: any = null;
      let fulfillmentError: string | null = null;
      if (status === "AUTHORIZED" && row.salesOrderId) {
        await this.database.$executeRawUnsafe(
          `UPDATE "SalesOrder"
              SET status='INVOICED',"invoicedAt"=COALESCE("invoicedAt",NOW()),"updatedAt"=NOW()
            WHERE id=$1 AND status IN ('READY_TO_SHIP','INVOICED')`,
          row.salesOrderId,
        );
        await this.customerLifecycle.record(
          row.salesOrderId,
          "INVOICE_AUTHORIZED",
          "Nota fiscal emitida",
          "A nota fiscal do seu pedido foi autorizada e a expedição será preparada.",
          "BLING",
          `sales-order:invoice-authorized:${row.salesOrderId}`,
          { fiscalId: row.id, externalId: row.externalId, accessKey, number, series },
        );
        const shippingRows = await this.database.$queryRawUnsafe<any[]>(
          `SELECT "shippingProvider","shippingQuoteId" FROM "SalesOrder" WHERE id=$1 LIMIT 1`,
          row.salesOrderId,
        );
        if (
          shippingRows[0]?.shippingProvider === "MELHOR_ENVIO" &&
          shippingRows[0]?.shippingQuoteId
        ) {
          try {
            fulfillment = await this.shipment.createLabelForSalesOrder(row.salesOrderId);
          } catch (error) {
            fulfillmentError = error instanceof Error ? error.message : String(error);
          }
        }
      }

      return {
        processed: true,
        fiscalId: row.id,
        externalId: row.externalId,
        status,
        number,
        series,
        accessKey,
        fulfillment,
        fulfillmentError,
      };
    } catch (error) {
      return {
        processed: false,
        fiscalId: row.id,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async retrySalesOrderInvoice(companyId: string, orderId: string) {
    const rows = await this.database.$queryRawUnsafe<any[]>(
      `SELECT so.id,so.status,c."taxId" FROM "SalesOrder" so JOIN "Customer" c ON c.id=so."customerId" WHERE so.id=$1 AND so."companyId"=$2 LIMIT 1`,
      orderId, companyId,
    );
    const row = rows[0];
    if (!row) throw new Error("Pedido não encontrado.");
    const document = String(row.taxId ?? "").replace(/\D/g, "");
    if (!document) throw new Error("Reprocessamento fiscal bloqueado: cliente sem CPF/CNPJ.");
    await this.database.$executeRawUnsafe(
      `DELETE FROM "IntegrationResourceMap" WHERE "companyId"=$1 AND provider='BLING' AND "resourceType" IN ('CONTACT_DOCUMENT','SALES_ORDER') AND ("internalKey"=$2 OR "internalKey"=$3)`,
      companyId, document, orderId,
    );
    await this.database.$executeRawUnsafe(
      `UPDATE "IntegrationOutbox" SET status='PENDING',attempts=0,"lastError"=NULL,"nextAttemptAt"=NULL,"updatedAt"=NOW() WHERE "companyId"=$1 AND "aggregateId"=$2 AND "eventType"='SALES_ORDER_INVOICE_REQUESTED'`,
      companyId, orderId,
    );
    return this.processNext(companyId);
  }

  async resetCancelledSalesOrderInvoice(companyId: string, orderId: string) {
    const rows = await this.database.$queryRawUnsafe<any[]>(
      `SELECT so.id,so.status,c."taxId",f.id AS "fiscalId",f."externalId",f.number
         FROM "SalesOrder" so JOIN "Customer" c ON c.id=so."customerId"
         JOIN "FiscalDocument" f ON f."salesOrderId"=so.id AND f.direction='OUTBOUND'
        WHERE so.id=$1 AND so."companyId"=$2 ORDER BY f."createdAt" DESC LIMIT 1`, orderId, companyId);
    const row = rows[0];
    if (!row?.externalId) throw new Error("Pedido sem NF-e do Bling para reconciliar.");
    const detail = await this.bling.request(companyId, `/nfe/${encodeURIComponent(row.externalId)}`, { method: "GET" });
    const note = detail?.data ?? detail ?? {};
    const remoteStatus = this.fiscalStatus(note?.situacao);
    const remoteStatusText = String(note?.situacao?.nome ?? note?.situacao?.descricao ?? note?.situacao ?? "").toLowerCase();
    const cancelled = remoteStatus === "CANCELLED" || remoteStatusText.includes("cancel");
    if (!cancelled) throw new Error(`A NF-e ainda não consta como cancelada no Bling (situação retornada: ${remoteStatusText || "não informada"}).`);
    await this.database.$executeRawUnsafe(`UPDATE "FiscalDocument" SET status='CANCELLED',"payloadSnapshot"=COALESCE("payloadSnapshot",'{}'::jsonb)||$2::jsonb,"updatedAt"=NOW() WHERE id=$1`, row.fiscalId, JSON.stringify({ cancellationReconciledAt: new Date().toISOString(), blingNfe: note }));
    await this.database.$executeRawUnsafe(`UPDATE "SalesOrder" SET status='READY_TO_SHIP',"invoicedAt"=NULL,"updatedAt"=NOW() WHERE id=$1`, orderId);
    await this.database.$executeRawUnsafe(`DELETE FROM "IntegrationResourceMap" WHERE "companyId"=$1 AND provider='BLING' AND "resourceType"='SALES_ORDER' AND "internalKey"=$2`, companyId, orderId);
    await this.database.$executeRawUnsafe(`UPDATE "IntegrationOutbox" SET status='PENDING',attempts=0,"lastError"=NULL,"nextAttemptAt"=NULL,"updatedAt"=NOW() WHERE "companyId"=$1 AND "aggregateId"=$2 AND "eventType"='SALES_ORDER_INVOICE_REQUESTED'`, companyId, orderId);
    return { reset: true, fiscalStatus: "CANCELLED", orderStatus: "READY_TO_SHIP", customerTaxId: row.taxId };
  }

  async processNext(companyId?: string) {
    await this.reconcileSentInvoice();
    const rows = await this.database.$queryRawUnsafe<any[]>(
      `WITH candidate AS (
         SELECT id FROM "IntegrationOutbox"
          WHERE provider='BLING' AND status IN ('PENDING','FAILED')
            AND (
              "nextAttemptAt" IS NULL OR "nextAttemptAt" <= NOW()
              OR (
                status='FAILED'
                AND "eventType"='SALES_ORDER_INVOICE_REQUESTED'
                AND (
                  "lastError" LIKE '%A data para geração das parcelas é inválida%'
                  OR "lastError" LIKE '%A nota deve ter ao menos um item%'
                  OR "lastError" = 'Bling não retornou o ID da NF-e criada.'
                )
              )
              OR (
                status='FAILED'
                AND "eventType"='FISCAL_DOCUMENT_READY'
                AND "aggregateType"='FISCAL_DOCUMENT'
                AND "lastError" LIKE 'Evento Bling ainda não implementado:%'
              )
            )
            AND ($1::text IS NULL OR "companyId"=$1)
          ORDER BY "createdAt" ASC
          FOR UPDATE SKIP LOCKED LIMIT 1
       )
       UPDATE "IntegrationOutbox" o
          SET status='PROCESSING',attempts=o.attempts+1,"lastError"=NULL,"updatedAt"=NOW()
         FROM candidate WHERE o.id=candidate.id
       RETURNING o.id,o."companyId",o."eventType",o."aggregateType",o."aggregateId",o.payload,o.attempts`,
      companyId ?? null,
    );
    const row = rows[0];
    if (!row) return { processed: false, reason: "EMPTY" };

    try {
      let result: any;
      if (row.eventType === "STOREFRONT_ORDER_PAID" && row.aggregateType === "STOREFRONT_ORDER") {
        result = await this.processStorefrontPaid(row);
      } else if (
        row.eventType === "SALES_ORDER_INVOICE_REQUESTED" &&
        row.aggregateType === "SALES_ORDER"
      ) {
        result = await this.processSalesOrderInvoice(row);
      } else if (
        row.eventType === "FISCAL_DOCUMENT_READY" &&
        row.aggregateType === "FISCAL_DOCUMENT"
      ) {
        result = await this.processLegacyFiscalReady(row);
      } else {
        throw new Error(`Evento Bling ainda não implementado: ${row.eventType}/${row.aggregateType}`);
      }
      await this.database.$executeRawUnsafe(
        `UPDATE "IntegrationOutbox" SET status='SENT',"lastError"=NULL,"nextAttemptAt"=NULL,"updatedAt"=NOW() WHERE id=$1`,
        row.id,
      );
      return { processed: true, outboxId: row.id, eventType: row.eventType, result };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const attempts = Number(row.attempts ?? 1);
      const retryMinutes = Math.min(60, Math.max(2, 2 ** Math.min(attempts, 5)));
      await this.database.$executeRawUnsafe(
        `UPDATE "IntegrationOutbox"
         SET status='FAILED',"lastError"=$2,"nextAttemptAt"=NOW() + ($3 || ' minutes')::interval,"updatedAt"=NOW()
         WHERE id=$1`,
        row.id,
        message.slice(0, 2000),
        String(retryMinutes),
      );
      return { processed: true, outboxId: row.id, failed: true, error: message };
    }
  }
}
