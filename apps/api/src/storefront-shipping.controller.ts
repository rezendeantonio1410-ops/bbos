import {
  BadRequestException,
  Body,
  Controller,
  Post,
  ServiceUnavailableException,
} from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";
import { Public } from "./auth.guard";

type QuotePayload = {
  postalCode: string;
  subtotalCents: number;
  weightGrams: number;
  name: string;
  serviceName: string;
  carrierName: string;
  priceCents: number;
  deliveryDays: number;
  expiresAt: string;
};

const digits = (value: unknown) => String(value ?? "").replace(/\D/g, "");

function quoteSecret() {
  const secret = process.env.STOREFRONT_QUOTE_SECRET?.trim();
  if (!secret)
    throw new ServiceUnavailableException(
      "O cálculo seguro da entrega ainda não está configurado.",
    );
  return secret;
}

function signature(value: string) {
  return createHmac("sha256", quoteSecret()).update(value).digest("base64url");
}

function encodeQuote(payload: QuotePayload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${signature(encoded)}`;
}

export function verifyShippingQuote(
  id: string,
  expected: { postalCode: string; subtotalCents: number; weightGrams: number },
) {
  const [encoded, supplied] = String(id || "").split(".");
  if (!encoded || !supplied)
    throw new BadRequestException("Cotação de entrega inválida.");
  const expectedSignature = signature(encoded);
  const a = Buffer.from(supplied);
  const b = Buffer.from(expectedSignature);
  if (a.length !== b.length || !timingSafeEqual(a, b))
    throw new BadRequestException("Cotação de entrega inválida.");
  let payload: QuotePayload;
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    throw new BadRequestException("Cotação de entrega inválida.");
  }
  if (
    payload.postalCode !== digits(expected.postalCode) ||
    payload.subtotalCents !== expected.subtotalCents ||
    payload.weightGrams !== expected.weightGrams ||
    new Date(payload.expiresAt).getTime() <= Date.now()
  )
    throw new BadRequestException(
      "A cotação de entrega expirou. Calcule novamente.",
    );
  return payload;
}

@Controller("storefront/shipping")
export class StorefrontShippingController {
  @Public()
  @Post("quotes")
  quote(
    @Body()
    body: {
      postalCode?: string;
      subtotalCents?: number;
      weightGrams?: number;
    },
  ) {
    const postalCode = digits(body.postalCode);
    const subtotalCents = Number(body.subtotalCents);
    const weightGrams = Number(body.weightGrams);
    if (postalCode.length !== 8)
      throw new BadRequestException("Informe um CEP válido.");
    if (
      !Number.isSafeInteger(subtotalCents) ||
      subtotalCents < 1 ||
      !Number.isSafeInteger(weightGrams) ||
      weightGrams < 1
    )
      throw new BadRequestException(
        "A sacola não possui peso ou valor válido.",
      );

    const region = Number(postalCode[0]);
    const free = subtotalCents >= 27000 && [0, 1, 2, 8, 9].includes(region);
    const extraKilos = Math.max(0, Math.ceil(weightGrams / 1000) - 1);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const base = {
      postalCode,
      subtotalCents,
      weightGrams,
      carrierName: "Entrega Bispo",
      expiresAt,
    };
    const options: QuotePayload[] = [
      {
        ...base,
        name: "Entrega cuidadosa",
        serviceName: "Econômica",
        priceCents: free ? 0 : 1590 + extraKilos * 450,
        deliveryDays: [8, 9].includes(region) ? 5 : 7,
      },
      {
        ...base,
        name: "Entrega mais rápida",
        serviceName: "Expressa",
        priceCents: 2490 + extraKilos * 650,
        deliveryDays: [8, 9].includes(region) ? 2 : 4,
      },
    ];
    return {
      options: options.map((option) => ({
        ...option,
        id: encodeQuote(option),
      })),
    };
  }
}
