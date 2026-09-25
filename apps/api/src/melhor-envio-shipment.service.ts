import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { PrismaClient } from "@bbos/database";
import { randomUUID } from "node:crypto";
import { StorefrontLifecycleService } from "./storefront-lifecycle.service";
import { MelhorEnvioAuthService } from "./melhor-envio-auth.service";
import { SalesOrderCustomerLifecycleService } from "./sales-order-customer-lifecycle.service";

const digits = (value: unknown) => String(value ?? "").replace(/\D/g, "");

@Injectable()
export class MelhorEnvioShipmentService {
  private readonly database = new PrismaClient();

  constructor(
    private readonly lifecycle: StorefrontLifecycleService,
    private readonly melhorEnvioAuth: MelhorEnvioAuthService,
    private readonly customerLifecycle: SalesOrderCustomerLifecycleService,
  ) {}

  private base() {
    return (process.env.MELHOR_ENVIO_API_URL?.trim() || "https://melhorenvio.com.br/api/v2").replace(/\/$/, "");
  }

  private async request(companyId: string, path: string, init?: RequestInit) {
    const token = await this.melhorEnvioAuth.accessToken(companyId);
    const response = await fetch(`${this.base()}${path}`, {
      ...init,
      headers: {
        accept: "application/json",
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "user-agent": process.env.MELHOR_ENVIO_USER_AGENT?.trim() || "Bispo Coffees BBOS",
        ...(init?.headers || {}),
      },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const providerMessage = String(
        body?.message ||
        body?.error ||
        (body?.errors ? JSON.stringify(body.errors) : "") ||
        "",
      ).trim();
      console.error("Melhor Envio recusou a operação", {
        path,
        status: response.status,
        error: providerMessage || undefined,
      });
      throw new ServiceUnavailableException(
        providerMessage
          ? `Melhor Envio: ${providerMessage}`
          : `Melhor Envio indisponível para esta operação (${response.status}).`,
      );
    }
    return body;
  }

  private required(name: string) {
    const value = process.env[name]?.trim();
    if (!value) throw new ServiceUnavailableException(`${name} não configurado.`);
    return value;
  }

  private async printWhenReady(companyId: string, externalId: string) {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      try {
        const printed = await this.request(companyId, "/me/shipment/print", {
          method: "POST",
          body: JSON.stringify({ orders: [externalId], mode: "public" }),
        });
        const url = String(printed?.url || printed?.data?.url || "");
        if (url) return url;
      } catch (error) {
        if (attempt === 5) throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
    }
    throw new ServiceUnavailableException("A etiqueta foi gerada, mas o PDF ainda não ficou disponível.");
  }

  private sender() {
    const document = digits(this.required("SHIPPING_SENDER_CPF"));
    const companyDocument = digits(process.env.SHIPPING_SENDER_DOCUMENT || "13008726000112");
    if (document.length !== 11)
      throw new ServiceUnavailableException("SHIPPING_SENDER_CPF deve conter um CPF válido com 11 dígitos.");
    if (companyDocument.length !== 14)
      throw new ServiceUnavailableException("SHIPPING_SENDER_DOCUMENT deve conter um CNPJ válido com 14 dígitos.");

    return {
      name: process.env.SHIPPING_SENDER_NAME?.trim() || "Bispo Coffees Ltda",
      phone: digits(this.required("SHIPPING_SENDER_PHONE")),
      email: this.required("SHIPPING_SENDER_EMAIL"),
      document,
      company_document: companyDocument,
      state_register: digits(this.required("SHIPPING_SENDER_STATE_REGISTER")),
      address: this.required("SHIPPING_SENDER_ADDRESS"),
      complement: process.env.SHIPPING_SENDER_COMPLEMENT?.trim() || "",
      number: this.required("SHIPPING_SENDER_NUMBER"),
      district: this.required("SHIPPING_SENDER_DISTRICT"),
      city: this.required("SHIPPING_SENDER_CITY"),
      country_id: "BR",
      postal_code: digits(this.required("SHIPPING_ORIGIN_POSTAL_CODE")),
    };
  }

  async markInvoiceAuthorized(orderId: string, metadata: Record<string, unknown> = {}) {
    const updated = await this.database.$executeRawUnsafe(
      `UPDATE "StorefrontOrder" SET status='INVOICED',"updatedAt"=NOW()
        WHERE id=$1 AND status IN ('PAID','PREPARING','INVOICED')`,
      orderId,
    );
    if (!updated) throw new BadRequestException("Pedido não encontrado ou fora da etapa de faturamento.");
    await this.lifecycle.record(
      orderId,
      "INVOICE_AUTHORIZED",
      "Nota fiscal emitida",
      "A nota fiscal do seu pedido foi autorizada e a expedição será preparada.",
      "BLING",
      `storefront:invoice-authorized:${orderId}`,
      metadata,
    );
    return { orderId, status: "INVOICED" };
  }

  async createLabel(orderId: string) {
    const orders = await this.database.$queryRawUnsafe<any[]>(
      `SELECT o.*,q.package,q."providerPriceCents",q."customerPriceCents",q."serviceId",q."serviceName",q."carrierName"
         FROM "StorefrontOrder" o JOIN "ShippingQuote" q ON q.id=o."shippingQuoteId"
        WHERE o.id=$1 LIMIT 1`,
      orderId,
    );
    const order = orders[0];
    if (!order) throw new BadRequestException("Pedido ou cotação de frete não encontrado.");
    if (order.status !== "INVOICED") throw new BadRequestException("A etiqueta só pode ser comprada após a autorização da NF-e.");
    if (order.shippingProvider !== "MELHOR_ENVIO") throw new BadRequestException("Este pedido não utiliza Melhor Envio.");

    const prior = await this.database.$queryRawUnsafe<any[]>(
      `SELECT * FROM "Shipment" WHERE "storefrontOrderId"=$1 LIMIT 1`,
      orderId,
    );
    if (prior[0]?.labelUrl) return { ...prior[0], idempotent: true };

    const shipmentId = prior[0]?.id || randomUUID();
    if (!prior[0]) {
      await this.database.$executeRawUnsafe(
        `INSERT INTO "Shipment"
          (id,"companyId","storefrontOrderId","shippingQuoteId",provider,status,"serviceId","serviceName","carrierName",
           "providerPriceCents","customerPriceCents",metadata,"createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,'MELHOR_ENVIO','PENDING',$5,$6,$7,$8,$9,'{}'::jsonb,NOW(),NOW())`,
        shipmentId, order.companyId, order.id, order.shippingQuoteId, order.serviceId, order.serviceName,
        order.carrierName, order.providerPriceCents, order.customerPriceCents,
      );
    }

    const customer = order.customer || {};
    const delivery = order.delivery || {};
    const items = Array.isArray(order.items) ? order.items : [];
    let externalId = prior[0]?.externalId || "";
    if (!externalId) {
      const cartResult = await this.request(order.companyId, "/me/cart", {
        method: "POST",
        body: JSON.stringify({
        service: Number(order.serviceId),
        from: this.sender(),
        to: {
          name: customer.name,
          phone: digits(customer.phone),
          email: customer.email,
          document: digits(customer.cpf),
          address: delivery.street,
          complement: delivery.complement || "",
          number: delivery.number,
          district: delivery.district,
          city: delivery.city,
          state_abbr: delivery.state,
          country_id: "BR",
          postal_code: digits(delivery.postalCode),
        },
        products: items.map((item: any) => ({
          name: item.name,
          quantity: Number(item.quantity),
          unitary_value: Number(item.unitPriceCents) / 100,
          weight: Math.max(0.001, Number(item.weightGrams || 0) / 1000 / Math.max(1, Number(item.quantity))),
        })),
        volumes: Array.isArray(order.package) ? order.package : [order.package],
        options: { insurance_value: Number(order.subtotalCents) / 100, receipt: false, own_hand: false, reverse: false, non_commercial: false },
        }),
      });
      externalId = String(cartResult?.id || "");
      const cartPriceCents = Math.round(Number(cartResult?.price || cartResult?.custom_price || 0) * 100);
      if (cartPriceCents > 0 && cartPriceCents !== Number(order.providerPriceCents)) {
        await this.database.$executeRawUnsafe(
          `UPDATE "Shipment" SET status='EXCEPTION',metadata=$2::jsonb,"updatedAt"=NOW() WHERE id=$1`,
          shipmentId,
          JSON.stringify({ reason: "PRICE_CHANGED", quotedCents: Number(order.providerPriceCents), cartPriceCents, cartResult }),
        );
        await this.database.$executeRawUnsafe(
          `UPDATE "StorefrontOrder" SET status='EXCEPTION',"updatedAt"=NOW() WHERE id=$1`,
          order.id,
        );
        await this.lifecycle.record(
          order.id,
          "EXCEPTION",
          "Envio em conferência",
          "Identificamos uma alteração no custo da transportadora. A Bispo Coffees fará a conferência sem cobrança adicional automática.",
          "MELHOR_ENVIO",
          `storefront:shipping-price-exception:${order.id}`,
          { quotedCents: Number(order.providerPriceCents), cartPriceCents },
        );
        throw new BadRequestException("O valor da transportadora mudou após a compra. Pedido enviado para conferência, sem cobrança adicional ao cliente.");
      }
    }
    if (!externalId) throw new ServiceUnavailableException("Melhor Envio não retornou o identificador da remessa.");
    await this.database.$executeRawUnsafe(
      `UPDATE "Shipment" SET "externalId"=$2,status='CARTED',"updatedAt"=NOW() WHERE id=$1`,
      shipmentId, externalId,
    );

    await this.request(order.companyId, "/me/shipment/checkout", { method: "POST", body: JSON.stringify({ orders: [externalId] }) });
    await this.database.$executeRawUnsafe(`UPDATE "Shipment" SET status='PURCHASED',"updatedAt"=NOW() WHERE id=$1`, shipmentId);
    await this.request(order.companyId, "/me/shipment/generate", { method: "POST", body: JSON.stringify({ orders: [externalId] }) });
    const labelUrl = await this.printWhenReady(order.companyId, externalId);
    const details = await this.request(order.companyId, `/me/orders/${encodeURIComponent(externalId)}`, { method: "GET" }).catch(() => ({}));
    const trackingCode = String(details?.tracking || details?.tracking_code || "") || null;
    const trackingUrl = String(details?.tracking_url || details?.tracking?.url || "") || null;
    await this.database.$executeRawUnsafe(
      `UPDATE "Shipment" SET status='LABEL_READY',"labelUrl"=$2,"trackingCode"=$3,"trackingUrl"=$4,metadata=$5::jsonb,"updatedAt"=NOW() WHERE id=$1`,
      shipmentId, labelUrl || null, trackingCode, trackingUrl, JSON.stringify(details || {}),
    );
    await this.lifecycle.record(
      order.id,
      "SHIPMENT_CREATED",
      "Envio preparado",
      "A etiqueta de transporte foi emitida e o pedido está pronto para postagem.",
      "MELHOR_ENVIO",
      `storefront:shipment-created:${order.id}`,
      { shipmentId, externalId, carrierName: order.carrierName, serviceName: order.serviceName },
    );
    return { id: shipmentId, externalId, status: "LABEL_READY", labelUrl, trackingCode, trackingUrl };
  }

  async postingAgenciesForSalesOrder(orderId: string) {
    const rows = await this.database.$queryRawUnsafe<any[]>(
      `SELECT so.id,so."companyId",so."shippingProvider",so."shippingQuoteId",
              q."carrierName",q."serviceName",q."serviceId",q."rawResponse"
         FROM "SalesOrder" so
         JOIN "ShippingQuote" q ON q.id=so."shippingQuoteId"
        WHERE so.id=$1 LIMIT 1`,
      orderId,
    );
    const order = rows[0];
    if (!order) throw new BadRequestException("Pedido ou cotação de frete não encontrado.");
    if (order.shippingProvider !== "MELHOR_ENVIO")
      throw new BadRequestException("Este pedido não utiliza Melhor Envio.");

    const sender = this.sender();
    const carrierCompanyId = String(order.rawResponse?.company?.id ?? "").trim();
    const params = new URLSearchParams({
      country: "BR",
      state: String(process.env.SHIPPING_SENDER_STATE?.trim() || "PR").toUpperCase(),
      city: sender.city,
    });
    if (carrierCompanyId) params.set("company", carrierCompanyId);

    const response = await this.request(
      order.companyId,
      `/me/shipment/agencies?${params.toString()}`,
      { method: "GET" },
    );
    const rawAgencies = Array.isArray(response)
      ? response
      : Array.isArray(response?.data)
        ? response.data
        : Array.isArray(response?.agencies)
          ? response.agencies
          : [];

    const agencies = rawAgencies.map((agency: any) => {
      const address = agency?.address ?? agency?.agency_address ?? {};
      const city = address?.city ?? agency?.city ?? {};
      const state = address?.state ?? agency?.state ?? {};
      const street =
        address?.address ?? address?.street ?? agency?.address ?? agency?.street ?? "";
      const number = address?.number ?? agency?.number ?? "";
      const district = address?.district ?? address?.neighborhood ?? agency?.district ?? "";
      const postalCode =
        address?.postal_code ?? address?.postalCode ?? agency?.postal_code ?? agency?.postalCode ?? "";
      const cityName = typeof city === "string" ? city : (city?.city ?? city?.name ?? agency?.city_name ?? sender.city);
      const stateCode = typeof state === "string" ? state : (state?.state_abbr ?? state?.abbr ?? state?.code ?? agency?.state_abbr ?? params.get("state"));
      const id = String(agency?.id ?? agency?.agency_id ?? agency?.agencyId ?? "");
      const name = String(agency?.name ?? agency?.company_name ?? agency?.agency_name ?? `Agência ${id}`);
      const addressLine = [street, number].filter(Boolean).join(", ");
      const locationLine = [district, cityName, stateCode].filter(Boolean).join(" · ");
      const mapsQuery = [addressLine, district, cityName, stateCode, postalCode].filter(Boolean).join(", ");
      return {
        id,
        name,
        companyName: String(agency?.company_name ?? agency?.company?.name ?? order.carrierName ?? ""),
        address: addressLine,
        district: String(district || ""),
        city: String(cityName || ""),
        state: String(stateCode || ""),
        postalCode: String(postalCode || ""),
        locationLine,
        phone: String(agency?.phone ?? agency?.telephone ?? ""),
        latitude: Number(agency?.latitude ?? address?.latitude ?? NaN),
        longitude: Number(agency?.longitude ?? address?.longitude ?? NaN),
        mapsUrl: mapsQuery
          ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`
          : null,
      };
    }).filter((agency: any) => agency.id);

    return {
      carrierName: order.carrierName,
      serviceName: order.serviceName,
      serviceId: order.serviceId,
      origin: {
        city: sender.city,
        state: params.get("state"),
        postalCode: sender.postal_code,
      },
      agencies,
    };
  }
  async requoteForSalesOrder(orderId: string, packages?: Array<{ weight: number; length: number; width: number; height: number }>) {
    const rows = await this.database.$queryRawUnsafe<any[]>(
      `SELECT so.*,q.package,q."providerPriceCents",q."customerPriceCents",
              q."serviceId",q."serviceName",q."carrierName",
              c."postalCode" AS "customerPostalCode"
         FROM "SalesOrder" so
         JOIN "ShippingQuote" q ON q.id=so."shippingQuoteId"
         JOIN "Customer" c ON c.id=so."customerId"
        WHERE so.id=$1 LIMIT 1`,
      orderId,
    );
    const order = rows[0];
    if (!order) throw new BadRequestException("Pedido comercial ou cotação de frete não encontrado.");
    const originalPackages = Array.isArray(order.package) ? order.package : [order.package];
    const packagePayload = Array.isArray(packages) && packages.length ? packages : originalPackages;
    for (const volume of packagePayload) {
      if (![volume.weight, volume.length, volume.width, volume.height].every((value) => Number(value) > 0)) throw new BadRequestException("Peso e dimensões de todas as caixas devem ser maiores que zero.");
    }
    const response = await this.request(order.companyId, "/me/shipment/calculate", {
      method: "POST",
      body: JSON.stringify({
        from: { postal_code: this.sender().postal_code },
        to: { postal_code: digits(order.customerPostalCode) },
        packages: packagePayload,
      }),
    });
    const raw = Array.isArray(response) ? response : Array.isArray(response?.data) ? response.data : [];
    const options = raw
      .filter((item: any) => !item?.error && Number(item?.price ?? item?.custom_price ?? 0) > 0)
      .map((item: any) => ({
        serviceId: String(item.id ?? ""),
        serviceName: String(item.name ?? ""),
        carrierName: String(item.company?.name ?? ""),
        priceCents: Math.round(Number(item.custom_price ?? item.price ?? 0) * 100),
        deliveryDays: Number(item.custom_delivery_time ?? item.delivery_time ?? 0),
      }))
      .sort((a: any, b: any) => a.priceCents - b.priceCents);
    return {
      approvedPriceCents: Number(order.customerPriceCents),
      originalProviderPriceCents: Number(order.providerPriceCents),
      quoteExpired: true,
      packages: packagePayload,
      originalPackages,
      customPackages: Boolean(packages?.length),
      options,
    };
  }

  async createLabelForSalesOrder(orderId: string) {
    const orders = await this.database.$queryRawUnsafe<any[]>(
      `SELECT so.*,q.package,q."providerPriceCents",q."customerPriceCents",
              q."serviceId",q."serviceName",q."carrierName",
              c.name AS "customerName",c."taxId" AS "customerTaxId",
              c.email AS "customerEmail",c.phone AS "customerPhone",
              c."postalCode" AS "customerPostalCode",c.address AS "customerAddress",
              c.district AS "customerDistrict",c.city AS "customerCity",c.state AS "customerState"
         FROM "SalesOrder" so
         JOIN "ShippingQuote" q ON q.id=so."shippingQuoteId"
         JOIN "Customer" c ON c.id=so."customerId"
        WHERE so.id=$1 LIMIT 1`,
      orderId,
    );
    const order = orders[0];
    if (!order) throw new BadRequestException("Pedido comercial ou cotação de frete não encontrado.");
    if (order.shippingProvider !== "MELHOR_ENVIO")
      throw new BadRequestException("Este pedido comercial não utiliza Melhor Envio.");

    const authorized = await this.database.$queryRawUnsafe<any[]>(
      `SELECT id,"accessKey" FROM "FiscalDocument"
        WHERE "salesOrderId"=$1 AND direction='OUTBOUND' AND status='AUTHORIZED'
        ORDER BY "updatedAt" DESC LIMIT 1`,
      orderId,
    );
    if (!authorized[0])
      throw new BadRequestException("A etiqueta só pode ser comprada após a autorização da NF-e.");

    const prior = await this.database.$queryRawUnsafe<any[]>(
      `SELECT * FROM "Shipment" WHERE "salesOrderId"=$1 LIMIT 1`,
      orderId,
    );
    if (prior[0]?.labelUrl) return { ...prior[0], idempotent: true };

    const items = await this.database.$queryRawUnsafe<any[]>(
      `SELECT soi.id,soi."productName",soi.quantity,soi."unitPrice",pv."netWeightGrams"
         FROM "SalesOrderItem" soi
         JOIN "ProductVariant" pv ON pv.id=soi."productVariantId"
        WHERE soi."salesOrderId"=$1
        ORDER BY soi."createdAt" ASC`,
      orderId,
    );
    if (!items.length) throw new BadRequestException("Pedido comercial sem itens para expedição.");

    const shipmentId = prior[0]?.id || randomUUID();
    if (!prior[0]) {
      await this.database.$executeRawUnsafe(
        `INSERT INTO "Shipment"
          (id,"companyId","storefrontOrderId","salesOrderId","shippingQuoteId",provider,status,
           "serviceId","serviceName","carrierName","providerPriceCents","customerPriceCents",
           metadata,"createdAt","updatedAt")
         VALUES ($1,$2,NULL,$3,$4,'MELHOR_ENVIO','PENDING',$5,$6,$7,$8,$9,'{}'::jsonb,NOW(),NOW())`,
        shipmentId,
        order.companyId,
        order.id,
        order.shippingQuoteId,
        order.serviceId,
        order.serviceName,
        order.carrierName,
        order.providerPriceCents,
        order.customerPriceCents,
      );
    }

    const rawAddress = String(order.customerAddress || "").trim();
    const addressMatch = rawAddress.match(/^(.*?)(?:,|\s)+(\d+[A-Za-z0-9/-]*)\s*$/);
    const street = String(addressMatch?.[1] || rawAddress).trim();
    const number = String(addressMatch?.[2] || "S/N").trim();
    if (!street || !order.customerPostalCode || !order.customerCity || !order.customerState) {
      throw new BadRequestException(
        "Complete endereço, CEP, cidade e UF do cliente antes de gerar a etiqueta.",
      );
    }

    const packagePayload = Array.isArray(order.package) ? order.package : [order.package];
    let externalId = prior[0]?.externalId || "";
    if (!externalId) {
      const cartResult = await this.request(order.companyId, "/me/cart", {
        method: "POST",
        body: JSON.stringify({
          service: Number(order.serviceId),
          from: this.sender(),
          to: {
            name: order.customerName,
            phone: digits(order.customerPhone),
            email: order.customerEmail,
            document: digits(order.customerTaxId),
            address: street,
            complement: "",
            number,
            district: order.customerDistrict || "",
            city: order.customerCity,
            state_abbr: order.customerState,
            country_id: "BR",
            postal_code: digits(order.customerPostalCode),
          },
          products: items.map((item: any) => ({
            name: item.productName,
            quantity: Number(item.quantity),
            unitary_value: Number(item.unitPrice),
            weight: Math.max(
              0.001,
              Number(item.netWeightGrams || 0) / 1000,
            ),
          })),
          volumes: packagePayload,
          options: {
            insurance_value: Number(order.subtotal || order.totalAmount || 0),
            receipt: false,
            own_hand: false,
            reverse: false,
            non_commercial: false,
            invoice: { key: String(authorized[0].accessKey || "") || undefined },
          },
        }),
      });
      externalId = String(cartResult?.id || "");
      const cartPriceCents = Math.round(
        Number(cartResult?.price || cartResult?.custom_price || 0) * 100,
      );
      if (
        cartPriceCents > 0 &&
        cartPriceCents !== Number(order.providerPriceCents)
      ) {
        await this.database.$executeRawUnsafe(
          `UPDATE "Shipment" SET status='EXCEPTION',metadata=$2::jsonb,"updatedAt"=NOW() WHERE id=$1`,
          shipmentId,
          JSON.stringify({
            reason: "PRICE_CHANGED",
            quotedCents: Number(order.providerPriceCents),
            cartPriceCents,
            cartResult,
          }),
        );
        throw new BadRequestException(
          "O valor da transportadora mudou após a cotação. Pedido enviado para conferência.",
        );
      }
    }

    if (!externalId)
      throw new ServiceUnavailableException(
        "Melhor Envio não retornou o identificador da remessa.",
      );

    await this.database.$executeRawUnsafe(
      `UPDATE "Shipment" SET "externalId"=$2,status='CARTED',"updatedAt"=NOW() WHERE id=$1`,
      shipmentId,
      externalId,
    );
    await this.request(order.companyId, "/me/shipment/checkout", {
      method: "POST",
      body: JSON.stringify({ orders: [externalId] }),
    });
    await this.database.$executeRawUnsafe(
      `UPDATE "Shipment" SET status='PURCHASED',"updatedAt"=NOW() WHERE id=$1`,
      shipmentId,
    );
    await this.request(order.companyId, "/me/shipment/generate", {
      method: "POST",
      body: JSON.stringify({ orders: [externalId] }),
    });
    const labelUrl = await this.printWhenReady(order.companyId, externalId);
    const details = await this.request(
      order.companyId,
      `/me/orders/${encodeURIComponent(externalId)}`,
      { method: "GET" },
    ).catch(() => ({}));
    const trackingCode =
      String(details?.tracking || details?.tracking_code || "") || null;
    const trackingUrl =
      String(details?.tracking_url || details?.tracking?.url || "") || null;

    await this.database.$executeRawUnsafe(
      `UPDATE "Shipment"
          SET status='LABEL_READY',"labelUrl"=$2,"trackingCode"=$3,"trackingUrl"=$4,
              metadata=$5::jsonb,"updatedAt"=NOW()
        WHERE id=$1`,
      shipmentId,
      labelUrl || null,
      trackingCode,
      trackingUrl,
      JSON.stringify(details || {}),
    );

    await this.customerLifecycle.record(
      order.id,
      "SHIPMENT_CREATED",
      "Envio preparado",
      "A etiqueta de transporte foi emitida e o pedido está pronto para postagem.",
      "MELHOR_ENVIO",
      `sales-order:shipment-created:${order.id}`,
      { shipmentId, externalId, trackingCode, trackingUrl },
    );

    return {
      id: shipmentId,
      externalId,
      status: "LABEL_READY",
      labelUrl,
      trackingCode,
      trackingUrl,
    };
  }

  async applyTrackingUpdate(externalId: string, statusValue: string, payload: unknown) {
    const rows = await this.database.$queryRawUnsafe<any[]>(
      `SELECT * FROM "Shipment" WHERE provider='MELHOR_ENVIO' AND "externalId"=$1 LIMIT 1`,
      externalId,
    );
    const shipment = rows[0];
    if (!shipment) return { ignored: true };
    const normalized = statusValue.toLowerCase();
    const mapping = normalized.includes("deliver") && !normalized.includes("out")
      ? { status: "DELIVERED", order: "DELIVERED", event: "DELIVERED", title: "Pedido entregue", detail: "A transportadora confirmou a entrega do seu pedido." }
      : normalized.includes("out_for_delivery") || normalized.includes("saiu")
        ? { status: "OUT_FOR_DELIVERY", order: "SHIPPED", event: "OUT_FOR_DELIVERY", title: "Saiu para entrega", detail: "Seu pedido saiu para entrega no endereço informado." }
        : normalized.includes("post") || normalized.includes("transit") || normalized.includes("movimenta")
          ? { status: "IN_TRANSIT", order: "SHIPPED", event: "SHIPPED", title: "Pedido a caminho", detail: "Seu pedido foi postado e está a caminho." }
          : null;
    if (!mapping) return { ignored: true };
    await this.database.$executeRawUnsafe(
      `UPDATE "Shipment" SET status=$2,metadata=$3::jsonb,
         "postedAt"=CASE WHEN $2 IN ('IN_TRANSIT','OUT_FOR_DELIVERY','DELIVERED') THEN COALESCE("postedAt",NOW()) ELSE "postedAt" END,
         "deliveredAt"=CASE WHEN $2='DELIVERED' THEN COALESCE("deliveredAt",NOW()) ELSE "deliveredAt" END,"updatedAt"=NOW() WHERE id=$1`,
      shipment.id, mapping.status, JSON.stringify(payload || {}),
    );
    if (shipment.storefrontOrderId) {
      await this.database.$executeRawUnsafe(
        `UPDATE "StorefrontOrder" SET status=$2,"updatedAt"=NOW() WHERE id=$1`,
        shipment.storefrontOrderId,
        mapping.order,
      );
      await this.lifecycle.record(
        shipment.storefrontOrderId,
        mapping.event,
        mapping.title,
        mapping.detail,
        "CARRIER",
        `storefront:${mapping.event.toLowerCase()}:${shipment.storefrontOrderId}`,
        { externalId, status: statusValue },
      );
    } else if (shipment.salesOrderId) {
      await this.database.$executeRawUnsafe(
        `UPDATE "SalesOrder"
            SET status=$2,
                "shippedAt"=CASE WHEN $2='SHIPPED' THEN COALESCE("shippedAt",NOW()) ELSE "shippedAt" END,
                "deliveredAt"=CASE WHEN $2='DELIVERED' THEN COALESCE("deliveredAt",NOW()) ELSE "deliveredAt" END,
                "updatedAt"=NOW()
          WHERE id=$1 AND status IN ('INVOICED','SHIPPED','DELIVERED')`,
        shipment.salesOrderId,
        mapping.order,
      );
      await this.customerLifecycle.record(
        shipment.salesOrderId,
        mapping.event,
        mapping.title,
        mapping.detail,
        "CARRIER",
        `sales-order:${mapping.event.toLowerCase()}:${shipment.salesOrderId}`,
        { externalId, status: statusValue },
      );
    }
    return {
      updated: true,
      status: mapping.status,
      salesOrderId: shipment.salesOrderId ?? null,
      storefrontOrderId: shipment.storefrontOrderId ?? null,
    };
  }
}
