import { Injectable } from "@nestjs/common";
import { PrismaClient } from "@bbos/database";
import { createHash } from "node:crypto";
import { BlingService } from "./bling.service";

function stableId(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

@Injectable()
export class BlingOutboxService {
  private readonly database = new PrismaClient();

  constructor(private readonly bling: BlingService) {}

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

  private async ensureContact(companyId: string, customer: any, delivery: any) {
    const document = String(customer?.cpf ?? "").replace(/\D/g, "");
    if (!document) throw new Error("Pedido e-commerce sem CPF para integração Bling.");

    const existing = await this.getMap(companyId, "CONTACT_DOCUMENT", document);
    if (existing?.externalId) return existing.externalId as string;

    const payload = await this.bling.request(companyId, "/contatos", {
      method: "POST",
      body: JSON.stringify({
        nome: customer?.name,
        tipo: "F",
        numeroDocumento: document,
        email: customer?.email,
        celular: customer?.phone,
        endereco: {
          geral: {
            endereco: delivery?.street,
            numero: delivery?.number,
            complemento: delivery?.complement,
            bairro: delivery?.district,
            cep: delivery?.postalCode,
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
    if (prior?.externalId) return { externalId: prior.externalId, idempotent: true };

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
    return { externalId, idempotent: false };
  }

  async processNext(companyId?: string) {
    const rows = await this.database.$queryRawUnsafe<any[]>(
      `SELECT id,"companyId","eventType","aggregateType","aggregateId",payload,attempts
       FROM "IntegrationOutbox"
       WHERE provider='BLING' AND status IN ('PENDING','FAILED')
         AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= NOW())
         AND ($1::text IS NULL OR "companyId"=$1)
       ORDER BY "createdAt" ASC
       LIMIT 1`,
      companyId ?? null,
    );
    const row = rows[0];
    if (!row) return { processed: false, reason: "EMPTY" };

    await this.database.$executeRawUnsafe(
      `UPDATE "IntegrationOutbox" SET status='PROCESSING',attempts=attempts+1,"lastError"=NULL,"updatedAt"=NOW() WHERE id=$1`,
      row.id,
    );

    try {
      let result: any;
      if (row.eventType === "STOREFRONT_ORDER_PAID" && row.aggregateType === "STOREFRONT_ORDER") {
        result = await this.processStorefrontPaid(row);
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
      const attempts = Number(row.attempts ?? 0) + 1;
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
