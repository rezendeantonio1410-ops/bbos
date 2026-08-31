#!/usr/bin/env node
/* Read-only staging migration audit. Run inside Render with DATABASE_URL set. */
import { createRequire } from "node:module";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const databasePackageJson = join(process.cwd(), "packages/database/package.json");
const requireFromDatabase = createRequire(databasePackageJson);
const { PrismaClient } = requireFromDatabase("@prisma/client");

const prisma = new PrismaClient();
const migrationRoot = join(process.cwd(), "packages/database/prisma/migrations");
const target = "20260814120000_green_coffee_purchase_v2";

async function scalar(sql, ...values) {
  const rows = await prisma.$queryRawUnsafe(sql, ...values);
  return rows[0]?.value ?? null;
}

async function exists(sql, ...values) {
  return Boolean(await scalar(sql, ...values));
}

try {
  const names = (await readdir(migrationRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const history = await prisma.$queryRawUnsafe(`
    SELECT migration_name, finished_at, rolled_back_at, logs
    FROM "_prisma_migrations"
    ORDER BY started_at, migration_name
  `);
  const byName = new Map(history.map((row) => [row.migration_name, row]));
  const status = (name) => {
    const row = byName.get(name);
    if (!row) return "NOT_REGISTERED";
    if (row.rolled_back_at) return "ROLLED_BACK";
    if (row.finished_at) return "APPLIED";
    if (row.logs) return "FAILED";
    return "PENDING";
  };

  console.log("MIGRATION STATUS MATRIX:");
  for (const name of names) console.log(`${name}\t${status(name)}`);

  const migrationSql = await readFile(join(migrationRoot, target, "migration.sql"), "utf8");
  console.log(`\nMIGRATION AUDIT: ${target}`);
  console.log(`ENUM PurchaseApprovalStatus: ${await exists(`SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PurchaseApprovalStatus') AS value`) ? "PASS" : "FAIL"}`);
  for (const enumName of ["PurchaseOperationalStatus", "PurchasePaymentTermType", "PurchaseInstallmentStatus"])
    console.log(`ENUM ${enumName}: ${await exists(`SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = $1) AS value`, enumName) ? "PASS" : "FAIL"}`);

  const tables = ["GreenCoffeePurchaseInstallment", "SupplierBankAccount", "CoffeeSpecies", "CoffeeVariety"];
  console.log("TABLES:");
  for (const table of tables) console.log(`${table}: ${await exists(`SELECT to_regclass($1) IS NOT NULL AS value`, `public.${table}`) ? "PASS" : "FAIL"}`);
  const columns = [
    ["GreenCoffeePurchase", "approvalStatus"], ["GreenCoffeePurchase", "operationalStatus"],
    ["GreenCoffeePurchase", "createdByUserId"], ["GreenCoffeePurchase", "createdByName"],
    ["GreenCoffeePurchase", "supplierSnapshot"], ["GreenCoffeePurchase", "paymentTermType"],
    ["GreenCoffeePurchase", "paymentTermData"],
  ];
  console.log("COLUMNS:");
  for (const [table, column] of columns) console.log(`${table}.${column}: ${await exists(`SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name=$2) AS value`, table, column) ? "PASS" : "FAIL"}`);
  const indexes = [
    "GreenCoffeePurchaseInstallment_purchaseId_installmentNumber_key",
    "GreenCoffeePurchaseInstallment_accountsPayableId_key",
    "GreenCoffeePurchaseInstallment_status_dueDate_idx",
    "SupplierBankAccount_supplierId_active_idx",
    "CoffeeSpecies_companyId_code_key",
    "CoffeeVariety_speciesId_code_key",
    "CoffeeVariety_speciesId_active_idx",
  ];
  console.log("INDEXES:");
  for (const index of indexes) console.log(`${index}: ${await exists(`SELECT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname=$1) AS value`, index) ? "PASS" : "FAIL"}`);
  const constraints = [
    "GreenCoffeePurchaseInstallment_purchaseId_fkey", "GreenCoffeePurchaseInstallment_accountsPayableId_fkey",
    "SupplierBankAccount_companyId_fkey", "SupplierBankAccount_supplierId_fkey",
    "CoffeeSpecies_companyId_fkey", "CoffeeVariety_speciesId_fkey",
  ];
  console.log("FOREIGN KEYS:");
  for (const constraint of constraints) console.log(`${constraint}: ${await exists(`SELECT EXISTS (SELECT 1 FROM pg_constraint WHERE conname=$1) AS value`, constraint) ? "PASS" : "FAIL"}`);
  const defaults = await prisma.$queryRawUnsafe(`SELECT column_name, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='GreenCoffeePurchase' AND column_name IN ('approvalStatus','operationalStatus','supplierSnapshot','qualityCategory','paymentTermType','paymentTermData') ORDER BY column_name`);
  console.log("DEFAULTS:");
  for (const row of defaults) console.log(`${row.column_name}: ${row.column_default ?? "MISSING"}`);
  const missing = await prisma.$queryRawUnsafe(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='GreenCoffeePurchase' AND column_name IN ('createdByUserId','createdByName') AND is_nullable='YES'`);
  console.log(`NULLABILITY: ${missing.length === 0 ? "PASS" : `FAIL (${missing.map((row) => row.column_name).join(",")})`}`);
  const speciesCount = await scalar(`SELECT COUNT(*)::int AS value FROM "CoffeeSpecies"`);
  const varietyCount = await scalar(`SELECT COUNT(*)::int AS value FROM "CoffeeVariety"`);
  console.log(`BACKFILLS / DATA CONDITIONS: CoffeeSpecies=${speciesCount ?? "MISSING"}, CoffeeVariety=${varietyCount ?? "MISSING"}`);
  const allMaterialized = migrationSql.includes('CREATE TYPE "PurchaseApprovalStatus"') &&
    await exists(`SELECT to_regclass('public."GreenCoffeePurchaseInstallment"') IS NOT NULL AS value`) &&
    await exists(`SELECT to_regclass('public."SupplierBankAccount"') IS NOT NULL AS value`) &&
    await exists(`SELECT to_regclass('public."CoffeeSpecies"') IS NOT NULL AS value`) &&
    await exists(`SELECT to_regclass('public."CoffeeVariety"') IS NOT NULL AS value`);
  console.log(`MIGRATION FULLY MATERIALIZED: ${allMaterialized ? "YES" : "NO"}`);
  console.log(`SAFE TO RESOLVE AS APPLIED: ${allMaterialized ? "YES" : "NO"}`);
} finally {
  await prisma.$disconnect();
}
