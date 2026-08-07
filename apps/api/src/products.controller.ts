import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  isProductLine,
  type CreateProductSkuInput,
  type CreateCatalogProductInput,
  type CreateProductVariantInput,
  // @ts-expect-error Nest uses legacy Node resolution; runtime resolves the package export.
} from "@bbos/shared/product-presentation";
import { ProductsService } from "./products.service";

@Controller("products")
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  async listCatalog() {
    try {
      return await this.products.listCatalog();
    } catch (error) {
      throwProductError(error);
    }
  }

  @Post()
  async createProduct(@Body() input: CreateCatalogProductInput) {
    try {
      return await this.products.createProduct(input);
    } catch (error) {
      throwProductError(error);
    }
  }

  @Get("lines")
  async listLines() {
    try {
      return await this.products.listLines();
    } catch (error) {
      throwProductError(error);
    }
  }

  @Post(":id/variants")
  async createVariant(
    @Param("id") id: string,
    @Body() input: CreateProductVariantInput,
  ) {
    try {
      return await this.products.createVariant(id, input);
    } catch (error) {
      throwProductError(error);
    }
  }

  @Patch(":id")
  async updateProduct(
    @Param("id") id: string,
    @Body() input: { name?: string; description?: string; active?: boolean },
  ) {
    try {
      return await this.products.updateProduct(id, input);
    } catch (error) {
      throwProductError(error);
    }
  }

  @Patch("variants/:id")
  async updateVariant(
    @Param("id") id: string,
    @Body() input: { active: boolean },
  ) {
    try {
      return await this.products.updateVariant(id, input);
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
  async getProduct(@Param("id") id: string) {
    try {
      const product = await this.products.getProduct(id);
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
