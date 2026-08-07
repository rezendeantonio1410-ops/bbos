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

  listCatalog() {
    return this.repository.listCatalog();
  }

  listLines() {
    return this.repository.listLines();
  }

  getProduct(id: string) {
    return this.repository.findProduct(id);
  }

  createProduct(input: CreateCatalogProductInput) {
    validateCreateProductSku(input);
    return this.repository.createProduct(input);
  }

  createVariant(productId: string, input: CreateProductVariantInput) {
    return this.repository.createVariant(productId, input);
  }

  updateProduct(
    id: string,
    input: { name?: string; description?: string; active?: boolean },
  ) {
    return this.repository.updateProduct(id, input);
  }

  updateVariant(id: string, input: { active: boolean }) {
    return this.repository.updateVariant(id, input);
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
