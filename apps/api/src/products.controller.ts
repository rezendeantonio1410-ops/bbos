import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  ServiceUnavailableException,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
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
import { BlingOutboxService } from "./integrations/bling/bling-outbox.service";

@Controller("products")
export class ProductsController {
  constructor(
    private readonly products: ProductsService,
    private readonly auth: AuthService,
    private readonly blingOutbox: BlingOutboxService,
  ) {}

  private async withBlingStatus(companyId: string, catalog: any[]) {
    const ids = catalog.flatMap((product) =>
      product.skus.map((sku: any) => sku.id),
    );
    const statuses = await this.blingOutbox.productSyncStatuses(companyId, ids);
    return catalog.map((product) => ({
      ...product,
      skus: product.skus.map((sku: any) => ({
        ...sku,
        blingSync:
          statuses[sku.id] ??
          (sku.fiscalValidated
            ? { state: "NOT_QUEUED", label: "Ainda não enviado" }
            : {
                state: "PENDING_VALIDATION",
                label: "Aguardando validação fiscal",
              }),
      })),
    }));
  }

  @Get()
  async listCatalog(@Req() req: Request) {
    try {
      const actor = await requireSession(req, this.auth);
      const catalog = await this.products.listCatalog(actor.companyId);
      return await this.withBlingStatus(actor.companyId, catalog);
    } catch (error) {
      throwProductError(error);
    }
  }

  @Post()
  async createProduct(
    @Body() input: CreateCatalogProductInput,
    @Req() req: Request,
  ) {
    try {
      const actor = await requireSession(req, this.auth);
      const created = await this.products.createProduct(input, actor.companyId);
      const variant = created.skus.find(
        (item: { sku: string }) =>
          item.sku === input.sku.trim().toLocaleUpperCase("pt-BR"),
      );
      if (variant) {
        try {
          variant.blingSync = await this.blingOutbox.enqueueProductVariant(
            actor.companyId,
            variant.id,
          );
        } catch (error) {
          variant.blingSync = {
            state: "NOT_QUEUED",
            label: "Produto salvo; envio ao Bling pendente",
            lastError: error instanceof Error ? error.message : String(error),
          };
        }
      }
      return created;
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

  @Get("ncm-suggestion")
  async ncmSuggestion(@Query("kind") kind: string, @Req() req: Request) {
    const actor = await requireSession(req, this.auth);
    if (kind !== "ROASTED" && kind !== "GREEN")
      throw new BadRequestException("Tipo de café inválido.");
    return this.products.suggestNcm(actor.companyId, kind);
  }

  @Post(":id/variants")
  async createVariant(
    @Param("id") id: string,
    @Body() input: CreateProductVariantInput,
    @Req() req: Request,
  ) {
    try {
      const actor = await requireSession(req, this.auth);
      const product = await this.products.createVariant(
        id,
        input,
        actor.companyId,
      );
      const variant = product.skus.find(
        (item: { sku: string }) =>
          item.sku === input.sku.trim().toLocaleUpperCase("pt-BR"),
      );
      if (variant) {
        try {
          variant.blingSync = await this.blingOutbox.enqueueProductVariant(
            actor.companyId,
            variant.id,
          );
        } catch (error) {
          variant.blingSync = {
            state: "NOT_QUEUED",
            label: "Apresentação salva; envio ao Bling pendente",
            lastError: error instanceof Error ? error.message : String(error),
          };
        }
      }
      return product;
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

  @Post("variants/:id/bling/retry")
  async retryBling(@Param("id") id: string, @Req() req: Request) {
    try {
      const actor = await requireSession(req, this.auth);
      return await this.blingOutbox.retryProductVariant(actor.companyId, id);
    } catch (error) {
      throwProductError(error);
    }
  }

  @Post(":id/storefront-images")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 5 * 1024 * 1024, files: 1 },
      fileFilter: (_request, file, callback) => {
        const allowed = ["image/jpeg", "image/png", "image/webp"];
        callback(
          allowed.includes(file.mimetype)
            ? null
            : new BadRequestException("Envie uma imagem JPG, PNG ou WebP."),
          allowed.includes(file.mimetype),
        );
      },
    }),
  )
  async uploadStorefrontImage(
    @Param("id") id: string,
    @UploadedFile()
    file:
      { originalname: string; mimetype: string; buffer: Buffer } | undefined,
    @Req() req: Request,
  ) {
    try {
      if (!file)
        throw new BadRequestException("Selecione uma imagem para enviar.");
      const actor = await requireSession(req, this.auth);
      return await this.products.addStorefrontImage(id, actor.companyId, file);
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throwProductError(error);
    }
  }

  @Patch(":id/storefront-images/:imageId")
  async updateStorefrontImage(
    @Param("id") id: string,
    @Param("imageId") imageId: string,
    @Body()
    input: { isPrimary?: boolean; useInHero?: boolean; sortOrder?: number },
    @Req() req: Request,
  ) {
    try {
      const actor = await requireSession(req, this.auth);
      return await this.products.updateStorefrontImage(
        id,
        imageId,
        actor.companyId,
        input,
      );
    } catch (error) {
      throwProductError(error);
    }
  }

  @Delete(":id/storefront-images/:imageId")
  async deleteStorefrontImage(
    @Param("id") id: string,
    @Param("imageId") imageId: string,
    @Req() req: Request,
  ) {
    try {
      const actor = await requireSession(req, this.auth);
      return await this.products.deleteStorefrontImage(
        id,
        imageId,
        actor.companyId,
      );
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
      return (await this.withBlingStatus(actor.companyId, [product]))[0];
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
