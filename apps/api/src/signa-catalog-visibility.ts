/**
 * A private Signa catalog is an explicit allowlist, never an opt-in overlay
 * on top of generic distributor prices. Missing/disabled catalog rows must
 * produce an empty catalog rather than exposing products through fallback.
 *
 * Other distributors retain the legacy fallback until their own explicit
 * catalog is configured.
 */
export function selectDistributorCatalogVisibility(
  explicitVariantIds: readonly string[],
  requireExplicitCatalog: boolean,
): { variantIds: Set<string>; needsLegacyFallback: boolean } {
  const variantIds = new Set(explicitVariantIds.filter((id) => id.length > 0));
  return {
    variantIds,
    needsLegacyFallback: !requireExplicitCatalog && variantIds.size === 0,
  };
}
