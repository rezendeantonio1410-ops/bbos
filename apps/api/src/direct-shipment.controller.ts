import { Controller, Get, Header, Param, Post, Req, Res, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { AuthService } from "./auth.service";
import { DirectShipmentService } from "./direct-shipment.service";

/** Lado da Bispo do envio direto do distribuidor: ver a ficha, imprimir os documentos e marcar Postado. */
@Controller()
export class DirectShipmentController {
  constructor(
    private readonly auth: AuthService,
    private readonly directShipments: DirectShipmentService,
  ) {}

  private async actor(req: Request) {
    const actor = await this.auth.resolve(this.auth.readToken(req));
    if (!actor) throw new UnauthorizedException("Sessão inválida.");
    return actor;
  }

  /** Resumo para o selo "Envio direto" na lista de pedidos. */
  @Get("direct-shipments")
  @Header("Cache-Control", "private, no-store")
  async list(@Req() req: Request) {
    const actor = await this.actor(req);
    return this.directShipments.list(actor.companyId);
  }

  @Get("sales-orders/:orderId/direct-shipment")
  @Header("Cache-Control", "private, no-store")
  async get(@Param("orderId") orderId: string, @Req() req: Request) {
    const actor = await this.actor(req);
    return { shipment: await this.directShipments.get(actor.companyId, orderId) };
  }

  @Get("sales-orders/:orderId/direct-shipment/documents/:documentId")
  async document(
    @Param("orderId") orderId: string,
    @Param("documentId") documentId: string,
    @Req() req: Request,
    @Res() response: any,
  ) {
    const actor = await this.actor(req);
    const document = await this.directShipments.document(actor.companyId, orderId, documentId);
    response.set({
      "Content-Type": document.mimeType,
      "Content-Disposition": `inline; filename="${document.fileName}"`,
      "Content-Length": document.data.length,
      "Cache-Control": "private, no-store",
    });
    response.send(document.data);
  }

  @Post("sales-orders/:orderId/direct-shipment/posted")
  async posted(@Param("orderId") orderId: string, @Req() req: Request) {
    const actor = await this.actor(req);
    return {
      shipment: await this.directShipments.markPosted(actor.companyId, orderId, {
        name: String(actor.name ?? "Bispo"),
        email: (actor as { email?: string | null }).email ?? null,
      }),
    };
  }
}
