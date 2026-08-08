import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { CommerceService } from "./commerce.service";

@Controller("commerce")
export class CommerceController {
  constructor(private readonly commerce: CommerceService) {}
  @Get("dashboard") dashboard(@Query("companyId") companyId?: string) { return this.commerce.dashboard(companyId); }
  @Get("channels") channels(@Query("companyId") companyId?: string) { return this.commerce.listChannels(companyId); }
  @Post("channels") createChannel(@Body() body: Parameters<CommerceService["createChannel"]>[0]) { return this.commerce.createChannel(body); }
  @Get("prices") prices(@Query() query: { companyId?: string; salesChannelId?: string; productVariantId?: string }) { return this.commerce.listPrices(query); }
  @Post("prices") createPrice(@Body() body: Parameters<CommerceService["createPrice"]>[0]) { return this.commerce.createPrice(body); }
}
