import { Injectable } from "@nestjs/common";
import {
  getAllowedPresentations,
  PRODUCT_LINE_LABELS,
  PRODUCT_LINES,
  validateCreateProductSku,
  type CreateProductSkuInput,
  type CreateCatalogProductInput,
  type CreateProductVariantInput,
  type ProductLine,
  // @ts-expect-error Nest uses legacy Node resolution; runtime resolves the package export.
} from "@bbos/shared/product-presentation";
import { ProductsRepository } from "./products.repository";

@Injectable()
export class ProductsService {
  constructor(private readonly repository: ProductsRepository) {}

  listCatalog(companyId: string) {
    return this.repository.listCatalog(companyId);
  }

  listLines(companyId: string) {
    return this.repository.listLines(companyId);
  }

  getProduct(id: string, companyId: string) {
    return this.repository.findProduct(id, companyId);
  }

  createProduct(input: CreateCatalogProductInput, companyId: string) {
    validateCreateProductSku(input);
    return this.repository.createProduct(input, companyId);
  }

  createVariant(productId: string, input: CreateProductVariantInput, companyId: string) {
    return this.repository.createVariant(productId, input, companyId);
  }

  updateProduct(
    id: string,
    input: { name?: string; description?: string; active?: boolean },
    companyId: string,
  ) {
    return this.repository.updateProduct(id, input, companyId);
  }

  updateVariant(id: string, input: { active: boolean }, companyId: string) {
    return this.repository.updateVariant(id, input, companyId);
  }

  getPresentationRules() {
    return PRODUCT_LINES.map((line: ProductLine) => ({
      line,
      label: PRODUCT_LINE_LABELS[line],
      presentations: getAllowedPresentations(line),
    }));
  }

  getPresentationsForLine(line: ProductLine) {
    return {
      line,
      label: PRODUCT_LINE_LABELS[line],
      presentations: getAllowedPresentations(line),
    };
  }

  validateSku(input: CreateProductSkuInput) {
    return { valid: true, sku: validateCreateProductSku(input) };
  }
}
