/**
 * Origin of a green coffee purchase. A producer is bought through one of its
 * farms or units; a trading company or exporter (e.g. Bela Época) has no farm
 * of its own, so the origin is typed on the purchase: state, municipality and
 * optional coffee region.
 */
type Unit = { id: string; name: string; state: string; country?: string | null; municipality?: string | null; coffeeRegionId?: string | null; coffeeRegion?: { name: string } | null };
type Supplier = { city?: string | null; country?: string | null; originUnits?: Unit[] };
type Region = { id: string; name: string };

export function supplierWithoutUnits(supplier: Supplier | undefined) {
  return Boolean(supplier) && !(supplier!.originUnits ?? []).length;
}

export function purchaseOrigin(input: { supplier: Supplier; unit?: Unit; state: string; municipality?: string; region?: Region }) {
  const { supplier, unit } = input;
  if (unit) {
    return {
      originUnitId: unit.id,
      farmName: unit.name,
      state: unit.state,
      municipality: unit.municipality ?? supplier.city ?? undefined,
      originRegion: unit.coffeeRegion?.name ?? "",
      coffeeRegionId: unit.coffeeRegionId ?? undefined,
      country: unit.country ?? supplier.country ?? "Brasil",
    };
  }
  return {
    originUnitId: undefined,
    farmName: undefined,
    state: input.state,
    municipality: input.municipality?.trim() || supplier.city || undefined,
    originRegion: input.region?.name ?? "",
    coffeeRegionId: input.region?.id,
    country: supplier.country ?? "Brasil",
  };
}
