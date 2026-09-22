import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { PrismaClient } from "@bbos/database";
import { createHash, randomUUID } from "node:crypto";
import { MelhorEnvioAuthService } from "./melhor-envio-auth.service";
import { selectCustomerShippingOptions } from "./storefront-shipping-selection";

export type ShippingQuoteRequest = {
  postalCode: string;
  subtotalCents: number;
  weightGrams: number;
  packageWidthCm?: number;
  packageHeightCm?: number;
  packageLengthCm?: number;
  packageCount?: number;
  packages?: Array<{ widthCm: number; heightCm: number; lengthCm: number; weightGrams?: number }>;
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
    const packagesKey = input.packages?.length
      ? JSON.stringify(input.packages.map((item) => ({
          widthCm: Number(item.widthCm),
          heightCm: Number(item.heightCm),
          lengthCm: Number(item.lengthCm),
          weightGrams: item.weightGrams == null ? null : Number(item.weightGrams),
        })))
      : "";
    return createHash("sha256")
      .update(`${digits(input.postalCode)}:${input.subtotalCents}:${input.weightGrams}:${input.packageWidthCm ?? ""}:${input.packageHeightCm ?? ""}:${input.packageLengthCm ?? ""}:${input.packageCount ?? 1}:${packagesKey}`)
      .digest("hex");
  }

  private isFreeShipping(postalCode: string, subtotalCents: number) {
    const prefix = Number(digits(postalCode).slice(0, 1));
    return subtotalCents >= 27000 && [0, 1, 2, 3, 8, 9].includes(prefix);
  }

  private packageFor(weightGrams: number, override?: { widthCm?: number; heightCm?: number; lengthCm?: number }) {
    const number = (name: string, fallback: number, custom?: number) => {
      if (Number.isFinite(custom) && Number(custom) > 0) return Number(custom);
      const configured = process.env[name]?.trim();
      if (this.provider() === "MELHOR_ENVIO" && !configured)
        throw new ServiceUnavailableException(`${name} não configurado com a medida real da embalagem.`);
      const value = Number(configured ?? fallback);
      return Number.isFinite(value) && value > 0 ? value : fallback;
    };
    return {
      width: number("SHIPPING_PACKAGE_WIDTH_CM", 18, override?.widthCm),
      height: number("SHIPPING_PACKAGE_HEIGHT_CM", 14, override?.heightCm),
      length: number("SHIPPING_PACKAGE_LENGTH_CM", 24, override?.lengthCm),
      weight: Math.max(0.3, weightGrams / 1000),
    };
  }

  private async melhorEnvio(
    companyId: string,
    input: ShippingQuoteRequest,
    policy: { includeAllServices?: boolean } = {},
  ) {
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
        volumes: input.packages?.length
          ? input.packages.map((item) => ({
              width: Number(item.widthCm),
              height: Number(item.heightCm),
              length: Number(item.lengthCm),
              weight: Math.max(0.3, Number(item.weightGrams ?? 0) / 1000),
            }))
          : Array.from({ length: Math.max(1, input.packageCount ?? 1) }, () => this.packageFor(
              Math.ceil(input.weightGrams / Math.max(1, input.packageCount ?? 1)),
              {
                widthCm: input.packageWidthCm,
                heightCm: input.packageHeightCm,
                lengthCm: input.packageLengthCm,
              },
            )),
        ...(!policy.includeAllServices && selectedServices.length ? { services: selectedServices.join(",") } : {}),
      }),
    });
    const body = await response.json().catch(() => null);
    const options = Array.isArray(body)
      ? body
      : Array.isArray(body?.data)
        ? body.data
        : body && typeof body === "object" && ((body as any).id || (body as any).error)
          ? [body]
        : body && typeof body === "object"
          ? Object.values(body).filter(
              (value: any) => value && typeof value === "object" && (value.id || value.error),
            )
          : [];
    if (!response.ok) {
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
    if (!options.length) {
      console.error("Melhor Envio não retornou serviços de frete", {
        bodyKeys: body && typeof body === "object" ? Object.keys(body) : [],
      });
      throw new ServiceUnavailableException("Nenhuma modalidade de entrega está habilitada no Melhor Envio para este CEP.");
    }
    const serviceErrors = options
      .filter((option: any) => option?.error)
      .map((option: any) => ({
        id: option.id,
        name: option.name,
        error: option.error,
      }));
    if (serviceErrors.length) {
      console.error("Melhor Envio recusou serviços da cotação", { serviceErrors });
    }
    const eligibleOptions = options.filter(
      (option: any) => !option?.error && option?.id && Number(option?.custom_price ?? option?.price) >= 0,
    );
    if (!eligibleOptions.length) {
      console.log(`ME_QUOTE_DIAGNOSTIC ${JSON.stringify(options.map((option: any) => ({
        id: option?.id,
        name: option?.name,
        error: option?.error,
        price: option?.custom_price ?? option?.price,
      })))}`);
    }
    return eligibleOptions
      .map((option: any) => ({
        provider: "MELHOR_ENVIO" as const,
        serviceId: String(option.id),
        serviceName: String(option.name || "Entrega"),
        carrierName: String(option.company?.name || "Transportadora"),
        providerPriceCents: cents(option.custom_price ?? option.price),
        deliveryDays: Math.max(1, Number(option.custom_delivery_time ?? option.delivery_time ?? 1)),
        carrierLogoUrl: option.company?.picture ? String(option.company.picture) : null,
        postingType: String(option.company?.name ?? "").toLowerCase().includes("correios")
          ? "Agência dos Correios"
          : "Ponto da transportadora",
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

  async quote(
    companyId: string,
    request: ShippingQuoteRequest,
    policy: { allowFreeShipping?: boolean; includeAllServices?: boolean } = {},
  ) {
    const input = {
      postalCode: digits(request.postalCode),
      subtotalCents: Number(request.subtotalCents),
      weightGrams: Number(request.weightGrams),
      packageWidthCm: request.packageWidthCm == null ? undefined : Number(request.packageWidthCm),
      packageHeightCm: request.packageHeightCm == null ? undefined : Number(request.packageHeightCm),
      packageLengthCm: request.packageLengthCm == null ? undefined : Number(request.packageLengthCm),
      packageCount: request.packageCount == null ? 1 : Number(request.packageCount),
      packages: request.packages?.map((item) => ({
        widthCm: Number(item.widthCm),
        heightCm: Number(item.heightCm),
        lengthCm: Number(item.lengthCm),
        weightGrams: item.weightGrams == null ? undefined : Number(item.weightGrams),
      })),
    };
    if (
      input.postalCode.length !== 8 ||
      !Number.isSafeInteger(input.subtotalCents) || input.subtotalCents <= 0 ||
      !Number.isSafeInteger(input.weightGrams) || input.weightGrams <= 0 ||
      [input.packageWidthCm, input.packageHeightCm, input.packageLengthCm].some(
        (value) => value != null && (!Number.isFinite(value) || value <= 0),
      ) ||
      !Number.isSafeInteger(input.packageCount) || input.packageCount < 1 || input.packageCount > 50 ||
      (input.packages?.length
        ? input.packages.length > 50 || input.packages.some((item) =>
            !Number.isFinite(item.widthCm) || item.widthCm <= 0 ||
            !Number.isFinite(item.heightCm) || item.heightCm <= 0 ||
            !Number.isFinite(item.lengthCm) || item.lengthCm <= 0 ||
            item.weightGrams == null || !Number.isFinite(item.weightGrams) || item.weightGrams <= 0
          )
        : false)
    ) throw new BadRequestException("Dados de entrega, dimensões, pesos ou quantidade de caixas inválidos.");

    const providerOptions = this.provider() === "MELHOR_ENVIO"
      ? await this.melhorEnvio(companyId, input, policy)
      : this.fixed(input);
    const free = policy.allowFreeShipping !== false && this.isFreeShipping(input.postalCode, input.subtotalCents);
    const options = policy.includeAllServices
      ? providerOptions
      : selectCustomerShippingOptions(providerOptions, free);
    if (!options.length) throw new ServiceUnavailableException("Nenhuma modalidade de entrega está disponível para este CEP.");
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const packageCount = input.packages?.length || Math.max(1, input.packageCount ?? 1);
    const packageWeightGrams = Math.ceil(input.weightGrams / packageCount);
    const packagePayload = input.packages?.length
      ? input.packages.map((item) => ({
          width: Number(item.widthCm),
          height: Number(item.heightCm),
          length: Number(item.lengthCm),
          weight: Math.max(0.3, Number(item.weightGrams) / 1000),
        }))
      : Array.from({ length: packageCount }, () => this.packageFor(packageWeightGrams, {
          widthCm: input.packageWidthCm,
          heightCm: input.packageHeightCm,
          lengthCm: input.packageLengthCm,
        }));
    const packageData = packagePayload[0]!;
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
        option.deliveryDays, JSON.stringify(packagePayload), JSON.stringify(option.rawResponse), expiresAt,
      );
      result.push({
        id,
        name: free ? `${option.serviceName} · frete grátis Bispo` : option.serviceName,
        serviceName: option.serviceName,
        carrierName: option.carrierName,
        priceCents: customerPriceCents,
        providerPriceCents: option.providerPriceCents,
        deliveryDays: option.deliveryDays,
        carrierLogoUrl: (option as any).carrierLogoUrl ?? null,
        postingType: (option as any).postingType ?? "Postagem conforme modalidade",
        customerLabel: "customerLabel" in option ? option.customerLabel : null,
        expiresAt: expiresAt.toISOString(),
      });
    }
    return {
      provider: this.provider(),
      provisional: this.provider() === "FIXED",
      summary: {
        originPostalCode: this.originPostalCode(),
        destinationPostalCode: input.postalCode,
        weightGrams: input.weightGrams,
        widthCm: packageData.width,
        heightCm: packageData.height,
        lengthCm: packageData.length,
        packageCount,
        weightPerPackageGrams: input.packages?.length ? undefined : packageWeightGrams,
        packages: packagePayload,
      },
      options: result,
    };
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
