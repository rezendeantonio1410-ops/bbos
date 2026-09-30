import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaClient } from "@bbos/database";

export const STOREFRONT_MEDIA_CATEGORIES = [
  "FOUNDERS",
  "PRODUCT_PROOF",
  "ORIGIN",
  "PRODUCERS",
  "HERO",
  "EDITORIAL",
] as const;

type MediaCategory = (typeof STOREFRONT_MEDIA_CATEGORIES)[number];

type CreateMediaInput = {
  category?: string;
  entityKey?: string;
  placement?: string;
  productId?: string;
  title?: string;
  altText?: string;
  caption?: string;
  credit?: string;
  isPrimary?: string | boolean;
};

type UpdateMediaInput = CreateMediaInput & {
  active?: string | boolean;
  sortOrder?: string | number;
};

type Upload = { originalname: string; mimetype: string; buffer: Buffer };

@Injectable()
export class StorefrontMediaService {
  private readonly database = new PrismaClient();

  async listAdmin(companyId: string) {
    const assets = await this.database.storefrontMediaAsset.findMany({
      where: { companyId },
      include: { product: { select: { id: true, name: true, slug: true } } },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
    });
    return assets.map(stripData);
  }

  async listPublic(companyId: string) {
    return this.database.storefrontMediaAsset.findMany({
      where: { companyId, active: true },
      select: {
        id: true,
        productId: true,
        category: true,
        entityKey: true,
        placement: true,
        title: true,
        altText: true,
        caption: true,
        credit: true,
        sortOrder: true,
        isPrimary: true,
        updatedAt: true,
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });
  }

  async getImage(id: string, companyId: string) {
    return this.database.storefrontMediaAsset.findFirst({
      where: { id, companyId },
      select: { fileName: true, mimeType: true, data: true, updatedAt: true },
    });
  }

  async create(companyId: string, input: CreateMediaInput, file: Upload) {
    const category = mediaCategory(input.category);
    const productId = clean(input.productId);
    await this.assertProduct(companyId, productId);
    const title = requiredText(input.title, "Informe um título para a foto.");
    const altText = requiredText(
      input.altText || input.title,
      "Informe o texto alternativo da foto.",
    );
    const entityKey = clean(input.entityKey);
    const placement = clean(input.placement);
    const isPrimary = booleanValue(input.isPrimary);
    const aggregate = await this.database.storefrontMediaAsset.aggregate({
      where: { companyId, category, entityKey, placement },
      _max: { sortOrder: true },
    });
    const data = {
      companyId,
      productId,
      category,
      entityKey,
      placement,
      title,
      altText,
      caption: clean(input.caption),
      credit: clean(input.credit),
      fileName: file.originalname.slice(0, 240),
      mimeType: file.mimetype,
      data: Uint8Array.from(file.buffer),
      sortOrder: (aggregate._max.sortOrder ?? -1) + 1,
      isPrimary,
    };
    const created = await this.database.$transaction(async (tx) => {
      if (isPrimary) {
        await tx.storefrontMediaAsset.updateMany({
          where: primaryScope(companyId, category, entityKey, placement, productId),
          data: { isPrimary: false },
        });
      }
      return tx.storefrontMediaAsset.create({
        data,
        include: { product: { select: { id: true, name: true, slug: true } } },
      });
    });
    return stripData(created);
  }

  async update(companyId: string, id: string, input: UpdateMediaInput) {
    const current = await this.database.storefrontMediaAsset.findFirst({
      where: { id, companyId },
    });
    if (!current) throw new NotFoundException("Foto não encontrada.");

    const category = input.category ? mediaCategory(input.category) : current.category;
    const productId = input.productId === undefined ? current.productId : clean(input.productId);
    await this.assertProduct(companyId, productId);
    const entityKey = input.entityKey === undefined ? current.entityKey : clean(input.entityKey);
    const placement = input.placement === undefined ? current.placement : clean(input.placement);
    const isPrimary = input.isPrimary === undefined
      ? current.isPrimary
      : booleanValue(input.isPrimary);
    const sortOrder = input.sortOrder === undefined
      ? current.sortOrder
      : integerValue(input.sortOrder);
    const data = {
      category,
      productId,
      entityKey,
      placement,
      title: input.title === undefined ? current.title : requiredText(input.title, "Informe o título."),
      altText: input.altText === undefined ? current.altText : requiredText(input.altText, "Informe o texto alternativo."),
      caption: input.caption === undefined ? current.caption : clean(input.caption),
      credit: input.credit === undefined ? current.credit : clean(input.credit),
      active: input.active === undefined ? current.active : booleanValue(input.active),
      sortOrder,
      isPrimary,
    };

    const updated = await this.database.$transaction(async (tx) => {
      if (isPrimary) {
        await tx.storefrontMediaAsset.updateMany({
          where: {
            ...primaryScope(companyId, category, entityKey, placement, productId),
            id: { not: id },
          },
          data: { isPrimary: false },
        });
      }
      return tx.storefrontMediaAsset.update({
        where: { id },
        data,
        include: { product: { select: { id: true, name: true, slug: true } } },
      });
    });
    return stripData(updated);
  }

  private async assertProduct(companyId: string, productId: string | null) {
    if (!productId) return;
    const product = await this.database.product.findFirst({
      where: { id: productId, productLine: { companyId } },
      select: { id: true },
    });
    if (!product) throw new BadRequestException("O produto selecionado não pertence a esta empresa.");
  }
}

function stripData<T extends { data: Uint8Array }>(asset: T) {
  const { data: _data, ...metadata } = asset;
  return metadata;
}

function mediaCategory(value?: string): MediaCategory {
  const normalized = value?.trim().toUpperCase();
  if (!STOREFRONT_MEDIA_CATEGORIES.includes(normalized as MediaCategory)) {
    throw new BadRequestException("Escolha uma categoria válida para a foto.");
  }
  return normalized as MediaCategory;
}

function clean(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, 500) : null;
}

function requiredText(value: string | undefined, message: string) {
  const normalized = clean(value);
  if (!normalized) throw new BadRequestException(message);
  return normalized;
}

function booleanValue(value: string | boolean | undefined) {
  return value === true || value === "true" || value === "1" || value === "on";
}

function integerValue(value: string | number) {
  const parsed = typeof value === "number" ? value : Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new BadRequestException("A ordem deve ser um número inteiro positivo.");
  }
  return parsed;
}

function primaryScope(
  companyId: string,
  category: string,
  entityKey: string | null,
  placement: string | null,
  productId: string | null,
) {
  return { companyId, category, entityKey, placement, productId };
}
