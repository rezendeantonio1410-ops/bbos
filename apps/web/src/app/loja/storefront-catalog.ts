import {
  formatStorefrontPrice,
  STOREFRONT_PRODUCT_CATALOG,
  type StorefrontProductId,
} from "@bbos/shared";

export function storefrontCommerce(id: StorefrontProductId, showCents = false) {
  const product = STOREFRONT_PRODUCT_CATALOG[id];
  return {
    id: product.id,
    price: formatStorefrontPrice(product.unitPriceCents, showCents),
    priceCents: product.unitPriceCents,
    weight: `${product.weightGrams} g`,
    weightGrams: product.weightGrams,
  };
}
