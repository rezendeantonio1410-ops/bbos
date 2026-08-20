import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  ServiceUnavailableException,
} from "@nestjs/common";
import type { Request } from "express";
import {
  isProductLine,
  type CreateProductSkuInput,
  type CreateCatalogProductInput,
  type CreateProductVariantInput,
  // @ts-expect-error Nest uses legacy Node resolution; runtime resolves the package export.
} from "@bbos/shared/product-presentation";
import { ProductsService } from "./products.service";
import { AuthService } from "./auth.service";
import { requireSession } from "./auth-context";

@Controller("products")
export class ProductsController {
  constructor(private readonly products: ProductsService, private readonly auth: AuthService) {}

  @Get()
  async listCatalog(@Req() req: Request) {
    try {
      const actor = await requireSession(req, this.auth);
      return await this.products.listCatalog(actor.companyId);
    } catch (error) {
      throwProductError(error);
    }
  }

  @Post()
  async createProduct(@Body() input: CreateCatalogProductInput, @Req() req: Request) {
    try {
      const actor = await requireSession(req, this.auth);
      return await this.products.createProduct(input, actor.companyId);
    } catch (error) {
      throwProductError(error);
    }
  }

  @Get("lines")
  async listLines(@Req() req: Request) {
    try {
      const actor = await requireSession(req, this.auth);
      return await this.products.listLines(actor.companyId);
    } catch (error) {
      throwProductError(error);
    }
  }

  @Post(":id/variants")
  async createVariant(
    @Param("id") id: string,
    @Body() input: CreateProductVariantInput,
    @Req() req: Request,
  ) {
    try {
      const actor = await requireSession(req, this.auth);
      return await this.products.createVariant(id, input, actor.companyId);
    } catch (error) {
      throwProductError(error);
    }
  }

  @Patch(":id")
  async updateProduct(
    @Param("id") id: string,
    @Body() input: { name?: string; description?: string; active?: boolean },
    @Req() req: Request,
  ) {
    try {
      const actor = await requireSession(req, this.auth);
      return await this.products.updateProduct(id, input, actor.companyId);
    } catch (error) {
      throwProductError(error);
    }
  }

  @Patch("variants/:id")
  async updateVariant(
    @Param("id") id: string,
    @Body() input: { active: boolean },
    @Req() req: Request,
  ) {
    try {
      const actor = await requireSession(req, this.auth);
      return await this.products.updateVariant(id, input, actor.companyId);
    } catch (error) {
      throwProductError(error);
    }
  }

  @Get("presentation-rules")
  getRules() {
    return this.products.getPresentationRules();
  }

  @Get("presentation-rules/:line")
  getRulesForLine(@Param("line") line: string) {
    if (!isProductLine(line))
      throw new BadRequestException("Linha de produto inválida.");
    return this.products.getPresentationsForLine(line);
  }

  @Get(":id")
  async getProduct(@Param("id") id: string, @Req() req: Request) {
    try {
      const actor = await requireSession(req, this.auth);
      const product = await this.products.getProduct(id, actor.companyId);
      if (!product) throw new NotFoundException("Produto não encontrado.");
      return product;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throwProductError(error);
    }
  }

  @Post("validate-sku")
  validateSku(@Body() input: CreateProductSkuInput) {
    try {
      return this.products.validateSku(input);
    } catch (error) {
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }
}

function throwProductError(error: unknown): never {
  if (
    error instanceof Error &&
    (error.name === "PrismaClientInitializationError" ||
      error.message.includes("Can't reach database server"))
  ) {
    throw new ServiceUnavailableException(
      "Catálogo persistente indisponível. Verifique a conexão PostgreSQL.",
    );
  }
  if (error instanceof Error) throw new BadRequestException(error.message);
  throw error;
}
