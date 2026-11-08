import assert from "node:assert/strict";
import test from "node:test";
import {
  groupRoastedStockByLine,
  type RoastedStockRow,
} from "./roasted-stock-by-line";

test("agrupa café torrado por linha e perfil sem convertê-lo em embalagens", () => {
  const rows: RoastedStockRow[] = [
    {
      lineCode: "CLASSICOS",
      lineName: "Clássicos",
      lineSortOrder: 2,
      productId: "tangerina",
      profileName: "Tangerina",
      physicalKg: 30,
      reservedKg: 7.5,
      availableKg: 22.5,
      lotCount: 2,
      lastRoastedAt: "2026-11-08T12:00:00.000Z",
    },
    {
      lineCode: "GOURMET",
      lineName: "Gourmet",
      lineSortOrder: 1,
      productId: "essencial",
      profileName: "Essencial",
      physicalKg: 70,
      reservedKg: 5,
      availableKg: 65,
      lotCount: 1,
      lastRoastedAt: "2026-11-08T10:00:00.000Z",
    },
    {
      lineCode: "GOURMET",
      lineName: "Gourmet",
      lineSortOrder: 1,
      productId: "intenso",
      profileName: "Intenso",
      physicalKg: 20,
      reservedKg: 0,
      availableKg: 20,
      lotCount: 1,
      lastRoastedAt: null,
    },
  ];

  const result = groupRoastedStockByLine(rows);

  assert.deepEqual(
    result.map((line) => line.lineCode),
    ["GOURMET", "CLASSICOS"],
  );
  assert.equal(result[0]?.physicalKg, 90);
  assert.equal(result[0]?.reservedKg, 5);
  assert.equal(result[0]?.availableKg, 85);
  assert.equal(result[0]?.lotCount, 2);
  assert.deepEqual(
    result[0]?.profiles.map((profile) => profile.profileName),
    ["Essencial", "Intenso"],
  );
});
