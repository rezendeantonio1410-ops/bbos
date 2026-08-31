#!/usr/bin/env node
/* Staging-only migration recovery. Audits first; mutates migration history only when the failed migration is fully materialized. */
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

const target = "20260814120000_green_coffee_purchase_v2";
const migrationRoot = join(process.cwd(), "packages/database/prisma/migrations");
const databasePackageJson = join(process.cwd(), "packages/database/package.json");
const requireFromDatabase = createRequire(databasePackageJson);
const { PrismaClient } = requireFromDatabase("@prisma/client");
const prisma = new PrismaClient();

function run(command, args) {
  console.log(`\n$ ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, { stdio: "inherit", env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited with status ${result.status}`);
}

async function scalar(sql, ...values) {
  const rows = await prisma.$queryRawUnsafe(sql, ...values);
  return rows[0]?.value ?? null;
}

async function exists(sql, ...values) {
  return Boolean(await scalar(sql, ...values));
}

async function tableExists(name) {
  return exists(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema='public' AND table_name=$1
     ) AS value`,
    name,
  );
}

async function columnExists(table, column) {
  return exists(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema='public' AND table_name=$1 AND column_name=$2
     ) AS value`,
    table,
    column,
  );
}

try {
  const serviceName = process.env.RENDER_SERVICE_NAME ?? "";
  if (serviceName && serviceName !== "bbos-api-staging") {
    throw new Error(`Refusing staging recovery on Render service: ${serviceName}`);
  }

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

  const enumNames = [
    "PurchaseApprovalStatus",
    "PurchaseOperationalStatus",
    "PurchasePaymentTermType",
    "PurchaseInstallmentStatus",
  ];
  const tableNames = [
    "GreenCoffeePurchaseInstallment",
    "SupplierBankAccount",
    "CoffeeSpecies",
    "CoffeeVariety",
  ];
  const purchaseColumns = [
    "approvalStatus", "operationalStatus", "createdByUserId", "createdByName",
    "approvedByUserId", "approvedByName", "approvedAt", "rejectedByUserId",
    "rejectedAt", "rejectionReason", "department", "approverName",
    "supplierSnapshot", "qualityCategory", "additionalSpecification",
    "contractReference", "paymentTermType", "paymentTermData",
  ];
  const indexes = [
    "GreenCoffeePurchaseInstallment_purchaseId_installmentNumber_key",
    "GreenCoffeePurchaseInstallment_accountsPayableId_key",
    "GreenCoffeePurchaseInstallment_status_dueDate_idx",
    "SupplierBankAccount_supplierId_active_idx",
    "CoffeeSpecies_companyId_code_key",
    "CoffeeVariety_speciesId_code_key",
    "CoffeeVariety_speciesId_active_idx",
  ];
  const constraints = [
    "GreenCoffeePurchaseInstallment_purchaseId_fkey",
    "GreenCoffeePurchaseInstallment_accountsPayableId_fkey",
    "SupplierBankAccount_companyId_fkey",
    "SupplierBankAccount_supplierId_fkey",
    "CoffeeSpecies_companyId_fkey",
    "CoffeeVariety_speciesId_fkey",
  ];

  let safe = true;
  console.log(`\nMIGRATION AUDIT: ${target}`);

  for (const enumName of enumNames) {
    const ok = await exists(`SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname=$1) AS value`, enumName);
    console.log(`ENUM ${enumName}: ${ok ? "PASS" : "FAIL"}`);
    safe &&= ok;
  }
  for (const table of tableNames) {
    const ok = await tableExists(table);
    console.log(`TABLE ${table}: ${ok ? "PASS" : "FAIL"}`);
    safe &&= ok;
  }
  for (const column of purchaseColumns) {
    const ok = await columnExists("GreenCoffeePurchase", column);
    console.log(`COLUMN GreenCoffeePurchase.${column}: ${ok ? "PASS" : "FAIL"}`);
    safe &&= ok;
  }
  for (const index of indexes) {
    const ok = await exists(`SELECT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname=$1) AS value`, index);
    console.log(`INDEX ${index}: ${ok ? "PASS" : "FAIL"}`);
    safe &&= ok;
  }
  for (const constraint of constraints) {
    const ok = await exists(`SELECT EXISTS (SELECT 1 FROM pg_constraint WHERE conname=$1) AS value`, constraint);
    console.log(`FK ${constraint}: ${ok ? "PASS" : "FAIL"}`);
    safe &&= ok;
  }

  const requiredNotNull = ["approvalStatus", "operationalStatus", "createdByUserId", "createdByName", "supplierSnapshot", "qualityCategory", "paymentTermType", "paymentTermData"];
  const nullableRequired = await prisma.$queryRawUnsafe(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name='GreenCoffeePurchase'
       AND column_name = ANY($1::text[]) AND is_nullable='YES'`,
    requiredNotNull,
  );
  const nullabilityOk = nullableRequired.length === 0;
  console.log(`NULLABILITY: ${nullabilityOk ? "PASS" : `FAIL (${nullableRequired.map((r) => r.column_name).join(",")})`}`);
  safe &&= nullabilityOk;

  const speciesCount = await scalar(`SELECT COUNT(*)::int AS value FROM "CoffeeSpecies"`);
  const varietyCount = await scalar(`SELECT COUNT(*)::int AS value FROM "CoffeeVariety"`);
  const seedOk = Number(speciesCount) >= 1 && Number(varietyCount) >= 1;
  console.log(`REFERENCE DATA: CoffeeSpecies=${speciesCount}, CoffeeVariety=${varietyCount} => ${seedOk ? "PASS" : "FAIL"}`);
  safe &&= seedOk;

  const targetStatus = status(target);
  console.log(`TARGET STATUS: ${targetStatus}`);
  console.log(`SAFE TO RESOLVE AS APPLIED: ${safe ? "YES" : "NO"}`);

  if (!safe) throw new Error("Migration audit failed; database history was not changed.");

  await prisma.$disconnect();

  if (targetStatus === "FAILED") {
    run("pnpm", ["--filter", "@bbos/database", "exec", "prisma", "migrate", "resolve", "--applied", target, "--schema=prisma/schema.prisma"]);
  } else if (targetStatus !== "APPLIED") {
    throw new Error(`Unexpected target migration status: ${targetStatus}`);
  }

  run("pnpm", ["db:generate"]);
  run("pnpm", ["db:migrate:deploy"]);
  run("pnpm", ["db:seed:coffee-references"]);
  run("pnpm", ["--filter", "@bbos/api", "build"]);
  console.log("\nSTAGING DATABASE RECOVERY: COMPLETE");
} finally {
  await prisma.$disconnect().catch(() => {});
}
