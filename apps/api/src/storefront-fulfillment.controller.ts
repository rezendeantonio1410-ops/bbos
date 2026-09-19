import { Body, Controller, Headers, Param, Post, RawBodyRequest, Req, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import { Public } from "./auth.guard";
import { MelhorEnvioShipmentService } from "./melhor-envio-shipment.service";

@Controller("storefront/fulfillment")
export class StorefrontFulfillmentController {
  constructor(private readonly shipment: MelhorEnvioShipmentService) {}

  @Post(":orderId/invoice-authorized")
  invoiceAuthorized(@Param("orderId") orderId: string, @Body() body: Record<string, unknown>) {
    return this.shipment.markInvoiceAuthorized(orderId, body || {});
  }

  @Post(":orderId/label")
  label(@Param("orderId") orderId: string) {
    return this.shipment.createLabel(orderId);
  }

  @Public()
  @Post("melhor-envio/webhook")
  webhook(
    @Headers("x-me-signature") suppliedSignature: string | undefined,
    @Req() request: RawBodyRequest<Request>,
    @Body() body: any,
  ) {
    const secret = process.env.MELHOR_ENVIO_CLIENT_SECRET?.trim();
    const rawBody = request.rawBody;
    if (!secret || !suppliedSignature || !rawBody)
      throw new UnauthorizedException("Webhook logístico não autorizado.");
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    const provided = suppliedSignature.trim().replace(/^sha256=/i, "");
    const expectedBuffer = Buffer.from(expected, "utf8");
    const providedBuffer = Buffer.from(provided, "utf8");
    if (expectedBuffer.length !== providedBuffer.length || !timingSafeEqual(expectedBuffer, providedBuffer))
      throw new UnauthorizedException("Assinatura do webhook logístico inválida.");
    const externalId = String(body?.id || body?.order_id || body?.data?.id || body?.data?.order_id || "");
    const status = String(body?.status || body?.data?.status || body?.event || "");
    if (!externalId || !status) return { accepted: true, ignored: true };
    return this.shipment.applyTrackingUpdate(externalId, status, body);
  }
}
