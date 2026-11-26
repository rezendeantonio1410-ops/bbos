/** Commercial seller and agricultural source are distinct concepts. */
export type ProductiveOrigin = {
  originUnitId?: string | null;
  originRegion?: string | null;
  municipality?: string | null;
  state?: string | null;
  country?: string | null;
  farmName?: string | null;
};

export function purchaseOriginSnapshot(input: ProductiveOrigin) {
  // Never infer a farm, municipality or coffee region from the fiscal supplier.
  if (!input.originUnitId) {
    return {
      originRegion: "",
      municipality: undefined,
      state: undefined,
      country: "Brasil",
      farmName: undefined,
    };
  }
  return {
    originRegion: input.originRegion ?? "",
    municipality: input.municipality ?? undefined,
    state: input.state ?? undefined,
    country: input.country ?? "Brasil",
    farmName: input.farmName ?? undefined,
  };
}
