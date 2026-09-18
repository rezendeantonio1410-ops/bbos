import { Body, Controller, Headers, Param, Post, UnauthorizedException } from "@nestjs/common";
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
    @Headers("x-bbos-webhook-secret") suppliedSecret: string | undefined,
    @Body() body: any,
  ) {
    const secret = process.env.MELHOR_ENVIO_WEBHOOK_SECRET?.trim();
    if (!secret || suppliedSecret !== secret) throw new UnauthorizedException("Webhook logístico não autorizado.");
    const externalId = String(body?.id || body?.order_id || body?.data?.id || body?.data?.order_id || "");
    const status = String(body?.status || body?.data?.status || body?.event || "");
    if (!externalId || !status) return { accepted: true, ignored: true };
    return this.shipment.applyTrackingUpdate(externalId, status, body);
  }
}
