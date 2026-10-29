import { Injectable } from "@nestjs/common";
import { prisma } from "@bbos/database";
import { createHash } from "node:crypto";
import { BlingService } from "./bling.service";
import { StorefrontLifecycleService } from "../../storefront-lifecycle.service";
import { MelhorEnvioShipmentService } from "../../melhor-envio-shipment.service";
import { SalesOrderCustomerLifecycleService } from "../../sales-order-customer-lifecycle.service";
import {
  SAMPLE_FISCAL_PACKAGE_VALUE,
  sampleFiscalPrice,
} from "../../sales-order-sample-policy";
import { customerFiscalReadinessMessage } from "../../customer-fiscal-readiness";
import { BlingCatalogSyncService } from "./bling-catalog-sync.service";
import {
  sampleCfopIsApplied,
  sampleNatureIsApplied,
  type SampleFiscalRoute,
} from "../../sample-fiscal-route";
import type { ExportFiscalRoute } from "../../export-fiscal-route";

function stableId(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function toBlingDate(value: unknown) {
  const parsed = value instanceof Date ? value : new Date(String(value ?? ""));
  const resolved = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  return resolved.toISOString().slice(0, 10);
}

function toBlingDateTime(value: unknown) {
  const raw = String(value ?? "")
    .trim()
    .replace("T", " ")
    .replace(/Z$/, "")
    .replace(/([+-]\d{2}:?\d{2})$/, "")
    .slice(0, 19);
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw)) return raw;
  return `${toBlingDate(value)} 00:00:00`;
}

function currentBlingDateTime() {
  return new Date().toLocaleString("sv-SE", {
    timeZone: "America/Sao_Paulo",
    hour12: false,
  });
}

function isBlingNotFound(error: unknown) {
  return (
    error instanceof Error &&
    /Bling API 404(?:\s+\([^)]*\))?:/.test(error.message)
  );
}

function isBlingSalesOrderInvoiceAlreadyGenerated(error: unknown) {
  return (
    error instanceof Error &&
    (/"code":24/.test(error.message) ||
      /nota fiscal do pedido já foi gerada/i.test(error.message))
  );
}

@Injectable()
export class BlingOutboxService {
  private readonly database = prisma;

  constructor(
    private readonly bling: BlingService,
    private readonly lifecycle: StorefrontLifecycleService,
    private readonly shipment: MelhorEnvioShipmentService,
    private readonly customerLifecycle: SalesOrderCustomerLifecycleService,
    private readonly blingCatalogSync: BlingCatalogSyncService,
  ) {}

  private async ensureSampleNatureOnSalesOrder(
    companyId: string,
    salesOrderId: string,
    route: SampleFiscalRoute,
  ) {
    const path = `/pedidos/vendas/${encodeURIComponent(salesOrderId)}`;
    const readRemoteOrder = async () => {
      const detail = await this.bling.request(companyId, path, {
        method: "GET",
      });
      return detail?.data ?? detail ?? {};
    };

    let remoteOrder = await readRemoteOrder();
    if (sampleNatureIsApplied(remoteOrder?.itens, route.natureOperationId)) {
      return remoteOrder;
    }
    if (!Array.isArray(remoteOrder?.itens) || !remoteOrder.itens.length) {
      throw new Error(
        "Emissão de amostra bloqueada: o pedido do Bling não possui itens para aplicar a natureza fiscal.",
      );
    }

    // Bling's sales-order endpoint only supports full updates through PUT.
    // Start from the remote representation so fiscal routing does not erase
    // contact, shipping, installments, dates, or any operator-entered detail.
    const updatePayload = {
      ...remoteOrder,
      dataSaida: remoteOrder?.dataSaida ?? remoteOrder?.data,
      dataPrevista: remoteOrder?.dataPrevista ?? remoteOrder?.data,
      parcelas: Array.isArray(remoteOrder?.parcelas)
        ? remoteOrder.parcelas
        : [],
      itens: remoteOrder.itens.map((item: any) => ({
        ...item,
        naturezaOperacao: { id: Number(route.natureOperationId) },
      })),
    };
    delete updatePayload.id;
    delete updatePayload.total;
    delete updatePayload.totalProdutos;

    await this.bling.request(companyId, path, {
      method: "PUT",
      body: JSON.stringify(updatePayload),
    });
    remoteOrder = await readRemoteOrder();
    if (!sampleNatureIsApplied(remoteOrder?.itens, route.natureOperationId)) {
      throw new Error(
        `Emissão de amostra bloqueada: o Bling não confirmou a natureza de operação ${route.natureOperationName ?? route.natureOperationId} nos itens do pedido.`,
      );
    }
    return remoteOrder;
  }

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

  private async getMap(
    companyId: string,
    resourceType: string,
    internalKey: string,
  ) {
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

  private normalizeFiscalIdentity(value: unknown) {
    return String(value ?? "")
      .replace(/[^A-Z0-9]/gi, "")
      .toUpperCase();
  }

  private blingStateRegistrationIndicator(customer: any) {
    if (customer?.stateRegistrationType === "NUMBER") return 1;
    if (customer?.stateRegistrationType === "EXEMPT") return 2;
    return 9;
  }

  private blingContactPayload(
    remote: any,
    customer: any,
    delivery: any,
    document: string,
  ) {
    const isForeign =
      String(customer?.countryCode ?? "BR").toUpperCase() !== "BR";
    const phone = this.normalizeBlingPhone(customer?.phone);
    const stateRegistrationType = String(
      customer?.stateRegistrationType ?? "NON_TAXPAYER",
    );
    const payload = {
      ...(remote && typeof remote === "object" ? remote : {}),
      nome:
        !isForeign && document.length === 14
          ? customer?.legalName || customer?.name
          : customer?.name,
      tipo: isForeign ? "E" : document.length === 11 ? "F" : "J",
      situacao: "A",
      numeroDocumento: document,
      indicadorIe: this.blingStateRegistrationIndicator(
        isForeign ? { stateRegistrationType: "NON_TAXPAYER" } : customer,
      ),
      ie: isForeign
        ? undefined
        : stateRegistrationType === "NUMBER"
          ? customer?.stateRegistration || undefined
          : stateRegistrationType === "EXEMPT"
            ? "ISENTO"
            : undefined,
      email: customer?.email,
      emailNotaFiscal: customer?.email,
      celular: phone || undefined,
      endereco: {
        ...(remote?.endereco ?? {}),
        geral: {
          ...(remote?.endereco?.geral ?? {}),
          endereco: delivery?.street,
          numero: delivery?.number,
          complemento: delivery?.complement,
          bairro: delivery?.district,
          cep: isForeign
            ? String(delivery?.postalCode ?? "").trim()
            : String(delivery?.postalCode ?? "").replace(/\D/g, ""),
          municipio: delivery?.city,
          uf: isForeign ? "EX" : delivery?.state,
        },
      },
      ...(isForeign ? { pais: { nome: customer?.countryName } } : {}),
    };
    delete payload.id;
    return payload;
  }

  private async syncBlingContact(
    companyId: string,
    contactId: string,
    remote: any,
    customer: any,
    delivery: any,
    document: string,
  ) {
    await this.bling.request(
      companyId,
      `/contatos/${encodeURIComponent(contactId)}`,
      {
        method: "PUT",
        body: JSON.stringify(
          this.blingContactPayload(remote, customer, delivery, document),
        ),
      },
    );
    return contactId;
  }

  private sampleInvoiceItemPayload(item: any) {
    return {
      codigo: String(item?.codigo ?? "").trim(),
      descricao: String(item?.descricao ?? "").trim() || undefined,
      unidade: String(item?.unidade ?? "UN").trim() || "UN",
      quantidade: Number(item?.quantidade ?? 0),
      valor: Number(item?.valor ?? 0),
      tipo: item?.tipo === "S" ? "S" : "P",
      pesoBruto: item?.pesoBruto == null ? undefined : Number(item.pesoBruto),
      pesoLiquido:
        item?.pesoLiquido == null ? undefined : Number(item.pesoLiquido),
      numeroPedidoCompra:
        String(item?.numeroPedidoCompra ?? "").trim() || undefined,
      classificacaoFiscal:
        String(item?.classificacaoFiscal ?? "").trim() || undefined,
      cest: String(item?.cest ?? "").trim() || undefined,
      codigoServico: String(item?.codigoServico ?? "").trim() || undefined,
      origem: item?.origem == null ? undefined : Number(item.origem),
      informacoesAdicionais:
        String(item?.informacoesAdicionais ?? "").trim() || undefined,
      unidadeTributavel: item?.unidadeTributavel ?? undefined,
    };
  }

  private async repairInvoiceRecipient(
    companyId: string,
    blingNfeId: string,
    fiscalDraft: any,
    order: any,
    route?: SampleFiscalRoute | null,
  ) {
    const document = String(order?.customerTaxId ?? "").replace(/\D/g, "");
    const items = Array.isArray(fiscalDraft?.itens)
      ? fiscalDraft.itens.map((item: any) =>
          this.sampleInvoiceItemPayload(item),
        )
      : [];
    if (!items.length || items.some((item: any) => !item.codigo)) {
      throw new Error(
        "Emissão fiscal bloqueada: o rascunho da NF-e não possui itens válidos para corrigir o destinatário.",
      );
    }

    const stateRegistrationType = String(
      order?.customerStateRegistrationType ?? "NON_TAXPAYER",
    );
    const phone = this.normalizeBlingPhone(order?.customerPhone);
    const originalOperationDate = fiscalDraft?.dataOperacao ?? new Date();
    const payload = {
      tipo: Number(fiscalDraft?.tipo ?? 1),
      numero: String(fiscalDraft?.numero ?? "").trim(),
      dataOperacao: currentBlingDateTime(),
      contato: {
        nome:
          document.length === 14
            ? order?.customerLegalName || order?.customerName
            : order?.customerName,
        tipoPessoa: document.length === 14 ? "J" : "F",
        numeroDocumento: document,
        contribuinte: this.blingStateRegistrationIndicator({
          stateRegistrationType,
        }),
        ie:
          stateRegistrationType === "NUMBER"
            ? order?.customerStateRegistration || undefined
            : stateRegistrationType === "EXEMPT"
              ? "ISENTO"
              : undefined,
        telefone: phone || undefined,
        email: order?.customerEmail || undefined,
        endereco: {
          endereco: order?.customerAddress,
          numero: order?.customerAddressNumber || undefined,
          complemento: order?.customerAddressComplement || undefined,
          bairro: order?.customerDistrict,
          cep: String(order?.customerPostalCode ?? "").replace(/\D/g, ""),
          municipio: order?.customerCity,
          uf: order?.customerState,
        },
      },
      ...(route?.natureOperationId
        ? { naturezaOperacao: { id: Number(route.natureOperationId) } }
        : Number(fiscalDraft?.naturezaOperacao?.id ?? 0) > 0
          ? {
              naturezaOperacao: {
                id: Number(fiscalDraft.naturezaOperacao.id),
              },
            }
          : {}),
      ...(Number(fiscalDraft?.loja?.id ?? 0) > 0
        ? { loja: { id: Number(fiscalDraft.loja.id) } }
        : {}),
      finalidade: Number(fiscalDraft?.finalidade ?? 1),
      seguro:
        fiscalDraft?.seguro == null ? undefined : Number(fiscalDraft.seguro),
      despesas:
        fiscalDraft?.despesas == null
          ? undefined
          : Number(fiscalDraft.despesas),
      desconto:
        fiscalDraft?.desconto == null
          ? undefined
          : Number(fiscalDraft.desconto),
      observacoes:
        String(fiscalDraft?.observacoes ?? "").trim() ||
        (route
          ? `REMESSA DE AMOSTRA SEM VALOR COMERCIAL | BBOS: ${order.code}`
          : `PEDIDO COMERCIAL | BBOS: ${order.code}`),
      itens: items,
      parcelas: Array.isArray(fiscalDraft?.parcelas)
        ? fiscalDraft.parcelas.map((installment: any) => ({
            data: installment?.data,
            valor: Number(installment?.valor ?? 0),
            observacoes: installment?.observacoes || undefined,
            caut: installment?.caut || undefined,
            formaPagamento:
              Number(installment?.formaPagamento?.id ?? 0) > 0
                ? { id: Number(installment.formaPagamento.id) }
                : undefined,
          }))
        : [],
    };

    const operationDates = [
      String(originalOperationDate ?? "").trim(),
      currentBlingDateTime(),
      toBlingDateTime(originalOperationDate),
      new Date().toISOString(),
      toBlingDate(new Date()),
      toBlingDate(originalOperationDate),
    ].filter(
      (value, index, values) =>
        Boolean(value) && values.indexOf(value) === index,
    );
    let updateError: unknown = null;
    for (const dataOperacao of operationDates) {
      try {
        await this.bling.request(
          companyId,
          `/nfe/${encodeURIComponent(blingNfeId)}`,
          {
            method: "PUT",
            body: JSON.stringify({ ...payload, dataOperacao }),
          },
        );
        updateError = null;
        break;
      } catch (error) {
        updateError = error;
        if (!/Data de operação inválida/i.test(String(error))) throw error;
      }
    }
    if (updateError) throw updateError;
    const updated = await this.bling.request(
      companyId,
      `/nfe/${encodeURIComponent(blingNfeId)}`,
      { method: "GET" },
    );
    const updatedDraft = updated?.data ?? updated ?? {};
    if (route && !sampleCfopIsApplied(updatedDraft?.itens, route.cfop)) {
      throw new Error(
        `Emissão de amostra bloqueada: ao corrigir consumidor final, o Bling não preservou o CFOP ${route.cfop}.`,
      );
    }
    const updatedStateRegistration = String(
      updatedDraft?.contato?.ie ?? updatedDraft?.destinatario?.ie ?? "",
    ).trim();
    if (
      stateRegistrationType === "NUMBER" &&
      updatedStateRegistration !==
        String(order?.customerStateRegistration ?? "").trim()
    ) {
      throw new Error(
        "Emissão fiscal bloqueada: o Bling não confirmou a inscrição estadual do destinatário no rascunho da NF-e.",
      );
    }
    if (
      stateRegistrationType === "EXEMPT" &&
      updatedStateRegistration.toUpperCase() !== "ISENTO"
    ) {
      throw new Error(
        "Emissão fiscal bloqueada: o Bling não confirmou o destinatário como isento de inscrição estadual no rascunho da NF-e.",
      );
    }
    return updatedDraft;
  }

  private async repairExportInvoice(
    companyId: string,
    blingNfeId: string,
    fiscalDraft: any,
    order: any,
    route: ExportFiscalRoute,
  ) {
    const items = Array.isArray(fiscalDraft?.itens)
      ? fiscalDraft.itens.map((item: any) =>
          this.sampleInvoiceItemPayload(item),
        )
      : [];
    if (!items.length || items.some((item: any) => !item.codigo)) {
      throw new Error(
        "Emissão de exportação bloqueada: o rascunho da NF-e não possui itens válidos.",
      );
    }
    const foreignTaxId = String(order.customerForeignTaxId ?? "").trim();
    if (!foreignTaxId) {
      throw new Error(
        "Emissão de exportação bloqueada: identificação fiscal estrangeira ausente.",
      );
    }
    const payload = {
      tipo: 1,
      numero: String(fiscalDraft?.numero ?? "").trim(),
      dataOperacao: currentBlingDateTime(),
      operacaoComExterior: true,
      exportacao: {
        localEmbarque: route.departureLocation,
        ufEmbarque: route.departureState,
      },
      contato: {
        nome: order.customerLegalName || order.customerName,
        tipoPessoa: "E",
        numeroDocumento: foreignTaxId,
        contribuinte: 9,
        telefone: order.customerPhone || undefined,
        email: order.customerEmail || undefined,
        endereco: {
          endereco: order.customerAddress,
          numero: order.customerAddressNumber || undefined,
          complemento: order.customerAddressComplement || undefined,
          bairro: order.customerDistrict,
          cep: String(order.customerPostalCode ?? "").trim() || undefined,
          municipio: order.customerCity,
          uf: "EX",
          pais: order.customerCountryName,
        },
      },
      naturezaOperacao: { id: Number(route.natureOperationId) },
      ...(Number(fiscalDraft?.loja?.id ?? 0) > 0
        ? { loja: { id: Number(fiscalDraft.loja.id) } }
        : {}),
      finalidade: Number(fiscalDraft?.finalidade ?? 1),
      seguro:
        fiscalDraft?.seguro == null ? undefined : Number(fiscalDraft.seguro),
      despesas:
        fiscalDraft?.despesas == null
          ? undefined
          : Number(fiscalDraft.despesas),
      desconto:
        fiscalDraft?.desconto == null
          ? undefined
          : Number(fiscalDraft.desconto),
      observacoes: [
        String(fiscalDraft?.observacoes ?? "").trim(),
        `EXPORTAÇÃO | ${order.currency} 1 = BRL ${Number(order.exchangeRateToBrl).toFixed(6)} | Câmbio: ${toBlingDate(order.exchangeRateDate)} | ${order.incoterm} ${order.incotermLocation} | BBOS: ${order.code}`,
      ]
        .filter(Boolean)
        .join(" | "),
      itens: items,
      parcelas: Array.isArray(fiscalDraft?.parcelas)
        ? fiscalDraft.parcelas.map((installment: any) => ({
            data: installment?.data,
            valor: Number(installment?.valor ?? 0),
            observacoes: installment?.observacoes || undefined,
            caut: installment?.caut || undefined,
            formaPagamento:
              Number(installment?.formaPagamento?.id ?? 0) > 0
                ? { id: Number(installment.formaPagamento.id) }
                : undefined,
          }))
        : [],
    };
    await this.bling.request(
      companyId,
      `/nfe/${encodeURIComponent(blingNfeId)}`,
      { method: "PUT", body: JSON.stringify(payload) },
    );
    const updated = await this.bling.request(
      companyId,
      `/nfe/${encodeURIComponent(blingNfeId)}`,
      { method: "GET" },
    );
    const updatedDraft = updated?.data ?? updated ?? {};
    if (!sampleCfopIsApplied(updatedDraft?.itens, route.cfop)) {
      throw new Error(
        `Emissão de exportação bloqueada antes da SEFAZ: o rascunho não recebeu o CFOP ${route.cfop}. Revise a natureza de exportação no Bling.`,
      );
    }
    return updatedDraft;
  }

  private async findContactByDocument(companyId: string, document: string) {
    const expected = this.normalizeFiscalIdentity(document);
    const paths = [
      `/contatos?numeroDocumento=${encodeURIComponent(document)}`,
      `/contatos?criterio=${encodeURIComponent(document)}`,
    ];
    for (const path of paths) {
      try {
        const result = await this.bling.request(companyId, path, {
          method: "GET",
        });
        const list = Array.isArray(result?.data) ? result.data : [];
        const exact = list.find(
          (contact: any) =>
            String(
              contact?.numeroDocumento ?? contact?.cnpj ?? contact?.cpf ?? "",
            ) &&
            this.normalizeFiscalIdentity(
              contact?.numeroDocumento ?? contact?.cnpj ?? contact?.cpf ?? "",
            ) === expected,
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
    const isForeign =
      String(customer?.countryCode ?? "BR").toUpperCase() !== "BR";
    const document = isForeign
      ? String(customer?.foreignTaxId ?? "").trim()
      : String(customer?.cpf ?? customer?.taxId ?? "").replace(/\D/g, "");
    if (!document)
      throw new Error(
        isForeign
          ? "Pedido internacional sem identificação fiscal estrangeira para integração Bling."
          : "Pedido sem CPF/CNPJ para integração Bling.",
      );
    const fiscalIdentity = this.normalizeFiscalIdentity(document);
    const mapKey = isForeign
      ? `${String(customer.countryCode).toUpperCase()}:${fiscalIdentity}`
      : fiscalIdentity;

    const existing = await this.getMap(companyId, "CONTACT_DOCUMENT", mapKey);
    if (existing?.externalId) {
      const detail = await this.bling
        .request(
          companyId,
          `/contatos/${encodeURIComponent(existing.externalId)}`,
          { method: "GET" },
        )
        .catch(() => null);
      const remote = detail?.data ?? detail ?? {};
      const remoteDocument = this.normalizeFiscalIdentity(
        remote?.numeroDocumento ?? remote?.cnpj ?? remote?.cpf ?? "",
      );
      if (remoteDocument === fiscalIdentity) {
        return this.syncBlingContact(
          companyId,
          String(existing.externalId),
          remote,
          customer,
          delivery,
          document,
        );
      }
      await this.database.$executeRawUnsafe(
        `DELETE FROM "IntegrationResourceMap" WHERE "companyId"=$1 AND provider='BLING' AND "resourceType"='CONTACT_DOCUMENT' AND "internalKey"=$2`,
        companyId,
        mapKey,
      );
    }

    // Always resolve the contact fresh by fiscal document after a stale mapping is discarded.
    const remoteId = await this.findContactByDocument(companyId, document);
    if (remoteId) {
      const detail = await this.bling
        .request(companyId, `/contatos/${encodeURIComponent(remoteId)}`, {
          method: "GET",
        })
        .catch(() => null);
      const remote = detail?.data ?? detail ?? {};
      const remoteDocument = this.normalizeFiscalIdentity(
        remote?.numeroDocumento ?? remote?.cnpj ?? remote?.cpf ?? "",
      );
      if (remoteDocument !== fiscalIdentity)
        throw new Error(
          "Emissão fiscal bloqueada: o contato localizado no Bling possui CPF/CNPJ diferente do cliente do pedido.",
        );
      await this.mapResource(companyId, "CONTACT_DOCUMENT", mapKey, remoteId, {
        email: customer?.email,
        source: "FOUND_BY_DOCUMENT_VERIFIED",
      });
      return this.syncBlingContact(
        companyId,
        remoteId,
        remote,
        customer,
        delivery,
        document,
      );
    }

    const payload = await this.bling.request(companyId, "/contatos", {
      method: "POST",
      body: JSON.stringify(
        this.blingContactPayload({}, customer, delivery, document),
      ),
    });
    const externalId = String(payload?.data?.id ?? payload?.id ?? "");
    if (!externalId)
      throw new Error("Bling criou/recebeu contato sem retornar ID.");
    await this.mapResource(companyId, "CONTACT_DOCUMENT", mapKey, externalId, {
      email: customer?.email,
    });
    return externalId;
  }

  private async productExternalId(companyId: string, item: any) {
    const variantId = String(item?.variantId ?? item?.id ?? "").trim();
    const slug = String(item?.slug ?? item?.legacyId ?? "").trim();
    const sku = String(item?.sku ?? "")
      .trim()
      .toUpperCase();
    if (!variantId)
      throw new Error("Item e-commerce sem identificador interno.");
    const mappings = await this.database.$queryRawUnsafe<any[]>(
      `SELECT "externalId",metadata
         FROM "IntegrationResourceMap"
        WHERE "companyId"=$1 AND provider='BLING'
          AND "resourceType"='STOREFRONT_PRODUCT'
          AND (
            "internalKey"=$2
            OR metadata->>'productVariantId'=$2
            OR ($3 <> '' AND UPPER(COALESCE(metadata->>'sku',''))=$3)
            OR (
              $4 <> '' AND "internalKey"=$4
              AND (metadata->>'sku' IS NULL OR UPPER(metadata->>'sku')=$3)
            )
          )
        ORDER BY CASE
          WHEN "internalKey"=$2 THEN 0
          WHEN metadata->>'productVariantId'=$2 THEN 1
          WHEN UPPER(COALESCE(metadata->>'sku',''))=$3 THEN 2
          ELSE 3
        END
        LIMIT 1`,
      companyId,
      variantId,
      sku,
      slug,
    );
    const mapping = mappings[0];
    if (!mapping?.externalId) {
      throw new Error(
        `SKU ${sku || variantId} ainda não está mapeado no Bling. Sincronize o catálogo antes de processar o pedido.`,
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
    if (order.status !== "PAID")
      throw new Error(`StorefrontOrder ${order.code} não está pago.`);

    const prior = await this.getMap(
      row.companyId,
      "STOREFRONT_ORDER",
      order.id,
    );
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

    const contactId = await this.ensureContact(
      row.companyId,
      order.customer,
      order.delivery,
    );
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
        observacoes: `Origem: LOJA BISPO | BBOS: ${order.code}`,
      }),
    });
    const externalId = String(result?.data?.id ?? result?.id ?? "");
    if (!externalId)
      throw new Error("Bling não retornou o ID do pedido de venda criado.");

    await this.mapResource(
      row.companyId,
      "STOREFRONT_ORDER",
      order.id,
      externalId,
      {
        code: order.code,
        origin: "BISPO_STORE",
      },
    );
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

  private async processSalesOrderInvoice(
    row: any,
    staleSalesOrderRecoveryAttempt = 0,
  ): Promise<any> {
    const orders = await this.database.$queryRawUnsafe<any[]>(
      `SELECT so.*,c.name AS "customerName",c."legalName" AS "customerLegalName",c."taxId" AS "customerTaxId",
              c."countryCode" AS "customerCountryCode",c."countryName" AS "customerCountryName",
              c."foreignTaxId" AS "customerForeignTaxId",
              c.email AS "customerEmail",c.phone AS "customerPhone",
              c."postalCode" AS "customerPostalCode",c.address AS "customerAddress",
              c."addressNumber" AS "customerAddressNumber",
              c."addressComplement" AS "customerAddressComplement",
              c.district AS "customerDistrict",c.city AS "customerCity",c.state AS "customerState",
              c."stateRegistration" AS "customerStateRegistration",
              c."stateRegistrationType" AS "customerStateRegistrationType",
              sc."platformCode" AS "salesChannelPlatformCode",sc.type AS "salesChannelType",
              sc.currency AS "salesChannelCurrency",
              sfo.id AS "storefrontOrderId"
         FROM "SalesOrder" so
         JOIN "Customer" c ON c.id=so."customerId"
         LEFT JOIN "SalesChannel" sc ON sc.id=so."salesChannelId"
         LEFT JOIN "StorefrontOrder" sfo
           ON sfo."companyId"=so."companyId" AND sfo.code=so.code
        WHERE so.id=$1 AND so."companyId"=$2 LIMIT 1`,
      row.aggregateId,
      row.companyId,
    );
    const order = orders[0];
    if (!order) throw new Error("SalesOrder da fila não foi encontrado.");
    const customerFiscalError = customerFiscalReadinessMessage({
      name: order.customerName,
      legalName: order.customerLegalName,
      taxId: order.customerTaxId,
      countryCode: order.customerCountryCode,
      countryName: order.customerCountryName,
      foreignTaxId: order.customerForeignTaxId,
      postalCode: order.customerPostalCode,
      address: order.customerAddress,
      addressNumber: order.customerAddressNumber,
      addressComplement: order.customerAddressComplement,
      district: order.customerDistrict,
      city: order.customerCity,
      state: order.customerState,
      stateRegistration: order.customerStateRegistration,
      stateRegistrationType: order.customerStateRegistrationType,
    });
    if (customerFiscalError) throw new Error(customerFiscalError);
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

    const isExport = String(order.salesChannelType) === "EXPORTACAO";
    if (
      isExport !==
      (String(order.customerCountryCode ?? "BR").toUpperCase() !== "BR")
    ) {
      throw new Error(
        "Emissão fiscal bloqueada: cliente estrangeiro e tabela de exportação precisam estar alinhados.",
      );
    }
    const exportFiscalRoute = isExport
      ? await this.blingCatalogSync.exportFiscalRoute(row.companyId)
      : null;
    const orderCurrency = String(
      order.currency ?? order.salesChannelCurrency ?? "BRL",
    )
      .trim()
      .toUpperCase();
    const exchangeRateToBrl = isExport
      ? Number(order.exchangeRateToBrl ?? (orderCurrency === "BRL" ? 1 : 0))
      : 1;
    if (
      isExport &&
      (!Number.isFinite(exchangeRateToBrl) ||
        exchangeRateToBrl <= 0 ||
        !order.exchangeRateDate)
    ) {
      throw new Error(
        "Emissão de exportação bloqueada: cotação para BRL e data da cotação são obrigatórias.",
      );
    }
    const fiscalTotalBrl = roundCurrency(
      Number(order.totalAmount) * exchangeRateToBrl,
    );

    const sampleFiscalRoute =
      order.orderType === "SAMPLE"
        ? await this.blingCatalogSync.sampleFiscalRoute(
            row.companyId,
            order.customerState,
          )
        : null;

    const priorFiscal = await this.database.$queryRawUnsafe<any[]>(
      `SELECT * FROM "FiscalDocument"
        WHERE "companyId"=$1 AND "salesOrderId"=$2 AND direction='OUTBOUND'
        ORDER BY "createdAt" DESC LIMIT 1`,
      row.companyId,
      order.id,
    );
    const priorFiscalExternalId = String(
      priorFiscal[0]?.externalId ?? "",
    ).trim();
    const priorConsumerFinalRejection =
      order.orderType === "SAMPLE" &&
      String(priorFiscal[0]?.status) === "REJECTED" &&
      Number(priorFiscal[0]?.payloadSnapshot?.sefazStatusCode) === 696;
    const priorRecipientRejection =
      String(priorFiscal[0]?.status) === "REJECTED" &&
      Number(priorFiscal[0]?.payloadSnapshot?.sefazStatusCode) === 232;
    const currentRecipientRegistrationSignature = [
      String(order.customerStateRegistrationType ?? "NON_TAXPAYER"),
      String(order.customerStateRegistration ?? "")
        .replace(/[^A-Z0-9]/gi, "")
        .toUpperCase(),
    ].join(":");
    const priorRecipientRegistrationSignature = String(
      priorFiscal[0]?.payloadSnapshot
        ?.recipientRecoveryStateRegistrationSignature ?? "",
    );
    const recipientRegistrationChangedAfterRecovery =
      Boolean(priorFiscal[0]?.payloadSnapshot?.recipientRecoveryAttempted) &&
      currentRecipientRegistrationSignature !==
        priorRecipientRegistrationSignature &&
      (Boolean(priorRecipientRegistrationSignature) ||
        (String(order.customerStateRegistrationType) === "NUMBER" &&
          Boolean(String(order.customerStateRegistration ?? "").trim())));
    const recoverRecipientOnFreshDraft =
      priorRecipientRejection &&
      (!priorFiscal[0]?.payloadSnapshot?.recipientRecoveryAttempted ||
        recipientRegistrationChangedAfterRecovery);
    if (
      priorRecipientRejection &&
      priorFiscal[0]?.payloadSnapshot?.recipientRecoveryAttempted &&
      !recipientRegistrationChangedAfterRecovery
    ) {
      throw new Error(
        "Reprocessamento fiscal bloqueado: a rejeição 232 persistiu após gerar um novo rascunho com o destinatário corrigido. Revise a classificação estadual do cliente antes de tentar novamente.",
      );
    }
    const repairConsumerFinalRejection =
      priorConsumerFinalRejection &&
      !priorFiscal[0]?.payloadSnapshot?.consumerFinalRepairAttempted;
    const repairInvoiceDraftConsumerFinal =
      priorConsumerFinalRejection &&
      !priorFiscal[0]?.payloadSnapshot?.invoiceDraftRepairAttempted;
    const recoverAfterNatureConsumerFinalFix =
      priorConsumerFinalRejection &&
      Boolean(priorFiscal[0]?.payloadSnapshot?.consumerFinalRepairAttempted) &&
      Boolean(priorFiscal[0]?.payloadSnapshot?.invoiceDraftRepairAttempted) &&
      !priorFiscal[0]?.payloadSnapshot?.natureConsumerFinalRecoveryAttempted;
    const regenerateForConsumerFinal =
      repairConsumerFinalRejection ||
      repairInvoiceDraftConsumerFinal ||
      recoverAfterNatureConsumerFinalFix;
    const regenerateSalesOrder =
      regenerateForConsumerFinal || recoverRecipientOnFreshDraft;
    const effectiveRecoveryAttempt = regenerateSalesOrder
      ? Math.max(staleSalesOrderRecoveryAttempt, 1)
      : staleSalesOrderRecoveryAttempt;
    const rejectedFiscalReference =
      String(priorFiscal[0]?.externalId ?? priorFiscal[0]?.number ?? "")
        .replace(/\D/g, "")
        .slice(-6) || "SEFAZ";
    const recoveryReference = recoverRecipientOnFreshDraft
      ? `-IE${rejectedFiscalReference}`
      : regenerateForConsumerFinal
        ? `${recoverAfterNatureConsumerFinalFix ? "-CFN" : "-CF"}${
            rejectedFiscalReference
          }`
        : effectiveRecoveryAttempt
          ? `-R${effectiveRecoveryAttempt}`
          : "";

    const contactId = await this.ensureContact(
      row.companyId,
      {
        name: order.customerName,
        legalName: order.customerLegalName,
        cpf: order.customerTaxId,
        countryCode: order.customerCountryCode,
        countryName: order.customerCountryName,
        foreignTaxId: order.customerForeignTaxId,
        email: order.customerEmail,
        phone: order.customerPhone,
        stateRegistration: order.customerStateRegistration,
        stateRegistrationType: order.customerStateRegistrationType,
      },
      {
        street: order.customerAddress,
        number: order.customerAddressNumber,
        complement: order.customerAddressComplement,
        district: order.customerDistrict,
        postalCode: order.customerPostalCode,
        city: order.customerCity,
        state: order.customerState,
      },
    );

    let salesMap = await this.getMap(row.companyId, "SALES_ORDER", order.id);
    if (!salesMap?.externalId && order.storefrontOrderId) {
      const storefrontMap = await this.getMap(
        row.companyId,
        "STOREFRONT_ORDER",
        order.storefrontOrderId,
      );
      if (storefrontMap?.externalId) {
        await this.mapResource(
          row.companyId,
          "SALES_ORDER",
          order.id,
          storefrontMap.externalId,
          {
            code: order.code,
            origin: "BISPO_STORE",
            storefrontOrderId: order.storefrontOrderId,
          },
        );
        salesMap = { externalId: storefrontMap.externalId };
      }
    }
    if (!salesMap?.externalId && priorFiscal[0]) {
      const fiscalMapRows = await this.database.$queryRawUnsafe<any[]>(
        `SELECT metadata FROM "IntegrationResourceMap"
          WHERE "companyId"=$1 AND provider='BLING'
            AND "resourceType"='FISCAL_DOCUMENT' AND "internalKey"=$2
          LIMIT 1`,
        row.companyId,
        priorFiscal[0].id,
      );
      const recoverableSalesOrderId = String(
        priorFiscal[0]?.payloadSnapshot?.blingOrderId ??
          fiscalMapRows[0]?.metadata?.blingOrderId ??
          "",
      ).trim();
      if (recoverableSalesOrderId) {
        try {
          await this.bling.request(
            row.companyId,
            `/pedidos/vendas/${encodeURIComponent(recoverableSalesOrderId)}`,
            { method: "GET" },
          );
          await this.mapResource(
            row.companyId,
            "SALES_ORDER",
            order.id,
            recoverableSalesOrderId,
            {
              code: order.code,
              origin: "RECOVERED_FROM_FISCAL_DOCUMENT",
              fiscalDocumentId: priorFiscal[0].id,
            },
          );
          salesMap = { externalId: recoverableSalesOrderId };
        } catch (error) {
          if (!isBlingNotFound(error)) throw error;
        }
      }
    }
    if (regenerateSalesOrder && salesMap?.externalId) {
      await this.database.$executeRawUnsafe(
        `DELETE FROM "IntegrationResourceMap"
          WHERE "companyId"=$1 AND provider='BLING'
            AND "resourceType"='SALES_ORDER' AND "internalKey"=$2`,
        row.companyId,
        order.id,
      );
      salesMap = null;
    }
    if (salesMap?.externalId) {
      try {
        await this.bling.request(
          row.companyId,
          `/pedidos/vendas/${encodeURIComponent(salesMap.externalId)}`,
          { method: "GET" },
        );
      } catch (error) {
        if (!isBlingNotFound(error)) throw error;
        await this.database.$executeRawUnsafe(
          `DELETE FROM "IntegrationResourceMap"
            WHERE "companyId"=$1 AND provider='BLING'
              AND "resourceType"='SALES_ORDER' AND "internalKey"=$2`,
          row.companyId,
          order.id,
        );
        salesMap = null;
      }
    }
    if (!salesMap?.externalId) {
      const blingItems = [];
      for (const item of items) {
        const productId = await this.productExternalId(row.companyId, {
          variantId: item.variantId,
          slug: item.slug,
          sku: item.sku,
        });
        blingItems.push({
          produto: { id: Number(productId) },
          quantidade: Number(item.quantity),
          valor: roundCurrency(Number(item.unitPrice) * exchangeRateToBrl),
          descricao: item.productName,
          codigo: item.sku,
          ...(sampleFiscalRoute || exportFiscalRoute
            ? {
                naturezaOperacao: {
                  id: Number(
                    sampleFiscalRoute?.natureOperationId ??
                      exportFiscalRoute?.natureOperationId,
                  ),
                },
              }
            : {}),
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
      const grossWeight = Array.isArray(packagePayload)
        ? packagePayload.reduce(
            (sum: number, pkg: any) =>
              sum +
              Number(pkg?.weight ?? pkg?.weightGrams ?? 0) /
                (pkg?.weightGrams ? 1000 : 1),
            0,
          )
        : Number(packagePayload?.weight ?? 0);

      const result = await this.bling.request(
        row.companyId,
        "/pedidos/vendas",
        {
          method: "POST",
          body: JSON.stringify({
            numeroLoja: `${order.orderNumber ?? order.code}${recoveryReference}`,
            data: toBlingDate(
              order.orderDate ?? order.orderedAt ?? order.createdAt,
            ),
            contato: { id: Number(contactId) },
            itens: blingItems,
            observacoes:
              order.orderType === "SAMPLE"
                ? `REMESSA DE AMOSTRA SEM VALOR COMERCIAL | Valor simbólico para fins fiscais | Origem: BBOS AMOSTRAS | BBOS: ${order.code}`
                : isExport
                  ? `EXPORTAÇÃO | ${orderCurrency} 1 = BRL ${exchangeRateToBrl.toFixed(6)} | Câmbio: ${toBlingDate(order.exchangeRateDate)} | ${order.incoterm} ${order.incotermLocation} | BBOS: ${order.code}`
                  : order.salesChannelPlatformCode === "BISPO_STORE" ||
                      order.storefrontOrderId
                    ? `Origem: LOJA BISPO | BBOS: ${order.code}`
                    : `Origem: BBOS COMERCIAL | BBOS: ${order.code}`,
            transporte: {
              fretePorConta: order.freightResponsibility === "CUSTOMER" ? 1 : 0,
              frete: roundCurrency(
                Number(order.freight ?? 0) * exchangeRateToBrl,
              ),
              quantidadeVolumes: packageCount || undefined,
              pesoBruto: grossWeight || undefined,
              prazoEntrega:
                Number(order.estimatedDeliveryDays ?? 0) || undefined,
            },
          }),
        },
      );
      const externalId = String(result?.data?.id ?? result?.id ?? "");
      if (!externalId)
        throw new Error(
          "Bling não retornou o ID do pedido de venda comercial.",
        );
      await this.mapResource(
        row.companyId,
        "SALES_ORDER",
        order.id,
        externalId,
        {
          code: order.code,
          origin:
            order.orderType === "SAMPLE"
              ? "BBOS_SAMPLE"
              : order.salesChannelPlatformCode === "BISPO_STORE" ||
                  order.storefrontOrderId
                ? "BISPO_STORE"
                : "BBOS_COMERCIAL",
        },
      );
      salesMap = { externalId };
    }
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

    const expectedDocument = this.normalizeFiscalIdentity(
      isExport ? order.customerForeignTaxId : order.customerTaxId,
    );
    let remoteOrder: any;
    try {
      remoteOrder = sampleFiscalRoute
        ? await this.ensureSampleNatureOnSalesOrder(
            row.companyId,
            salesMap.externalId,
            sampleFiscalRoute,
          )
        : await this.bling
            .request(
              row.companyId,
              `/pedidos/vendas/${encodeURIComponent(salesMap.externalId)}`,
              { method: "GET" },
            )
            .then((detail) => detail?.data ?? detail ?? {});
    } catch (error) {
      const canRecoverStaleSalesOrder =
        !priorFiscalExternalId &&
        staleSalesOrderRecoveryAttempt === 0 &&
        isBlingSalesOrderInvoiceAlreadyGenerated(error);
      if (!canRecoverStaleSalesOrder) throw error;

      // Bling keeps a deleted draft linked to its original sales order. That
      // order can no longer be edited or invoiced, so remap this BBOS order to
      // a fresh remote sales order and continue the same idempotent request.
      await this.database.$executeRawUnsafe(
        `DELETE FROM "IntegrationResourceMap"
          WHERE "companyId"=$1 AND provider='BLING'
            AND "resourceType"='SALES_ORDER' AND "internalKey"=$2`,
        row.companyId,
        order.id,
      );
      return this.processSalesOrderInvoice(row, 1);
    }
    const remoteContactId = String(remoteOrder?.contato?.id ?? "");
    if (!remoteContactId)
      throw new Error(
        "Emissão fiscal bloqueada: pedido do Bling sem contato destinatário.",
      );
    const remoteContactDetail = await this.bling.request(
      row.companyId,
      `/contatos/${encodeURIComponent(remoteContactId)}`,
      { method: "GET" },
    );
    const remoteContact =
      remoteContactDetail?.data ?? remoteContactDetail ?? {};
    const remoteDocument = this.normalizeFiscalIdentity(
      remoteContact?.numeroDocumento ??
        remoteContact?.cnpj ??
        remoteContact?.cpf ??
        "",
    );
    if (!expectedDocument || remoteDocument !== expectedDocument) {
      throw new Error(
        `Emissão fiscal bloqueada: identificação fiscal do destinatário no Bling (${remoteDocument || "ausente"}) difere do cliente do pedido BBOS (${expectedDocument || "ausente"}).`,
      );
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
    if (blingNfeId) {
      try {
        await this.bling.request(
          row.companyId,
          `/nfe/${encodeURIComponent(blingNfeId)}`,
          { method: "GET" },
        );
      } catch (error) {
        if (!isBlingNotFound(error)) throw error;
        blingNfeId = "";
      }
    }
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

    let invoiceDraftRepairApplied = false;
    const fiscalDraftDetail = await this.bling.request(
      row.companyId,
      `/nfe/${encodeURIComponent(blingNfeId)}`,
      { method: "GET" },
    );
    let fiscalDraft = fiscalDraftDetail?.data ?? fiscalDraftDetail ?? {};
    if (exportFiscalRoute) {
      fiscalDraft = await this.repairExportInvoice(
        row.companyId,
        blingNfeId,
        fiscalDraft,
        order,
        exportFiscalRoute,
      );
      invoiceDraftRepairApplied = true;
    }
    if (
      sampleFiscalRoute &&
      !sampleCfopIsApplied(fiscalDraft?.itens, sampleFiscalRoute.cfop)
    ) {
      throw new Error(
        `Emissão de amostra bloqueada antes da SEFAZ: o rascunho da NF-e não recebeu o CFOP ${sampleFiscalRoute.cfop} (${sampleFiscalRoute.scope === "INTER" ? "operação interestadual" : "operação interna"}). Corrija a natureza de operação no Bling e tente novamente.`,
      );
    }
    const expectedStateRegistrationType = String(
      order.customerStateRegistrationType ?? "NON_TAXPAYER",
    );
    const expectedStateRegistrationIndicator =
      this.blingStateRegistrationIndicator({
        stateRegistrationType: expectedStateRegistrationType,
      });
    const draftStateRegistrationIndicator = Number(
      fiscalDraft?.contato?.contribuinte ??
        fiscalDraft?.contato?.indicadorIe ??
        fiscalDraft?.destinatario?.contribuinte ??
        fiscalDraft?.destinatario?.indicadorIe,
    );
    const draftStateRegistration = String(
      fiscalDraft?.contato?.ie ?? fiscalDraft?.destinatario?.ie ?? "",
    ).trim();
    const expectedStateRegistration = String(
      order.customerStateRegistration ?? "",
    ).trim();
    const recipientNeedsRepair =
      draftStateRegistrationIndicator !== expectedStateRegistrationIndicator ||
      (expectedStateRegistrationType === "NUMBER" &&
        draftStateRegistration !== expectedStateRegistration) ||
      (expectedStateRegistrationType === "EXEMPT" &&
        draftStateRegistration.toUpperCase() !== "ISENTO");
    if (
      !isExport &&
      (repairInvoiceDraftConsumerFinal || recipientNeedsRepair)
    ) {
      await this.repairInvoiceRecipient(
        row.companyId,
        blingNfeId,
        fiscalDraft,
        order,
        sampleFiscalRoute,
      );
      invoiceDraftRepairApplied = true;
    }

    const reusableFiscal =
      priorFiscal[0] && String(priorFiscal[0].status) !== "CANCELLED"
        ? priorFiscal[0]
        : null;
    const fiscalId =
      reusableFiscal?.id ||
      `fiscal-${stableId(`${row.companyId}:${order.id}:NFE:${blingNfeId}`)}`;
    if (reusableFiscal) {
      await this.database.$executeRawUnsafe(
        `UPDATE "FiscalDocument"
            SET status='SENT',"externalProvider"='BLING',"externalId"=$2,
                number=NULL,series=NULL,"accessKey"=NULL,
                "totalAmount"=$3,"payloadSnapshot"=$4::jsonb,"updatedAt"=NOW()
          WHERE id=$1`,
        fiscalId,
        blingNfeId,
        fiscalTotalBrl,
        JSON.stringify({
          create: nfeResult,
          blingOrderId: salesMap.externalId,
          consumerFinalRepairAttempted:
            repairConsumerFinalRejection ||
            Boolean(
              priorFiscal[0]?.payloadSnapshot?.consumerFinalRepairAttempted,
            ),
          invoiceDraftRepairAttempted:
            invoiceDraftRepairApplied ||
            Boolean(
              priorFiscal[0]?.payloadSnapshot?.invoiceDraftRepairAttempted,
            ),
          invoiceDraftRepairAttemptedAt: invoiceDraftRepairApplied
            ? new Date().toISOString()
            : (priorFiscal[0]?.payloadSnapshot?.invoiceDraftRepairAttemptedAt ??
              null),
          natureConsumerFinalRecoveryAttempted:
            recoverAfterNatureConsumerFinalFix ||
            Boolean(
              priorFiscal[0]?.payloadSnapshot
                ?.natureConsumerFinalRecoveryAttempted,
            ),
          natureConsumerFinalRecoveryAttemptedAt:
            recoverAfterNatureConsumerFinalFix
              ? new Date().toISOString()
              : (priorFiscal[0]?.payloadSnapshot
                  ?.natureConsumerFinalRecoveryAttemptedAt ?? null),
          recipientRecoveryAttempted:
            recoverRecipientOnFreshDraft ||
            Boolean(
              priorFiscal[0]?.payloadSnapshot?.recipientRecoveryAttempted,
            ),
          recipientRecoveryAttemptedAt: recoverRecipientOnFreshDraft
            ? new Date().toISOString()
            : (priorFiscal[0]?.payloadSnapshot?.recipientRecoveryAttemptedAt ??
              null),
          recipientRecoveryStateRegistrationSignature:
            recoverRecipientOnFreshDraft
              ? currentRecipientRegistrationSignature
              : (priorFiscal[0]?.payloadSnapshot
                  ?.recipientRecoveryStateRegistrationSignature ?? null),
          replacedRejectedNfeId: recoverRecipientOnFreshDraft
            ? priorFiscalExternalId
            : (priorFiscal[0]?.payloadSnapshot?.replacedRejectedNfeId ?? null),
        }),
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
        fiscalTotalBrl,
        JSON.stringify({
          create: nfeResult,
          blingOrderId: salesMap.externalId,
          consumerFinalRepairAttempted: repairConsumerFinalRejection,
          invoiceDraftRepairAttempted: invoiceDraftRepairApplied,
          invoiceDraftRepairAttemptedAt: invoiceDraftRepairApplied
            ? new Date().toISOString()
            : null,
          natureConsumerFinalRecoveryAttempted:
            recoverAfterNatureConsumerFinalFix,
          natureConsumerFinalRecoveryAttemptedAt:
            recoverAfterNatureConsumerFinalFix
              ? new Date().toISOString()
              : null,
          recipientRecoveryAttempted: recoverRecipientOnFreshDraft,
          recipientRecoveryAttemptedAt: recoverRecipientOnFreshDraft
            ? new Date().toISOString()
            : null,
          recipientRecoveryStateRegistrationSignature:
            recoverRecipientOnFreshDraft
              ? currentRecipientRegistrationSignature
              : null,
          replacedRejectedNfeId: recoverRecipientOnFreshDraft
            ? priorFiscalExternalId
            : null,
        }),
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
        .request(row.companyId, `/nfe/${encodeURIComponent(blingNfeId)}`, {
          method: "GET",
        })
        .then((detail) => detail?.data ?? detail ?? null)
        .catch(() => null);
    }
    const accessKey =
      String(
        authorizedNote?.chaveAcesso ?? authorizedNote?.chave ?? "",
      ).trim() || null;
    const number =
      authorizedNote?.numero == null ? null : String(authorizedNote.numero);
    const series =
      authorizedNote?.serie == null ? null : String(authorizedNote.serie);
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

    if (sefaz.status === "REJECTED") {
      await this.database.$executeRawUnsafe(
        `UPDATE "SalesOrder"
            SET status='READY_TO_SHIP',"invoicedAt"=NULL,"updatedAt"=NOW()
          WHERE id=$1 AND status='INVOICED'`,
        order.id,
      );
    }

    let fulfillment: any = null;
    let fulfillmentError: string | null = null;
    if (sefaz.status === "AUTHORIZED") {
      await this.database.$executeRawUnsafe(
        `UPDATE "SalesOrder"
            SET status='INVOICED',"invoicedAt"=COALESCE("invoicedAt",NOW()),"updatedAt"=NOW()
          WHERE id=$1 AND status IN ('READY_TO_SHIP','INVOICED')`,
        order.id,
      );
      await this.customerLifecycle.record(
        order.id,
        "INVOICE_AUTHORIZED",
        "Nota fiscal emitida",
        "A nota fiscal do seu pedido foi autorizada e a expedição será preparada.",
        "BLING",
        `sales-order:invoice-authorized:${order.id}`,
        { fiscalId, externalId: blingNfeId, accessKey, number, series },
      );
      if (order.shippingProvider === "MELHOR_ENVIO" && order.shippingQuoteId) {
        try {
          fulfillment = await this.shipment.createLabelForSalesOrder(order.id);
        } catch (error) {
          fulfillmentError =
            error instanceof Error ? error.message : String(error);
        }
      }
    }

    return {
      blingOrderId: salesMap.externalId,
      fiscalId,
      blingNfeId,
      fulfillment,
      fulfillmentError,
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
      String(
        snapshot?.authorizationRequestedAt ??
          snapshot?.authorizationRetriedAt ??
          "",
      ),
    ).getTime();
    const waitMs = count <= 1 ? 2 * 60_000 : 10 * 60_000;
    return {
      allowed:
        !Number.isFinite(lastAttempt) || Date.now() - lastAttempt >= waitMs,
      count,
    };
  }

  private sefazAuthorization(response: any) {
    const xml = String(response?.data?.xml ?? response?.xml ?? "");
    const codes = [...xml.matchAll(/<cStat>(\d+)<\/cStat>/g)].map((match) =>
      Number(match[1]),
    );
    const messages = [...xml.matchAll(/<xMotivo>([^<]+)<\/xMotivo>/g)].map(
      (match) => match[1],
    );
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
    if (!document)
      throw new Error("FiscalDocument da fila não foi encontrado.");

    if (
      document.externalId ||
      ["SENT", "AUTHORIZED", "REJECTED", "CANCELLED"].includes(
        String(document.status),
      )
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
      `SELECT f.id,f."companyId",f."externalId",f."salesOrderId",f."payloadSnapshot",
              so."orderType"::text AS "orderType",c.state AS "customerState"
         FROM "FiscalDocument" f
         LEFT JOIN "SalesOrder" so ON so.id=f."salesOrderId"
         LEFT JOIN "Customer" c ON c.id=so."customerId"
        WHERE f."externalProvider"='BLING'
          AND f."externalId" IS NOT NULL
          AND (
            f.status='SENT'
            OR (
              f.status='AUTHORIZED'
              AND (
                NOT (COALESCE(f."payloadSnapshot",'{}'::jsonb) ? 'blingNfe')
                OR EXISTS (
                  SELECT 1 FROM "SalesOrder" so
                   WHERE so.id=f."salesOrderId" AND so.status='READY_TO_SHIP'
                )
              )
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
      const protocol = String(
        note?.protocolo ??
          note?.protocoloAutorizacao ??
          note?.numeroProtocolo ??
          note?.protocoloUso ??
          note?.protocoloNfe ??
          "",
      ).trim();
      const accessKeyFromNote = String(
        note?.chaveAcesso ?? note?.chave ?? "",
      ).replace(/\D/g, "");
      const xmlUrl = String(
        note?.linkXml ?? note?.xml ?? note?.xmlUrl ?? "",
      ).trim();
      const danfeUrl = String(
        note?.linkDanfe ?? note?.linkPDF ?? note?.danfe ?? note?.pdf ?? "",
      ).trim();
      const statusText = String(
        note?.situacao?.nome ??
          note?.situacao?.descricao ??
          note?.situacao ??
          "",
      ).toLowerCase();
      // Fiscal truth wins over a stale Bling status code. Bling may expose an authorized
      // DANFE/protocol while situacao is still "consultar situação".
      if (
        accessKeyFromNote.length === 44 &&
        (protocol ||
          xmlUrl ||
          danfeUrl ||
          statusText.includes("autoriz") ||
          statusText.includes("danfe"))
      )
        status = "AUTHORIZED";
      let retrySnapshot: Record<string, unknown> = {};
      const storedSefaz = this.sefazAuthorization(
        row.payloadSnapshot?.blingSend,
      );
      if (storedSefaz.status !== "SENT") {
        status = storedSefaz.status;
        retrySnapshot = {
          sefazStatusCode: storedSefaz.code,
          sefazMessage: storedSefaz.message,
        };
      }

      if (status === "SENT" && this.fiscalStatusCode(note?.situacao) === 1) {
        if (row.orderType === "SAMPLE") {
          const sampleFiscalRoute =
            await this.blingCatalogSync.sampleFiscalRoute(
              row.companyId,
              row.customerState,
            );
          if (!sampleCfopIsApplied(note?.itens, sampleFiscalRoute.cfop)) {
            throw new Error(
              `Reenvio de amostra bloqueado antes da SEFAZ: o rascunho da NF-e não possui o CFOP ${sampleFiscalRoute.cfop}.`,
            );
          }
        }
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
              sefaz.status === "SENT"
                ? this.fiscalStatus(note?.situacao)
                : sefaz.status;
          } catch (error) {
            authorizationLastError =
              error instanceof Error ? error.message : String(error);
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
      const accessKey =
        String(note?.chaveAcesso ?? note?.chave ?? "").trim() || null;
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
          {
            fiscalId: row.id,
            externalId: row.externalId,
            accessKey,
            number,
            series,
          },
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
            fulfillment = await this.shipment.createLabelForSalesOrder(
              row.salesOrderId,
            );
          } catch (error) {
            fulfillmentError =
              error instanceof Error ? error.message : String(error);
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
      orderId,
      companyId,
    );
    const row = rows[0];
    if (!row) throw new Error("Pedido não encontrado.");
    const document = String(row.taxId ?? "").replace(/\D/g, "");
    if (!document)
      throw new Error(
        "Reprocessamento fiscal bloqueado: cliente sem CPF/CNPJ.",
      );
    await this.database.$executeRawUnsafe(
      `DELETE FROM "IntegrationResourceMap" WHERE "companyId"=$1 AND provider='BLING' AND "resourceType"='CONTACT_DOCUMENT' AND "internalKey"=$2`,
      companyId,
      document,
    );
    await this.database.$executeRawUnsafe(
      `UPDATE "IntegrationOutbox" SET status='PENDING',attempts=0,"lastError"=NULL,"nextAttemptAt"=NULL,"updatedAt"=NOW() WHERE "companyId"=$1 AND "aggregateId"=$2 AND "eventType"='SALES_ORDER_INVOICE_REQUESTED'`,
      companyId,
      orderId,
    );
    return this.processNext(companyId);
  }

  async resetCancelledSalesOrderInvoice(companyId: string, orderId: string) {
    const rows = await this.database.$queryRawUnsafe<any[]>(
      `SELECT so.id,so.status,so."orderType",c."taxId",f.id AS "fiscalId",f."externalId",f.number
         FROM "SalesOrder" so JOIN "Customer" c ON c.id=so."customerId"
         JOIN "FiscalDocument" f ON f."salesOrderId"=so.id AND f.direction='OUTBOUND'
        WHERE so.id=$1 AND so."companyId"=$2 ORDER BY f."createdAt" DESC LIMIT 1`,
      orderId,
      companyId,
    );
    const row = rows[0];
    if (!row?.externalId)
      throw new Error("Pedido sem NF-e do Bling para reconciliar.");
    const detail = await this.bling.request(
      companyId,
      `/nfe/${encodeURIComponent(row.externalId)}`,
      { method: "GET" },
    );
    const note = detail?.data ?? detail ?? {};
    const remoteStatus = this.fiscalStatus(note?.situacao);
    const remoteStatusText = String(
      note?.situacao?.nome ?? note?.situacao?.descricao ?? note?.situacao ?? "",
    ).toLowerCase();
    const cancelled =
      remoteStatus === "CANCELLED" || remoteStatusText.includes("cancel");
    if (!cancelled)
      throw new Error(
        `A NF-e ainda não consta como cancelada no Bling (situação retornada: ${remoteStatusText || "não informada"}).`,
      );
    let sampleTotal: number | null = null;
    await this.database.$transaction(async (transaction) => {
      await transaction.$executeRawUnsafe(
        `UPDATE "FiscalDocument"
            SET status='CANCELLED',
                "payloadSnapshot"=COALESCE("payloadSnapshot",'{}'::jsonb)||$2::jsonb,
                "updatedAt"=NOW()
          WHERE id=$1`,
        row.fiscalId,
        JSON.stringify({
          cancellationReconciledAt: new Date().toISOString(),
          blingNfe: note,
        }),
      );

      if (String(row.orderType) === "SAMPLE") {
        await transaction.$executeRawUnsafe(
          `UPDATE "SalesOrderItem"
              SET "unitPrice"=$2,
                  "totalAmount"=ROUND(quantity * $2::numeric, 2),
                  discount=0,
                  "updatedAt"=NOW()
            WHERE "salesOrderId"=$1 AND "companyId"=$3`,
          orderId,
          SAMPLE_FISCAL_PACKAGE_VALUE,
          companyId,
        );
        const totals = await transaction.$queryRawUnsafe<any[]>(
          `SELECT COALESCE(SUM(quantity),0)::int AS quantity
             FROM "SalesOrderItem"
            WHERE "salesOrderId"=$1 AND "companyId"=$2`,
          orderId,
          companyId,
        );
        const quantity = Number(totals[0]?.quantity ?? 0);
        if (quantity < 1)
          throw new Error("Pedido de amostra sem itens para reemissão fiscal.");
        sampleTotal = sampleFiscalPrice(quantity);
        await transaction.$executeRawUnsafe(
          `UPDATE "SalesOrder"
              SET quantity=$2,"unitPrice"=$3,subtotal=$4,discount=0,
                  "totalAmount"=$4,status='READY_TO_SHIP',"invoicedAt"=NULL,"updatedAt"=NOW()
            WHERE id=$1 AND "companyId"=$5`,
          orderId,
          quantity,
          SAMPLE_FISCAL_PACKAGE_VALUE,
          sampleTotal,
          companyId,
        );
      } else {
        await transaction.$executeRawUnsafe(
          `UPDATE "SalesOrder"
              SET status='READY_TO_SHIP',"invoicedAt"=NULL,"updatedAt"=NOW()
            WHERE id=$1 AND "companyId"=$2`,
          orderId,
          companyId,
        );
      }

      await transaction.$executeRawUnsafe(
        `DELETE FROM "IntegrationResourceMap"
          WHERE "companyId"=$1 AND provider='BLING'
            AND "resourceType"='SALES_ORDER' AND "internalKey"=$2`,
        companyId,
        orderId,
      );
      await transaction.$executeRawUnsafe(
        `UPDATE "IntegrationOutbox"
            SET status='PENDING',attempts=0,"lastError"=NULL,"nextAttemptAt"=NULL,"updatedAt"=NOW()
          WHERE "companyId"=$1 AND "aggregateId"=$2
            AND "eventType"='SALES_ORDER_INVOICE_REQUESTED'`,
        companyId,
        orderId,
      );
    });
    return {
      reset: true,
      fiscalStatus: "CANCELLED",
      orderStatus: "READY_TO_SHIP",
      customerTaxId: row.taxId,
      sampleTotal,
    };
  }

  async resetMissingSalesOrderInvoice(companyId: string, orderId: string) {
    const rows = await this.database.$queryRawUnsafe<any[]>(
      `SELECT so.id,so.status,so."orderType",c."taxId",f.id AS "fiscalId",
              f."externalId",f.number
         FROM "SalesOrder" so
         JOIN "Customer" c ON c.id=so."customerId"
         JOIN "FiscalDocument" f ON f."salesOrderId"=so.id AND f.direction='OUTBOUND'
        WHERE so.id=$1 AND so."companyId"=$2
        ORDER BY f."createdAt" DESC LIMIT 1`,
      orderId,
      companyId,
    );
    const row = rows[0];
    const externalId = String(row?.externalId ?? "").trim();
    if (!row?.fiscalId || !externalId || externalId === "0") {
      throw new Error("Pedido sem NF-e do Bling para reconciliar.");
    }

    try {
      await this.bling.request(
        companyId,
        `/nfe/${encodeURIComponent(externalId)}`,
        { method: "GET" },
      );
      throw new Error(
        "A NF-e ainda existe no Bling. Exclua apenas o rascunho pendente ou use a regularização de cancelamento.",
      );
    } catch (error) {
      if (!isBlingNotFound(error)) throw error;
    }

    let sampleTotal: number | null = null;
    await this.database.$transaction(async (transaction) => {
      await transaction.$executeRawUnsafe(
        `UPDATE "FiscalDocument"
            SET status='ERROR',"externalId"=NULL,number=NULL,series=NULL,"accessKey"=NULL,
                "payloadSnapshot"=(COALESCE("payloadSnapshot",'{}'::jsonb)
                  - 'blingNfe' - 'blingSend' - 'create' - 'sefazStatusCode' - 'sefazMessage')
                  || $2::jsonb,
                "updatedAt"=NOW()
          WHERE id=$1`,
        row.fiscalId,
        JSON.stringify({
          remoteDeletionReconciledAt: new Date().toISOString(),
          deletedExternalId: externalId,
          deletedNumber: row.number ?? null,
        }),
      );

      if (String(row.orderType) === "SAMPLE") {
        await transaction.$executeRawUnsafe(
          `UPDATE "SalesOrderItem"
              SET "unitPrice"=$2,"totalAmount"=ROUND(quantity * $2::numeric, 2),
                  discount=0,"updatedAt"=NOW()
            WHERE "salesOrderId"=$1 AND "companyId"=$3`,
          orderId,
          SAMPLE_FISCAL_PACKAGE_VALUE,
          companyId,
        );
        const totals = await transaction.$queryRawUnsafe<any[]>(
          `SELECT COALESCE(SUM(quantity),0)::int AS quantity
             FROM "SalesOrderItem"
            WHERE "salesOrderId"=$1 AND "companyId"=$2`,
          orderId,
          companyId,
        );
        const quantity = Number(totals[0]?.quantity ?? 0);
        if (quantity < 1)
          throw new Error("Pedido de amostra sem itens para reemissão fiscal.");
        sampleTotal = sampleFiscalPrice(quantity);
        await transaction.$executeRawUnsafe(
          `UPDATE "SalesOrder"
              SET quantity=$2,"unitPrice"=$3,subtotal=$4,discount=0,"totalAmount"=$4,
                  status='READY_TO_SHIP',"invoicedAt"=NULL,"updatedAt"=NOW()
            WHERE id=$1 AND "companyId"=$5`,
          orderId,
          quantity,
          SAMPLE_FISCAL_PACKAGE_VALUE,
          sampleTotal,
          companyId,
        );
      } else {
        await transaction.$executeRawUnsafe(
          `UPDATE "SalesOrder"
              SET status='READY_TO_SHIP',"invoicedAt"=NULL,"updatedAt"=NOW()
            WHERE id=$1 AND "companyId"=$2`,
          orderId,
          companyId,
        );
      }

      await transaction.$executeRawUnsafe(
        `DELETE FROM "IntegrationResourceMap"
          WHERE "companyId"=$1 AND provider='BLING'
            AND (
              ("resourceType"='FISCAL_DOCUMENT'
                AND ("internalKey"=$2 OR "externalId"=$3))
              OR ("resourceType"='SALES_ORDER' AND "internalKey"=$4)
            )`,
        companyId,
        row.fiscalId,
        externalId,
        orderId,
      );
      await transaction.$executeRawUnsafe(
        `UPDATE "IntegrationOutbox"
            SET status='CANCELLED',attempts=0,
                "lastError"='NF-e pendente excluída no Bling; aguardando nova solicitação manual.',
                "nextAttemptAt"=NULL,"updatedAt"=NOW()
          WHERE "companyId"=$1 AND "aggregateId"=$2
            AND "eventType"='SALES_ORDER_INVOICE_REQUESTED'`,
        companyId,
        orderId,
      );
    });

    return {
      reset: true,
      fiscalStatus: "ERROR",
      orderStatus: "READY_TO_SHIP",
      customerTaxId: row.taxId,
      sampleTotal,
    };
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
      if (
        row.eventType === "STOREFRONT_ORDER_PAID" &&
        row.aggregateType === "STOREFRONT_ORDER"
      ) {
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
        throw new Error(
          `Evento Bling ainda não implementado: ${row.eventType}/${row.aggregateType}`,
        );
      }
      await this.database.$executeRawUnsafe(
        `UPDATE "IntegrationOutbox" SET status='SENT',"lastError"=NULL,"nextAttemptAt"=NULL,"updatedAt"=NOW() WHERE id=$1`,
        row.id,
      );
      return {
        processed: true,
        outboxId: row.id,
        eventType: row.eventType,
        result,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const attempts = Number(row.attempts ?? 1);
      const retryMinutes = Math.min(
        60,
        Math.max(2, 2 ** Math.min(attempts, 5)),
      );
      await this.database.$executeRawUnsafe(
        `UPDATE "IntegrationOutbox"
         SET status='FAILED',"lastError"=$2,"nextAttemptAt"=NOW() + ($3 || ' minutes')::interval,"updatedAt"=NOW()
         WHERE id=$1`,
        row.id,
        message.slice(0, 2000),
        String(retryMinutes),
      );
      return {
        processed: true,
        outboxId: row.id,
        failed: true,
        error: message,
      };
    }
  }
}
