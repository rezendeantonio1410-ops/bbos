import { Injectable, Logger, OnModuleInit, ServiceUnavailableException } from "@nestjs/common";

type MercadoPagoItem = {
  externalCode: string;
  title: string;
  quantity: number;
  unitPriceCents: number;
  description?: string;
};

type MercadoPagoCheckoutInput = {
  paymentMethod: "PIX" | "CARD";
  idempotencyKey: string;
  orderCode: string;
  totalCents: number;
  items: MercadoPagoItem[];
  shippingCents: number;
  discountCents?: number;
  couponCode?: string;
  payer: {
    name: string;
    email: string;
    phone: string;
    cpf: string;
  };
  delivery: {
    postalCode: string;
    street: string;
    number: string;
    complement?: string;
    district: string;
    city: string;
    state: string;
  };
};

export type MercadoPagoOrder = {
  id: string;
  checkout_url?: string;
  external_reference?: string;
  total_amount?: string;
  status?: string;
  status_detail?: string;
  transactions?: {
    payments?: Array<{
      id?: string;
      status?: string;
      status_detail?: string;
    }>;
  };
};

const money = (cents: number) => (cents / 100).toFixed(2);

@Injectable()
export class MercadoPagoService implements OnModuleInit {
  private readonly logger = new Logger(MercadoPagoService.name);

  onModuleInit() {
    this.logger.log(
      `Mercado Pago production readiness: ${this.configured() ? "configured" : "missing"}`,
    );
  }

  configured() {
    return Boolean(
      process.env.MERCADO_PAGO_PRODUCTION_ACCESS_TOKEN?.trim() ||
      process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim(),
    );
  }

  private accessToken() {
    const token =
      process.env.MERCADO_PAGO_PRODUCTION_ACCESS_TOKEN?.trim() ||
      process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim();
    if (!token)
      throw new ServiceUnavailableException(
        "O pagamento pelo Mercado Pago ainda não está configurado.",
      );
    if (/^TEST[-_]/i.test(token))
      throw new ServiceUnavailableException(
        "O Mercado Pago está configurado com credencial de teste. Configure a Access Token de produção antes de receber pagamentos reais.",
      );
    return token;
  }

  private storefrontUrl() {
    return (
      process.env.STOREFRONT_WEB_URL?.trim() ||
      "https://bbos-ecommerce-preview-v2.onrender.com"
    ).replace(/\/$/, "");
  }

  private async request(path: string, init?: RequestInit) {
    const response = await fetch(`https://api.mercadopago.com${path}`, {
      ...init,
      headers: {
        accept: "application/json",
        authorization: `Bearer ${this.accessToken()}`,
        "content-type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    const text = await response.text();
    let body: any = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = {};
    }
    if (!response.ok) {
      const code =
        body?.code ||
        body?.error ||
        body?.errors?.[0]?.code ||
        body?.details?.[0]?.code ||
        `HTTP_${response.status}`;
      console.error("Mercado Pago recusou a operação", {
        status: response.status,
        code,
        message: body?.message || body?.error_description || null,
        details: Array.isArray(body?.details)
          ? body.details.map((detail: any) => ({
              code: detail?.code,
              field: detail?.field || detail?.path || null,
              message: detail?.message || detail?.description || null,
            }))
          : Array.isArray(body?.errors)
            ? body.errors.map((detail: any) => ({
                code: detail?.code,
                field: detail?.field || detail?.path || null,
                message: detail?.message || detail?.description || null,
              }))
            : null,
        requestId: response.headers.get("x-request-id"),
      });
      const error = new ServiceUnavailableException(
        "Não foi possível iniciar o pagamento agora. Tente novamente em instantes.",
      ) as ServiceUnavailableException & {
        mercadoPagoCode?: string;
        mercadoPagoStatus?: number;
      };
      error.mercadoPagoCode = String(code);
      error.mercadoPagoStatus = response.status;
      throw error;
    }
    return body as MercadoPagoOrder;
  }

  async createCheckout(input: MercadoPagoCheckoutInput) {
    const returnBase = `${this.storefrontUrl()}/loja/finalizar`;
    let checkoutItems = input.items.map((item) => ({
      title: item.title,
      quantity: item.quantity,
      unit_measure: "unit",
      unit_price: money(item.unitPriceCents),
      total_amount: money(item.unitPriceCents * item.quantity),
    }));
    if ((input.discountCents || 0) > 0) {
      checkoutItems = [{
        title: "Cafés Bispo",
        quantity: 1,
        unit_measure: "unit",
        unit_price: money(input.items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0) - (input.discountCents || 0)),
        total_amount: money(input.items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0) - (input.discountCents || 0)),
      }];
    }
    if (input.shippingCents > 0) {
      checkoutItems.push({
        title: "Entrega Bispo Coffees",
        quantity: 1,
        unit_measure: "unit",
        unit_price: money(input.shippingCents),
        total_amount: money(input.shippingCents),
      });
    }

    let order: MercadoPagoOrder;
    try {
      order = await this.request("/v1/orders", {
        method: "POST",
        headers: { "X-Idempotency-Key": input.idempotencyKey },
        body: JSON.stringify({
          type: "online",
          processing_mode: "manual",
          capture_mode: "automatic_async",
          total_amount: money(input.totalCents),
          external_reference: input.orderCode,
          expiration_time: "P1D",
          payer: {
            email: input.payer.email.trim().toLowerCase(),
          },
          config: {
            payment_method: {
              not_allowed_types: input.paymentMethod === "PIX"
                ? ["credit_card", "debit_card", "prepaid_card", "ticket", "account_money", "digital_currency"]
                : ["bank_transfer", "ticket", "account_money", "digital_currency"],
            },
            online: {
              success_url: `${returnBase}?payment=success`,
              failure_url: `${returnBase}?payment=failure`,
              pending_url: `${returnBase}?payment=pending`,
              auto_return: "approved",
            },
          },
          items: checkoutItems,
        }),
      });
    } catch (error) {
      const providerCode = String(
        (error as { mercadoPagoCode?: string })?.mercadoPagoCode || "",
      );
      if (providerCode !== "unsupported_properties") throw error;

      // Compatibility fallback: exact minimal contract from Mercado Pago's
      // Checkout Pro Orders documentation. This keeps checkout available even
      // if optional properties vary by account/application rollout.
      const fallbackKey = `${input.idempotencyKey}-minimal`.slice(0, 128);
      order = await this.request("/v1/orders", {
        method: "POST",
        headers: { "X-Idempotency-Key": fallbackKey },
        body: JSON.stringify({
          type: "online",
          processing_mode: "manual",
          total_amount: money(input.totalCents),
          external_reference: input.orderCode,
          payer: {
            email: input.payer.email.trim().toLowerCase(),
          },
          items: checkoutItems.map((item: any) => ({
            title: item.title,
            unit_price: item.unit_price,
            quantity: item.quantity,
          })),
        }),
      });
      console.warn("Mercado Pago order created with documented minimal fallback", {
        orderCode: input.orderCode,
      });
    }

    if (!order.id || !order.checkout_url)
      throw new ServiceUnavailableException(
        "O Mercado Pago não devolveu o endereço de pagamento.",
      );
    return order;
  }

  getOrder(orderId: string) {
    return this.request(`/v1/orders/${encodeURIComponent(orderId)}`, {
      method: "GET",
    });
  }
}
