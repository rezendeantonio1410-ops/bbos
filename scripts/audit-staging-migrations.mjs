#!/usr/bin/env node
/* Staging-only migration recovery. Every resolve is preceded by read-only structural checks. */
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

const DB_PACKAGE = join(process.cwd(), "packages/database/package.json");
const requireFromDatabase = createRequire(DB_PACKAGE);
const { PrismaClient } = requireFromDatabase("@prisma/client");
const prisma = new PrismaClient();

const V2 = "20260814120000_green_coffee_purchase_v2";
const FIN_LINK = "20260814130000_purchase_financial_purchase_link";
const EXTERNAL_ACCEPTANCE = "20260814150000_purchase_external_acceptance";

function run(command, args) {
  console.log(`\n$ ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, { stdio: "inherit", env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited with status ${result.status}`);
}

function resolveApplied(name) {
  run("pnpm", ["--filter", "@bbos/database", "exec", "prisma", "migrate", "resolve", "--applied", name, "--schema=prisma/schema.prisma"]);
}

async function scalar(sql, ...values) {
  const rows = await prisma.$queryRawUnsafe(sql, ...values);
  return rows[0]?.value ?? null;
}
async function exists(sql, ...values) { return Boolean(await scalar(sql, ...values)); }
async function tableExists(name) {
  return exists(`SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1) AS value`, name);
}
async function columnExists(table, column) {
  return exists(`SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name=$2) AS value`, table, column);
}
async function indexExists(name) {
  return exists(`SELECT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname=$1) AS value`, name);
}
async function constraintExists(name) {
  return exists(`SELECT EXISTS (SELECT 1 FROM pg_constraint WHERE conname=$1) AS value`, name);
}

try {
  const serviceName = process.env.RENDER_SERVICE_NAME ?? "";
  if (serviceName && serviceName !== "bbos-api-staging") throw new Error(`Refusing staging recovery on Render service: ${serviceName}`);

  const migrationRoot = join(process.cwd(), "packages/database/prisma/migrations");
  const names = (await readdir(migrationRoot, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name).sort();
  const history = await prisma.$queryRawUnsafe(`SELECT migration_name, finished_at, rolled_back_at, logs FROM "_prisma_migrations" ORDER BY started_at, migration_name`);
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

  let v2Safe = true;
  const enumNames = ["PurchaseApprovalStatus", "PurchaseOperationalStatus", "PurchasePaymentTermType", "PurchaseInstallmentStatus"];
  const tableNames = ["GreenCoffeePurchaseInstallment", "SupplierBankAccount", "CoffeeSpecies", "CoffeeVariety"];
  const purchaseColumns = [
    "approvalStatus", "operationalStatus", "createdByUserId", "createdByName", "approvedByUserId", "approvedByName", "approvedAt",
    "rejectedByUserId", "rejectedAt", "rejectionReason", "department", "approverName", "supplierSnapshot", "qualityCategory",
    "additionalSpecification", "contractReference", "paymentTermType", "paymentTermData",
  ];
  const v2Indexes = [
    "GreenCoffeePurchaseInstallment_purchaseId_installmentNumber_key", "GreenCoffeePurchaseInstallment_accountsPayableId_key",
    "GreenCoffeePurchaseInstallment_status_dueDate_idx", "SupplierBankAccount_supplierId_active_idx", "CoffeeSpecies_companyId_code_key",
    "CoffeeVariety_speciesId_code_key", "CoffeeVariety_speciesId_active_idx",
  ];
  const v2Constraints = [
    "GreenCoffeePurchaseInstallment_purchaseId_fkey", "GreenCoffeePurchaseInstallment_accountsPayableId_fkey",
    "SupplierBankAccount_companyId_fkey", "SupplierBankAccount_supplierId_fkey", "CoffeeSpecies_companyId_fkey", "CoffeeVariety_speciesId_fkey",
  ];

  console.log(`\nAUDIT ${V2}`);
  for (const name of enumNames) { const ok = await exists(`SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname=$1) AS value`, name); console.log(`ENUM ${name}: ${ok ? "PASS" : "FAIL"}`); v2Safe &&= ok; }
  for (const name of tableNames) { const ok = await tableExists(name); console.log(`TABLE ${name}: ${ok ? "PASS" : "FAIL"}`); v2Safe &&= ok; }
  for (const name of purchaseColumns) { const ok = await columnExists("GreenCoffeePurchase", name); console.log(`COLUMN GreenCoffeePurchase.${name}: ${ok ? "PASS" : "FAIL"}`); v2Safe &&= ok; }
  for (const name of v2Indexes) { const ok = await indexExists(name); console.log(`INDEX ${name}: ${ok ? "PASS" : "FAIL"}`); v2Safe &&= ok; }
  for (const name of v2Constraints) { const ok = await constraintExists(name); console.log(`FK ${name}: ${ok ? "PASS" : "FAIL"}`); v2Safe &&= ok; }
  const requiredNotNull = ["approvalStatus", "operationalStatus", "createdByUserId", "createdByName", "supplierSnapshot", "qualityCategory", "paymentTermType", "paymentTermData"];
  const nullableRequired = await prisma.$queryRawUnsafe(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='GreenCoffeePurchase' AND column_name = ANY($1::text[]) AND is_nullable='YES'`, requiredNotNull);
  v2Safe &&= nullableRequired.length === 0;
  const speciesCount = Number(await scalar(`SELECT COUNT(*)::int AS value FROM "CoffeeSpecies"`));
  const varietyCount = Number(await scalar(`SELECT COUNT(*)::int AS value FROM "CoffeeVariety"`));
  v2Safe &&= speciesCount >= 1 && varietyCount >= 1;
  console.log(`SAFE ${V2}: ${v2Safe ? "YES" : "NO"}`);

  console.log(`\nAUDIT ${FIN_LINK}`);
  const finColumn = await columnExists("AccountsPayable", "purchaseId");
  const finIndex = await indexExists("AccountsPayable_purchaseId_dueDate_idx");
  const finFk = await constraintExists("AccountsPayable_purchaseId_fkey");
  const mismatches = Number(await scalar(`SELECT COUNT(*)::int AS value FROM "GreenCoffeePurchaseInstallment" i JOIN "AccountsPayable" a ON a.id=i."accountsPayableId" WHERE a."purchaseId" IS DISTINCT FROM i."purchaseId"`));
  const finSafe = finColumn && finIndex && finFk && mismatches === 0;
  console.log(`COLUMN AccountsPayable.purchaseId: ${finColumn ? "PASS" : "FAIL"}`);
  console.log(`INDEX AccountsPayable_purchaseId_dueDate_idx: ${finIndex ? "PASS" : "FAIL"}`);
  console.log(`FK AccountsPayable_purchaseId_fkey: ${finFk ? "PASS" : "FAIL"}`);
  console.log(`BACKFILL MISMATCHES: ${mismatches}`);
  console.log(`SAFE ${FIN_LINK}: ${finSafe ? "YES" : "NO"}`);

  console.log(`\nAUDIT ${EXTERNAL_ACCEPTANCE}`);
  const extChecks = [
    ["ENUM PurchaseExternalAcceptanceStatus", await exists(`SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname='PurchaseExternalAcceptanceStatus') AS value`)],
    ["COLUMN Supplier.contactRole", await columnExists("Supplier", "contactRole")],
    ["COLUMN Supplier.whatsapp", await columnExists("Supplier", "whatsapp")],
    ["COLUMN GreenCoffeePurchase.externalAcceptanceStatus", await columnExists("GreenCoffeePurchase", "externalAcceptanceStatus")],
    ["COLUMN GreenCoffeePurchase.termsVersion", await columnExists("GreenCoffeePurchase", "termsVersion")],
    ["COLUMN GreenCoffeePurchase.termsDocumentUrl", await columnExists("GreenCoffeePurchase", "termsDocumentUrl")],
    ["COLUMN GreenCoffeePurchase.acceptanceConditionText", await columnExists("GreenCoffeePurchase", "acceptanceConditionText")],
    ["TABLE GreenCoffeePurchaseAcceptance", await tableExists("GreenCoffeePurchaseAcceptance")],
    ["INDEX GreenCoffeePurchaseAcceptance_tokenHash_key", await indexExists("GreenCoffeePurchaseAcceptance_tokenHash_key")],
    ["INDEX GreenCoffeePurchaseAcceptance_purchaseId_status_idx", await indexExists("GreenCoffeePurchaseAcceptance_purchaseId_status_idx")],
    ["INDEX GreenCoffeePurchaseAcceptance_tokenExpiresAt_idx", await indexExists("GreenCoffeePurchaseAcceptance_tokenExpiresAt_idx")],
    ["FK GreenCoffeePurchaseAcceptance_purchaseId_fkey", await constraintExists("GreenCoffeePurchaseAcceptance_purchaseId_fkey")],
    ["FK GreenCoffeePurchaseAcceptance_supplierId_fkey", await constraintExists("GreenCoffeePurchaseAcceptance_supplierId_fkey")],
  ];
  let extSafe = true;
  for (const [label, ok] of extChecks) { console.log(`${label}: ${ok ? "PASS" : "FAIL"}`); extSafe &&= ok; }
  const acceptanceRequired = ["id", "purchaseId", "supplierId", "status", "tokenHash", "tokenExpiresAt", "termsVersion", "documentHash", "snapshot", "createdAt", "updatedAt"];
  const missingAcceptanceColumns = [];
  for (const column of acceptanceRequired) if (!(await columnExists("GreenCoffeePurchaseAcceptance", column))) missingAcceptanceColumns.push(column);
  const acceptanceNullable = await prisma.$queryRawUnsafe(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='GreenCoffeePurchaseAcceptance' AND column_name = ANY($1::text[]) AND is_nullable='YES'`, acceptanceRequired);
  const acceptanceShapeOk = missingAcceptanceColumns.length === 0 && acceptanceNullable.length === 0;
  console.log(`ACCEPTANCE REQUIRED COLUMNS: ${acceptanceShapeOk ? "PASS" : "FAIL"}`);
  extSafe &&= acceptanceShapeOk;
  console.log(`SAFE ${EXTERNAL_ACCEPTANCE}: ${extSafe ? "YES" : "NO"}`);

  const v2Status = status(V2);
  const finStatus = status(FIN_LINK);
  const extStatus = status(EXTERNAL_ACCEPTANCE);
  if (!v2Safe || !finSafe || !extSafe) throw new Error("Recovery audit failed; migration history was not changed.");

  await prisma.$disconnect();

  for (const [name, currentStatus] of [[V2, v2Status], [FIN_LINK, finStatus], [EXTERNAL_ACCEPTANCE, extStatus]]) {
    if (currentStatus === "FAILED" || currentStatus === "NOT_REGISTERED") resolveApplied(name);
    else if (currentStatus !== "APPLIED") throw new Error(`Unexpected ${name} status: ${currentStatus}`);
  }

  run("pnpm", ["db:generate"]);
  run("pnpm", ["db:migrate:deploy"]);
  run("pnpm", ["db:seed:coffee-references"]);
  run("pnpm", ["--filter", "@bbos/api", "build"]);
  console.log("\nSTAGING DATABASE RECOVERY: COMPLETE");
} finally {
  await prisma.$disconnect().catch(() => {});
}
