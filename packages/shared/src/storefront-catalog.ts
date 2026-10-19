export const STOREFRONT_PRODUCT_CATALOG = {
  essencial: {
    id: "essencial",
    name: "Essencial",
    unitPriceCents: 5500,
    weightGrams: 500,
  },
  intenso: {
    id: "intenso",
    name: "Intenso",
    unitPriceCents: 5500,
    weightGrams: 500,
  },
  caramelo: {
    id: "caramelo",
    name: "Caramelo",
    unitPriceCents: 6800,
    weightGrams: 500,
  },
  "doce-de-leite": {
    id: "doce-de-leite",
    name: "Doce de Leite",
    unitPriceCents: 6800,
    weightGrams: 500,
  },
  tangerina: {
    id: "tangerina",
    name: "Tangerina",
    unitPriceCents: 6800,
    weightGrams: 500,
  },
  singular: {
    id: "singular",
    name: "Singular",
    unitPriceCents: 8400,
    weightGrams: 500,
  },
  sublime: {
    id: "sublime",
    name: "Sublime",
    unitPriceCents: 8400,
    weightGrams: 500,
  },
  raros: {
    id: "raros",
    name: "Raro",
    unitPriceCents: 5400,
    weightGrams: 250,
  },
} as const;

export type StorefrontProductId = keyof typeof STOREFRONT_PRODUCT_CATALOG;
export type StorefrontCatalogProduct =
  (typeof STOREFRONT_PRODUCT_CATALOG)[StorefrontProductId];

const STOREFRONT_PRODUCT_ALIASES: Readonly<
  Record<string, StorefrontProductId>
> = {
  raro: "raros",
};

export function normalizeStorefrontProductId(
  value: unknown,
): StorefrontProductId | null {
  if (typeof value !== "string") return null;
  const candidate = value.trim().toLowerCase();
  const normalized = STOREFRONT_PRODUCT_ALIASES[candidate] ?? candidate;
  return Object.prototype.hasOwnProperty.call(
    STOREFRONT_PRODUCT_CATALOG,
    normalized,
  )
    ? (normalized as StorefrontProductId)
    : null;
}

export function resolveStorefrontProduct(
  value: unknown,
): StorefrontCatalogProduct | null {
  const id = normalizeStorefrontProductId(value);
  return id ? STOREFRONT_PRODUCT_CATALOG[id] : null;
}

export function formatStorefrontPrice(
  unitPriceCents: number,
  showCents = false,
) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  }).format(unitPriceCents / 100);
}
