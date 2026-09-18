import { Body, Controller, Post } from "@nestjs/common";
import { PrismaClient } from "@bbos/database";
import { Public } from "./auth.guard";
import { StorefrontShippingService, type ShippingQuoteRequest } from "./storefront-shipping.service";

@Controller("storefront/shipping")
export class StorefrontShippingController {
  private readonly database = new PrismaClient();

  constructor(private readonly shipping: StorefrontShippingService) {}

  private async companyId() {
    const configured = process.env.STOREFRONT_COMPANY_ID?.trim();
    if (configured) return configured;
    const companies = await this.database.company.findMany({ select: { id: true }, take: 2 });
    if (companies.length !== 1) throw new Error("Configure STOREFRONT_COMPANY_ID.");
    return companies[0]!.id;
  }

  @Public()
  @Post("quotes")
  async quotes(@Body() body: ShippingQuoteRequest) {
    return this.shipping.quote(await this.companyId(), body);
  }
}
