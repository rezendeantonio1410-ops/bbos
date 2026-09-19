import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { PrismaClient } from "@bbos/database";
import { createHash, randomUUID } from "node:crypto";
import { MelhorEnvioAuthService } from "./melhor-envio-auth.service";

export type ShippingQuoteRequest = {
  postalCode: string;
  subtotalCents: number;
  weightGrams: number;
};

const digits = (value: unknown) => String(value ?? "").replace(/\D/g, "");
const cents = (value: unknown) => Math.round(Number(value) * 100);

@Injectable()
export class StorefrontShippingService {
  private readonly database = new PrismaClient();

  constructor(private readonly melhorEnvioAuth: MelhorEnvioAuthService) {}

  private provider() {
    return (process.env.SHIPPING_PROVIDER?.trim().toUpperCase() || "FIXED") as
      | "FIXED"
      | "MELHOR_ENVIO";
  }

  private originPostalCode() {
    const value = digits(process.env.SHIPPING_ORIGIN_POSTAL_CODE);
    if (value.length !== 8) {
      if (this.provider() === "FIXED") return "86000000";
      throw new ServiceUnavailableException("O CEP de origem da expedição ainda não está configurado.");
    }
    return value;
  }

  private fingerprint(input: ShippingQuoteRequest) {
    return createHash("sha256")
      .update(`${digits(input.postalCode)}:${input.subtotalCents}:${input.weightGrams}`)
      .digest("hex");
  }

  private isFreeShipping(postalCode: string, subtotalCents: number) {
    const prefix = Number(digits(postalCode).slice(0, 1));
    return subtotalCents >= 27000 && [0, 1, 2, 3, 8, 9].includes(prefix);
  }

  private packageFor(weightGrams: number) {
    const number = (name: string, fallback: number) => {
      const configured = process.env[name]?.trim();
      if (this.provider() === "MELHOR_ENVIO" && !configured)
        throw new ServiceUnavailableException(`${name} não configurado com a medida real da embalagem.`);
      const value = Number(configured ?? fallback);
      return Number.isFinite(value) && value > 0 ? value : fallback;
    };
    return {
      width: number("SHIPPING_PACKAGE_WIDTH_CM", 18),
      height: number("SHIPPING_PACKAGE_HEIGHT_CM", 14),
      length: number("SHIPPING_PACKAGE_LENGTH_CM", 24),
      weight: Math.max(0.3, weightGrams / 1000),
    };
  }

  private async melhorEnvio(companyId: string, input: ShippingQuoteRequest) {
    const token = await this.melhorEnvioAuth.accessToken(companyId);
    const base = (process.env.MELHOR_ENVIO_API_URL?.trim() || "https://melhorenvio.com.br/api/v2").replace(/\/$/, "");
    const selectedServices = (process.env.MELHOR_ENVIO_SERVICE_IDS || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const response = await fetch(`${base}/me/shipment/calculate`, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "user-agent": process.env.MELHOR_ENVIO_USER_AGENT?.trim() || "Bispo Coffees BBOS",
      },
      body: JSON.stringify({
        from: { postal_code: this.originPostalCode() },
        to: { postal_code: digits(input.postalCode) },
        package: this.packageFor(input.weightGrams),
        ...(selectedServices.length ? { services: selectedServices.join(",") } : {}),
      }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || !Array.isArray(body)) {
      const providerError = body && typeof body === "object"
        ? {
            message: (body as any).message,
            error: (body as any).error,
            errors: (body as any).errors,
          }
        : undefined;
      console.error("Melhor Envio recusou a cotação", {
        status: response.status,
        providerError,
      });
      throw new ServiceUnavailableException("Não foi possível obter o frete real agora. Tente novamente em instantes.");
    }
    return body
      .filter((option: any) => !option?.error && option?.id && Number(option?.custom_price ?? option?.price) >= 0)
      .map((option: any) => ({
        provider: "MELHOR_ENVIO" as const,
        serviceId: String(option.id),
        serviceName: String(option.name || "Entrega"),
        carrierName: String(option.company?.name || "Transportadora"),
        providerPriceCents: cents(option.custom_price ?? option.price),
        deliveryDays: Math.max(1, Number(option.custom_delivery_time ?? option.delivery_time ?? 1)),
        rawResponse: option,
      }));
  }

  private fixed(input: ShippingQuoteRequest) {
    const prefix = Number(digits(input.postalCode).slice(0, 1));
    const providerPriceCents = 1590 + Math.max(0, Math.ceil(input.weightGrams / 1000) - 1) * 450;
    return [{
      provider: "FIXED" as const,
      serviceId: "ECONOMICA",
      serviceName: "Entrega econômica",
      carrierName: "Bispo Coffees",
      providerPriceCents,
      deliveryDays: prefix >= 8 ? 4 : 7,
      rawResponse: { provisional: true },
    }];
  }

  async quote(companyId: string, request: ShippingQuoteRequest) {
    const input = {
      postalCode: digits(request.postalCode),
      subtotalCents: Number(request.subtotalCents),
      weightGrams: Number(request.weightGrams),
    };
    if (
      input.postalCode.length !== 8 ||
      !Number.isSafeInteger(input.subtotalCents) || input.subtotalCents <= 0 ||
      !Number.isSafeInteger(input.weightGrams) || input.weightGrams <= 0
    ) throw new BadRequestException("Dados de entrega inválidos.");

    const options = this.provider() === "MELHOR_ENVIO" ? await this.melhorEnvio(companyId, input) : this.fixed(input);
    if (!options.length) throw new ServiceUnavailableException("Nenhuma modalidade de entrega está disponível para este CEP.");
    const free = this.isFreeShipping(input.postalCode, input.subtotalCents);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const packageData = this.packageFor(input.weightGrams);
    const result = [];
    for (const option of options) {
      const id = randomUUID();
      const customerPriceCents = free ? 0 : option.providerPriceCents;
      await this.database.$executeRawUnsafe(
        `INSERT INTO "ShippingQuote"
          (id,"companyId",provider,status,"destinationPostalCode","originPostalCode","cartFingerprint",
           "serviceId","serviceName","carrierName","providerPriceCents","customerPriceCents","deliveryDays",
           currency,package,"rawResponse","expiresAt","createdAt","updatedAt")
         VALUES ($1,$2,$3,'VALID',$4,$5,$6,$7,$8,$9,$10,$11,$12,'BRL',$13::jsonb,$14::jsonb,$15,NOW(),NOW())`,
        id, companyId, option.provider, input.postalCode, this.originPostalCode(), this.fingerprint(input),
        option.serviceId, option.serviceName, option.carrierName, option.providerPriceCents, customerPriceCents,
        option.deliveryDays, JSON.stringify(packageData), JSON.stringify(option.rawResponse), expiresAt,
      );
      result.push({
        id,
        name: free ? `${option.serviceName} · frete grátis Bispo` : option.serviceName,
        serviceName: option.serviceName,
        carrierName: option.carrierName,
        priceCents: customerPriceCents,
        providerPriceCents: option.providerPriceCents,
        deliveryDays: option.deliveryDays,
        expiresAt: expiresAt.toISOString(),
      });
    }
    return { provider: this.provider(), provisional: this.provider() === "FIXED", options: result };
  }

  async validateQuote(companyId: string, quoteId: string, input: ShippingQuoteRequest) {
    const rows = await this.database.$queryRawUnsafe<any[]>(
      `SELECT * FROM "ShippingQuote" WHERE id=$1 AND "companyId"=$2 LIMIT 1`,
      quoteId,
      companyId,
    );
    const quote = rows[0];
    if (!quote || quote.status !== "VALID" || new Date(quote.expiresAt).getTime() <= Date.now())
      throw new BadRequestException("A cotação do frete expirou. Calcule novamente antes de pagar.");
    if (quote.cartFingerprint !== this.fingerprint(input) || quote.destinationPostalCode !== digits(input.postalCode))
      throw new BadRequestException("A cotação não corresponde aos itens e ao endereço deste pedido.");
    return quote;
  }
}
