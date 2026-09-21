import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Res,
} from "@nestjs/common";
import { PrismaClient } from "@bbos/database";
import type { Response } from "express";
import { Public } from "./auth.guard";
import { ProductsService } from "./products.service";

@Controller("storefront/catalog")
export class StorefrontCatalogController {
  private readonly database = new PrismaClient();

  constructor(private readonly products: ProductsService) {}

  private async companyId() {
    const configured = process.env.STOREFRONT_COMPANY_ID?.trim();
    if (configured) return configured;
    const companies = await this.database.company.findMany({ select: { id: true }, take: 2 });
    if (companies.length !== 1)
      throw new BadRequestException("A empresa da loja não está configurada.");
    return companies[0]!.id;
  }

  @Public()
  @Get("images")
  async images() {
    return this.products.listPublicStorefrontImages(await this.companyId());
  }

  @Public()
  @Get("images/:imageId")
  async image(@Param("imageId") imageId: string, @Res() response: Response) {
    const image = await this.products.getPublicStorefrontImage(
      imageId,
      await this.companyId(),
    );
    if (!image) throw new NotFoundException("Imagem não encontrada.");
    response.set({
      "Content-Type": image.mimeType,
      "Content-Disposition": `inline; filename="${image.fileName.replaceAll('"', "")}"`,
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      "Last-Modified": image.updatedAt.toUTCString(),
    });
    response.send(Buffer.from(image.data));
  }
}
