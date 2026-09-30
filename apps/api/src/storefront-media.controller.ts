import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
  Body,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { prisma } from "@bbos/database";
import type { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { requireSession } from "./auth-context";
import { Public } from "./auth.guard";
import { StorefrontMediaService } from "./storefront-media.service";

type Upload = { originalname: string; mimetype: string; buffer: Buffer };

@Controller("admin/storefront-media")
export class AdminStorefrontMediaController {
  constructor(
    private readonly media: StorefrontMediaService,
    private readonly auth: AuthService,
  ) {}

  @Get()
  async list(@Req() request: Request) {
    const actor = await this.actor(request);
    return this.media.listAdmin(actor.companyId);
  }

  @Post()
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 10 * 1024 * 1024, files: 1 },
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
  async create(
    @UploadedFile() file: Upload | undefined,
    @Body() input: Record<string, string>,
    @Req() request: Request,
  ) {
    if (!file) throw new BadRequestException("Selecione uma imagem para enviar.");
    const actor = await this.actor(request);
    return this.media.create(actor.companyId, input, file);
  }

  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body() input: Record<string, string | boolean | number>,
    @Req() request: Request,
  ) {
    const actor = await this.actor(request);
    return this.media.update(actor.companyId, id, input);
  }

  private async actor(request: Request) {
    const actor = await requireSession(request, this.auth);
    if (!["ADMIN", "EXECUTIVE", "SALES"].includes(actor.role)) {
      throw new ForbiddenException("Seu perfil não pode administrar as imagens da loja.");
    }
    return actor;
  }
}

@Controller("storefront/media")
export class PublicStorefrontMediaController {
  private readonly database = prisma;

  constructor(private readonly media: StorefrontMediaService) {}

  private async companyId() {
    const configured = process.env.STOREFRONT_COMPANY_ID?.trim();
    if (configured) return configured;
    const companies = await this.database.company.findMany({ select: { id: true }, take: 2 });
    if (companies.length !== 1) {
      throw new BadRequestException("A empresa da loja não está configurada.");
    }
    return companies[0]!.id;
  }

  @Public()
  @Get()
  async list() {
    return this.media.listPublic(await this.companyId());
  }

  @Public()
  @Get(":id")
  async image(@Param("id") id: string, @Res() response: Response) {
    const image = await this.media.getImage(id, await this.companyId());
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
