import { Injectable, ServiceUnavailableException } from "@nestjs/common";

type MelhorEnvioQuote = {
  id?: number;
  name?: string;
  price?: string;
  custom_price?: string;
  delivery_time?: number;
  custom_delivery_time?: number;
  company?: { id?: number; name?: string };
  error?: string;
};

export type ShippingProviderQuote = {
  provider: "melhor_envio";
  providerServiceId: number;
  serviceName: string;
  carrierName: string;
  commercialPriceCents: number;
  deliveryDays: number;
};

export type ShipmentParty = {
  name: string;
  email: string;
  phone: string;
  document?: string;
  company_document?: string;
  state_register?: string;
  economic_activity_code?: string;
  address: string;
  complement?: string;
  number: string;
  district: string;
  city: string;
  postal_code: string;
  state_abbr: string;
  country_id?: "BR";
};

export type ShipmentPurchaseInput = {
  serviceId: number;
  orderCode: string;
  orderUrl?: string;
  invoiceKey: string;
  recipient: ShipmentParty;
  products: Array<{
    name: string;
    quantity: number;
    unitaryValueCents: number;
  }>;
  weightGrams: number;
  insuredValueCents: number;
};

const digits = (value: unknown) => String(value ?? "").replace(/\D/g, "");

function required(name: string, alternatives: string[] = []) {
  const names = [name, ...alternatives];
  for (const key of names) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  throw new ServiceUnavailableException(
    `A integração de entrega ainda não está completa (${name}).`,
  );
}

function toCents(value: unknown) {
  const amount = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

@Injectable()
export class MelhorEnvioService {
  private settings() {
    return {
      baseUrl: required("MELHOR_ENVIO_API_URL").replace(/\/$/, ""),
      token: required("MELHOR_ENVIO_ACCESS_TOKEN", ["MELHOR_ENVIO_TOKEN"]),
      userAgent:
        process.env.MELHOR_ENVIO_USER_AGENT?.trim() ||
        "BBOS Bispo Coffees (jrezende@bispocoffees.com)",
    };
  }

  private async request<T>(path: string, body: unknown): Promise<T> {
    const settings = this.settings();
    const response = await fetch(`${settings.baseUrl}${path}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.token}`,
        "User-Agent": settings.userAgent,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    }).catch(() => {
      throw new ServiceUnavailableException(
        "Não foi possível acessar o Melhor Envio agora. Tente novamente.",
      );
    });
    if (!response.ok)
      throw new ServiceUnavailableException(
        "O Melhor Envio não concluiu a operação. Verifique os dados e tente novamente.",
      );
    return (await response.json()) as T;
  }

  private sender(): ShipmentParty {
    const raw = required("MELHOR_ENVIO_SENDER_JSON");
    try {
      const sender = JSON.parse(raw) as ShipmentParty;
      const mandatory = [
        sender.name,
        sender.email,
        sender.phone,
        sender.company_document,
        sender.address,
        sender.number,
        sender.district,
        sender.city,
        sender.postal_code,
        sender.state_abbr,
      ];
      if (mandatory.some((value) => !String(value || "").trim())) throw 0;
      return sender;
    } catch {
      throw new ServiceUnavailableException(
        "Os dados do remetente da Bispo Coffees estão incompletos.",
      );
    }
  }

  async calculate(input: {
    postalCode: string;
    subtotalCents: number;
    weightGrams: number;
  }): Promise<ShippingProviderQuote[]> {
    const settings = this.settings();
    const originPostalCode = digits(
      required("MELHOR_ENVIO_ORIGIN_POSTAL_CODE", [
        "STOREFRONT_ORIGIN_POSTAL_CODE",
      ]),
    );
    if (originPostalCode.length !== 8)
      throw new ServiceUnavailableException(
        "O CEP de origem do Melhor Envio está inválido.",
      );

    // A embalagem cresce de forma conservadora conforme o número aproximado
    // de pacotes de 500 g, sem ultrapassar os limites usuais das cotações.
    const units = Math.max(1, Math.ceil(input.weightGrams / 500));
    const height = Math.min(60, Math.max(6, units * 4));
    const response = await fetch(
      `${settings.baseUrl}/api/v2/me/shipment/calculate`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${settings.token}`,
          "User-Agent": settings.userAgent,
        },
        body: JSON.stringify({
          from: { postal_code: originPostalCode },
          to: { postal_code: digits(input.postalCode) },
          products: [
            {
              id: "bispo-coffees-order",
              width: 20,
              height,
              length: 30,
              weight: Math.max(0.1, input.weightGrams / 1000),
              insurance_value: input.subtotalCents / 100,
              quantity: 1,
            },
          ],
          options: { receipt: false, own_hand: false, collect: false },
        }),
        signal: AbortSignal.timeout(10_000),
      },
    ).catch(() => {
      throw new ServiceUnavailableException(
        "Não foi possível consultar as transportadoras agora. Tente novamente.",
      );
    });

    if (!response.ok) {
      // Nunca repassamos a resposta bruta: ela pode conter detalhes da conta.
      throw new ServiceUnavailableException(
        "O serviço de entrega não respondeu corretamente. Tente novamente.",
      );
    }

    const body = (await response.json()) as MelhorEnvioQuote[];
    const quotes = (Array.isArray(body) ? body : [])
      .filter(
        (quote) =>
          !quote.error &&
          Number.isInteger(quote.id) &&
          toCents(quote.custom_price ?? quote.price) > 0,
      )
      .map((quote) => ({
        provider: "melhor_envio" as const,
        providerServiceId: quote.id as number,
        serviceName: quote.name?.trim() || "Entrega",
        carrierName: quote.company?.name?.trim() || "Transportadora",
        commercialPriceCents: toCents(quote.custom_price ?? quote.price),
        deliveryDays: Math.max(
          1,
          Number(quote.custom_delivery_time ?? quote.delivery_time ?? 1),
        ),
      }))
      .sort(
        (a, b) =>
          a.commercialPriceCents - b.commercialPriceCents ||
          a.deliveryDays - b.deliveryDays,
      );

    if (!quotes.length)
      throw new ServiceUnavailableException(
        "Não encontramos uma entrega disponível para este CEP.",
      );
    return quotes;
  }

  async createShipment(input: ShipmentPurchaseInput) {
    const units = Math.max(1, Math.ceil(input.weightGrams / 500));
    const cart = await this.request<{ id?: string }>("/api/v2/me/cart", {
      service: input.serviceId,
      from: this.sender(),
      to: { ...input.recipient, country_id: "BR" },
      products: input.products.map((product) => ({
        name: product.name,
        quantity: product.quantity,
        unitary_value: product.unitaryValueCents / 100,
      })),
      volumes: [
        {
          width: 20,
          height: Math.min(60, Math.max(6, units * 4)),
          length: 30,
          weight: Math.max(0.1, input.weightGrams / 1000),
        },
      ],
      options: {
        platform: "BBOS · Bispo Coffees",
        reminder: `Pedido ${input.orderCode}`,
        insurance_value: input.insuredValueCents / 100,
        receipt: false,
        own_hand: false,
        reverse: false,
        invoice: { key: digits(input.invoiceKey) },
        tags: [{ tag: input.orderCode, url: input.orderUrl || null }],
      },
    });
    if (!cart.id)
      throw new ServiceUnavailableException(
        "O Melhor Envio não retornou o identificador da remessa.",
      );
    return { providerShipmentId: cart.id };
  }

  async completeShipment(providerShipmentId: string) {
    await this.request("/api/v2/me/shipment/checkout", {
      orders: [providerShipmentId],
    });
    await this.request("/api/v2/me/shipment/generate", {
      orders: [providerShipmentId],
    });
    const printed = await this.request<{ url?: string }>(
      "/api/v2/me/shipment/print",
      { mode: "public", orders: [providerShipmentId] },
    );
    return { providerShipmentId, labelUrl: printed.url || null };
  }

  async track(providerShipmentId: string) {
    return this.request<Record<string, any>>("/api/v2/me/shipment/tracking", {
      orders: [providerShipmentId],
    });
  }
}
