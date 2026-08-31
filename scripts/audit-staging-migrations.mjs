#!/usr/bin/env node
/* Staging-only migration recovery. A failed/not-registered migration is resolved only after its materialized objects pass read-only checks. */
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const requireFromDatabase = createRequire(join(process.cwd(), "packages/database/package.json"));
const { PrismaClient } = requireFromDatabase("@prisma/client");
const prisma = new PrismaClient();

function run(command, args) {
  console.log(`\n$ ${command} ${args.join(" ")}`);
  const r = spawnSync(command, args, { stdio: "inherit", env: process.env });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`${command} exited with status ${r.status}`);
}
function resolveApplied(name) {
  run("pnpm", ["--filter", "@bbos/database", "exec", "prisma", "migrate", "resolve", "--applied", name, "--schema=prisma/schema.prisma"]);
}
async function scalar(sql, ...values) {
  const rows = await prisma.$queryRawUnsafe(sql, ...values);
  return rows[0]?.value ?? null;
}
async function exists(sql, ...values) { return Boolean(await scalar(sql, ...values)); }
async function table(name) { return exists(`SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1) AS value`, name); }
async function col(t, c) { return exists(`SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name=$2) AS value`, t, c); }
async function idx(name) { return exists(`SELECT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname=$1) AS value`, name); }
async function fk(name) { return exists(`SELECT EXISTS (SELECT 1 FROM pg_constraint WHERE conname=$1) AS value`, name); }
async function en(name) { return exists(`SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname=$1) AS value`, name); }

async function audit(name, checks) {
  console.log(`\nAUDIT ${name}`);
  let safe = true;
  for (const [label, promise] of checks) {
    const ok = await promise;
    console.log(`${label}: ${ok ? "PASS" : "FAIL"}`);
    safe &&= ok;
  }
  console.log(`SAFE ${name}: ${safe ? "YES" : "NO"}`);
  return safe;
}

try {
  const serviceName = process.env.RENDER_SERVICE_NAME ?? "";
  if (serviceName && serviceName !== "bbos-api-staging") throw new Error(`Refusing recovery on Render service: ${serviceName}`);

  const history = await prisma.$queryRawUnsafe(`SELECT migration_name, finished_at, rolled_back_at, logs FROM "_prisma_migrations" ORDER BY started_at, migration_name`);
  const byName = new Map(history.map((r) => [r.migration_name, r]));
  const status = (name) => {
    const r = byName.get(name);
    if (!r) return "NOT_REGISTERED";
    if (r.rolled_back_at) return "ROLLED_BACK";
    if (r.finished_at) return "APPLIED";
    if (r.logs) return "FAILED";
    return "PENDING";
  };

  const recoveries = [];

  const v2 = "20260814120000_green_coffee_purchase_v2";
  const v2Safe = await audit(v2, [
    ["ENUM PurchaseApprovalStatus", en("PurchaseApprovalStatus")],
    ["ENUM PurchaseOperationalStatus", en("PurchaseOperationalStatus")],
    ["ENUM PurchasePaymentTermType", en("PurchasePaymentTermType")],
    ["ENUM PurchaseInstallmentStatus", en("PurchaseInstallmentStatus")],
    ["TABLE GreenCoffeePurchaseInstallment", table("GreenCoffeePurchaseInstallment")],
    ["TABLE SupplierBankAccount", table("SupplierBankAccount")],
    ["TABLE CoffeeSpecies", table("CoffeeSpecies")],
    ["TABLE CoffeeVariety", table("CoffeeVariety")],
    ["COLUMN GreenCoffeePurchase.approvalStatus", col("GreenCoffeePurchase", "approvalStatus")],
    ["COLUMN GreenCoffeePurchase.operationalStatus", col("GreenCoffeePurchase", "operationalStatus")],
    ["COLUMN GreenCoffeePurchase.createdByUserId", col("GreenCoffeePurchase", "createdByUserId")],
    ["COLUMN GreenCoffeePurchase.createdByName", col("GreenCoffeePurchase", "createdByName")],
    ["COLUMN GreenCoffeePurchase.supplierSnapshot", col("GreenCoffeePurchase", "supplierSnapshot")],
    ["COLUMN GreenCoffeePurchase.paymentTermType", col("GreenCoffeePurchase", "paymentTermType")],
    ["INDEX installment purchase/number", idx("GreenCoffeePurchaseInstallment_purchaseId_installmentNumber_key")],
    ["FK installment purchase", fk("GreenCoffeePurchaseInstallment_purchaseId_fkey")],
    ["FK coffee species company", fk("CoffeeSpecies_companyId_fkey")],
    ["FK coffee variety species", fk("CoffeeVariety_speciesId_fkey")],
  ]);
  recoveries.push([v2, v2Safe]);

  const fin = "20260814130000_purchase_financial_purchase_link";
  const mismatchCount = Number(await scalar(`SELECT COUNT(*)::int AS value FROM "GreenCoffeePurchaseInstallment" i JOIN "AccountsPayable" a ON a.id=i."accountsPayableId" WHERE a."purchaseId" IS DISTINCT FROM i."purchaseId"`));
  const finSafe = await audit(fin, [
    ["COLUMN AccountsPayable.purchaseId", col("AccountsPayable", "purchaseId")],
    ["INDEX AccountsPayable_purchaseId_dueDate_idx", idx("AccountsPayable_purchaseId_dueDate_idx")],
    ["FK AccountsPayable_purchaseId_fkey", fk("AccountsPayable_purchaseId_fkey")],
    ["BACKFILL CONSISTENCY", Promise.resolve(mismatchCount === 0)],
  ]);
  recoveries.push([fin, finSafe]);

  const ext = "20260814150000_purchase_external_acceptance";
  const extSafe = await audit(ext, [
    ["ENUM PurchaseExternalAcceptanceStatus", en("PurchaseExternalAcceptanceStatus")],
    ["COLUMN Supplier.contactRole", col("Supplier", "contactRole")],
    ["COLUMN Supplier.whatsapp", col("Supplier", "whatsapp")],
    ["COLUMN GreenCoffeePurchase.externalAcceptanceStatus", col("GreenCoffeePurchase", "externalAcceptanceStatus")],
    ["COLUMN GreenCoffeePurchase.termsVersion", col("GreenCoffeePurchase", "termsVersion")],
    ["COLUMN GreenCoffeePurchase.termsDocumentUrl", col("GreenCoffeePurchase", "termsDocumentUrl")],
    ["COLUMN GreenCoffeePurchase.acceptanceConditionText", col("GreenCoffeePurchase", "acceptanceConditionText")],
    ["TABLE GreenCoffeePurchaseAcceptance", table("GreenCoffeePurchaseAcceptance")],
    ["INDEX acceptance token", idx("GreenCoffeePurchaseAcceptance_tokenHash_key")],
    ["INDEX acceptance purchase/status", idx("GreenCoffeePurchaseAcceptance_purchaseId_status_idx")],
    ["INDEX acceptance expiry", idx("GreenCoffeePurchaseAcceptance_tokenExpiresAt_idx")],
    ["FK acceptance purchase", fk("GreenCoffeePurchaseAcceptance_purchaseId_fkey")],
    ["FK acceptance supplier", fk("GreenCoffeePurchaseAcceptance_supplierId_fkey")],
  ]);
  recoveries.push([ext, extSafe]);

  const lifecycle = "20260814180000_purchase_submission_lifecycle";
  const lifecycleSafe = await audit(lifecycle, [
    ["COLUMN GreenCoffeePurchase.submittedForApprovalAt", col("GreenCoffeePurchase", "submittedForApprovalAt")],
    ["COLUMN GreenCoffeePurchase.submittedForApprovalByUserId", col("GreenCoffeePurchase", "submittedForApprovalByUserId")],
  ]);
  recoveries.push([lifecycle, lifecycleSafe]);

  if (recoveries.some(([, safe]) => !safe)) throw new Error("Recovery audit failed; migration history was not changed.");
  await prisma.$disconnect();

  for (const [name] of recoveries) {
    const s = status(name);
    console.log(`${name}: ${s}`);
    if (s === "FAILED" || s === "NOT_REGISTERED") resolveApplied(name);
    else if (s !== "APPLIED") throw new Error(`Unexpected ${name} status: ${s}`);
  }

  run("pnpm", ["db:generate"]);
  run("pnpm", ["db:migrate:deploy"]);
  run("pnpm", ["db:seed:coffee-references"]);
  run("pnpm", ["--filter", "@bbos/api", "build"]);
  console.log("\nSTAGING DATABASE RECOVERY: COMPLETE");
} finally {
  await prisma.$disconnect().catch(() => {});
}
