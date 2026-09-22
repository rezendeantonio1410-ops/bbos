import { Injectable } from "@nestjs/common";
import { PrismaClient } from "@bbos/database";
import { createHash } from "node:crypto";
import { BlingService } from "./bling.service";
import { StorefrontLifecycleService } from "../../storefront-lifecycle.service";

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
        if (list[0]?.id) return String(list[0].id);
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
    if (existing?.externalId) return existing.externalId as string;

    const remoteId = await this.findContactByDocument(companyId, document);
    if (remoteId) {
      await this.mapResource(companyId, "CONTACT_DOCUMENT", document, remoteId, {
        email: customer?.email,
        source: "FOUND_BY_DOCUMENT",
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
      const addressMatch = rawAddress.match(/^(.*?)(?:,|\s)+(\d+[A-Za-z0-9\/-]*)\s*$/);
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
    if (
      priorFiscal[0]?.externalId &&
      ["SENT", "AUTHORIZED"].includes(String(priorFiscal[0]?.status))
    ) {
      return {
        blingOrderId: salesMap.externalId,
        fiscalId: priorFiscal[0].id,
        blingNfeId: priorFiscal[0].externalId,
        idempotent: true,
      };
    }

    const nfeResult = await this.bling.request(
      row.companyId,
      `/pedidos/vendas/${encodeURIComponent(salesMap.externalId)}/gerar-nfe`,
      { method: "POST" },
    );
    const blingNfeId = String(nfeResult?.data?.id ?? nfeResult?.id ?? "");
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

    await this.bling.request(
      row.companyId,
      `/nfe/${encodeURIComponent(blingNfeId)}/enviar?enviarEmail=false`,
      { method: "POST" },
    );

    return {
      blingOrderId: salesMap.externalId,
      fiscalId,
      blingNfeId,
      idempotent: false,
    };
  }

  async processNext(companyId?: string) {
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
                )
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
