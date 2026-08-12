import { Body, Controller, Get, Headers, Param, Patch, Post, Query, Res } from "@nestjs/common";
import { CommerceService } from "./commerce.service";
import { CommercialPriceService, type CommercialPriceContext } from "./commercial-price.service";

@Controller("commerce")
export class CommerceController {
  constructor(private readonly commerce: CommerceService, private readonly pricesService: CommercialPriceService) {}
  @Get("dashboard") dashboard(@Query("companyId") companyId?: string) { return this.commerce.dashboard(companyId); }
  @Get("channels") channels(@Query("companyId") companyId?: string) { return this.commerce.listChannels(companyId); }
  @Post("channels") createChannel(@Body() body: Parameters<CommerceService["createChannel"]>[0]) { return this.commerce.createChannel(body); }
  @Get("prices") prices(@Query() query: { companyId?: string; salesChannelId?: string; productVariantId?: string }) { return this.commerce.listPrices(query); }
  @Post("prices") createPrice(@Body() body: Parameters<CommerceService["createPrice"]>[0]) { return this.commerce.createPrice(body); }
  @Patch("prices/:id") updatePrice(@Param("id") id: string, @Body() body: Parameters<CommerceService["updatePrice"]>[1]) { return this.commerce.updatePrice(id, body); }
  @Get("catalog") catalog(@Query() query: Parameters<CommerceService["listCatalog"]>[0]) { return this.commerce.listCatalog(query); }
  @Get("catalog/documents") catalogDocuments(@Headers("x-user-id") userId: string) { return this.commerce.listCatalogDocuments(userId); }
  @Post("catalog/documents") generateCatalog(@Headers("x-user-id") userId: string, @Body() body: Parameters<CommerceService["generateCatalogDocument"]>[1]) { return this.commerce.generateCatalogDocument(userId, body ?? {}); }
  @Get("catalog/documents/:id/download") async downloadCatalog(@Headers("x-user-id") userId: string, @Param("id") id: string, @Res() response: { setHeader(name: string, value: string): void; send(body: Buffer): unknown }) { const result = await this.commerce.catalogDocumentPdf(userId, id); response.setHeader("Content-Type", "application/pdf"); response.setHeader("Content-Disposition", `attachment; filename="catalogo-${result.record.version}-${id}.pdf"`); return response.send(result.buffer); }
  @Get("catalog/validate/:id") validateCatalog(@Param("id") id: string) { return this.commerce.validateCatalogDocument(id); }
  @Get("catalog/:id") catalogItem(@Param("id") id: string, @Query() query: Parameters<CommerceService["getCatalogItem"]>[1]) { return this.commerce.getCatalogItem(id, query); }
  @Get("notifications") notifications(@Query() query: Parameters<CommerceService["listNotifications"]>[0]) { return this.commerce.listNotifications(query); }
  @Patch("notifications/:id/read") readNotification(@Param("id") id: string, @Body() body: { userId: string }) { return this.commerce.markNotificationRead(id, body.userId); }
  @Get("price-tables") priceTables(@Query("companyId") companyId?: string) { return this.commerce.listPriceTables(companyId); }
  @Post("price-tables") createPriceTable(@Body() body: Parameters<CommerceService["createPriceTable"]>[0]) { return this.commerce.createPriceTable(body); }
  @Post("price-tables/:id/items") createPriceTableItem(@Param("id") id: string, @Body() body: Parameters<CommerceService["createPriceTableItem"]>[1]) { return this.commerce.createPriceTableItem(id, body); }
  @Get("promotions") promotions(@Query("companyId") companyId?: string) { return this.commerce.listPromotions(companyId); }
  @Post("promotions") createPromotion(@Body() body: Parameters<CommerceService["createPromotion"]>[0]) { return this.commerce.createPromotion(body); }
  @Post("resolve-price") resolvePrice(@Body() body: CommercialPriceContext) { return this.pricesService.resolve(body); }
}
