export type RoastedStockRow = {
  lineCode: string;
  lineName: string;
  lineSortOrder: number;
  productId: string;
  profileName: string;
  physicalKg: number;
  reservedKg: number;
  availableKg: number;
  lotCount: number;
  lastRoastedAt: Date | string | null;
};

export type RoastedStockProfile = Omit<
  RoastedStockRow,
  "lineCode" | "lineName" | "lineSortOrder"
>;

export type RoastedStockLine = {
  lineCode: string;
  lineName: string;
  physicalKg: number;
  reservedKg: number;
  availableKg: number;
  lotCount: number;
  profiles: RoastedStockProfile[];
};

export function groupRoastedStockByLine(
  rows: RoastedStockRow[],
): RoastedStockLine[] {
  const lines = new Map<string, RoastedStockLine & { lineSortOrder: number }>();

  for (const row of rows) {
    const line = lines.get(row.lineCode) ?? {
      lineCode: row.lineCode,
      lineName: row.lineName,
      lineSortOrder: row.lineSortOrder,
      physicalKg: 0,
      reservedKg: 0,
      availableKg: 0,
      lotCount: 0,
      profiles: [],
    };

    line.physicalKg += Number(row.physicalKg);
    line.reservedKg += Number(row.reservedKg);
    line.availableKg += Number(row.availableKg);
    line.lotCount += Number(row.lotCount);
    line.profiles.push({
      productId: row.productId,
      profileName: row.profileName,
      physicalKg: Number(row.physicalKg),
      reservedKg: Number(row.reservedKg),
      availableKg: Number(row.availableKg),
      lotCount: Number(row.lotCount),
      lastRoastedAt: row.lastRoastedAt,
    });
    lines.set(row.lineCode, line);
  }

  return [...lines.values()]
    .sort((left, right) => left.lineSortOrder - right.lineSortOrder)
    .map((line) => ({
      lineCode: line.lineCode,
      lineName: line.lineName,
      physicalKg: line.physicalKg,
      reservedKg: line.reservedKg,
      availableKg: line.availableKg,
      lotCount: line.lotCount,
      profiles: line.profiles,
    }));
}
