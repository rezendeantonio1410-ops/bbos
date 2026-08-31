#!/usr/bin/env node
/* Staging-only migration recovery. Resolve only after read-only checks against the current schema. */
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
async function scalar(sql, ...values) { const rows = await prisma.$queryRawUnsafe(sql, ...values); return rows[0]?.value ?? null; }
async function exists(sql, ...values) { return Boolean(await scalar(sql, ...values)); }
async function table(name) { return exists(`SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1) AS value`, name); }
async function col(t, c) { return exists(`SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name=$2) AS value`, t, c); }
async function idx(name) { return exists(`SELECT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname=$1) AS value`, name); }
async function fk(name) { return exists(`SELECT EXISTS (SELECT 1 FROM pg_constraint WHERE conname=$1) AS value`, name); }
async function en(name) { return exists(`SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname=$1) AS value`, name); }
async function audit(name, checks) {
  console.log(`\nAUDIT ${name}`);
  let safe = true;
  for (const [label, promise] of checks) { const ok = await promise; console.log(`${label}: ${ok ? "PASS" : "FAIL"}`); safe &&= ok; }
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
  recoveries.push([v2, await audit(v2, [
    ["ENUM PurchaseApprovalStatus", en("PurchaseApprovalStatus")], ["ENUM PurchaseOperationalStatus", en("PurchaseOperationalStatus")],
    ["ENUM PurchasePaymentTermType", en("PurchasePaymentTermType")], ["ENUM PurchaseInstallmentStatus", en("PurchaseInstallmentStatus")],
    ["TABLE GreenCoffeePurchaseInstallment", table("GreenCoffeePurchaseInstallment")], ["TABLE SupplierBankAccount", table("SupplierBankAccount")],
    ["TABLE CoffeeSpecies", table("CoffeeSpecies")], ["TABLE CoffeeVariety", table("CoffeeVariety")],
    ["COLUMN GreenCoffeePurchase.approvalStatus", col("GreenCoffeePurchase", "approvalStatus")],
    ["COLUMN GreenCoffeePurchase.operationalStatus", col("GreenCoffeePurchase", "operationalStatus")],
    ["COLUMN GreenCoffeePurchase.createdByUserId", col("GreenCoffeePurchase", "createdByUserId")],
    ["COLUMN GreenCoffeePurchase.createdByName", col("GreenCoffeePurchase", "createdByName")],
    ["INDEX installment purchase/number", idx("GreenCoffeePurchaseInstallment_purchaseId_installmentNumber_key")],
    ["FK installment purchase", fk("GreenCoffeePurchaseInstallment_purchaseId_fkey")],
  ])]);

  const fin = "20260814130000_purchase_financial_purchase_link";
  const mismatchCount = Number(await scalar(`SELECT COUNT(*)::int AS value FROM "GreenCoffeePurchaseInstallment" i JOIN "AccountsPayable" a ON a.id=i."accountsPayableId" WHERE a."purchaseId" IS DISTINCT FROM i."purchaseId"`));
  recoveries.push([fin, await audit(fin, [
    ["COLUMN AccountsPayable.purchaseId", col("AccountsPayable", "purchaseId")], ["INDEX AccountsPayable purchase/dueDate", idx("AccountsPayable_purchaseId_dueDate_idx")],
    ["FK AccountsPayable purchase", fk("AccountsPayable_purchaseId_fkey")], ["BACKFILL CONSISTENCY", Promise.resolve(mismatchCount === 0)],
  ])]);

  const ext = "20260814150000_purchase_external_acceptance";
  recoveries.push([ext, await audit(ext, [
    ["ENUM PurchaseExternalAcceptanceStatus", en("PurchaseExternalAcceptanceStatus")], ["COLUMN Supplier.contactRole", col("Supplier", "contactRole")],
    ["COLUMN Supplier.whatsapp", col("Supplier", "whatsapp")], ["COLUMN GreenCoffeePurchase.externalAcceptanceStatus", col("GreenCoffeePurchase", "externalAcceptanceStatus")],
    ["TABLE GreenCoffeePurchaseAcceptance", table("GreenCoffeePurchaseAcceptance")], ["INDEX acceptance token", idx("GreenCoffeePurchaseAcceptance_tokenHash_key")],
    ["FK acceptance purchase", fk("GreenCoffeePurchaseAcceptance_purchaseId_fkey")], ["FK acceptance supplier", fk("GreenCoffeePurchaseAcceptance_supplierId_fkey")],
  ])]);

  const lifecycle = "20260814180000_purchase_submission_lifecycle";
  recoveries.push([lifecycle, await audit(lifecycle, [
    ["COLUMN submittedForApprovalAt", col("GreenCoffeePurchase", "submittedForApprovalAt")],
    ["COLUMN submittedForApprovalByUserId", col("GreenCoffeePurchase", "submittedForApprovalByUserId")],
  ])]);

  const ret = "20260815090000_purchase_return_adjustment";
  recoveries.push([ret, await audit(ret, [
    ["COLUMN returnedByUserId", col("GreenCoffeePurchase", "returnedByUserId")], ["COLUMN returnedAt", col("GreenCoffeePurchase", "returnedAt")],
    ["COLUMN returnReason", col("GreenCoffeePurchase", "returnReason")], ["COLUMN correctionRequest", col("GreenCoffeePurchase", "correctionRequest")],
  ])]);

  const contacts = "20260816120000_supplier_contacts";
  recoveries.push([contacts, await audit(contacts, [
    ["TABLE SupplierContact", table("SupplierContact")],
    ["COLUMN acceptance.supplierContactId", col("GreenCoffeePurchaseAcceptance", "supplierContactId")],
    ["COLUMN acceptance.contactPhoneSnapshot", col("GreenCoffeePurchaseAcceptance", "contactPhoneSnapshot")],
    ["COLUMN acceptance.contactEmailSnapshot", col("GreenCoffeePurchaseAcceptance", "contactEmailSnapshot")],
    ["INDEX SupplierContact supplier/active/confirm", idx("SupplierContact_supplierId_active_canConfirmBusiness_idx")],
    ["FK SupplierContact supplier", fk("SupplierContact_supplierId_fkey")],
    ["FK acceptance supplierContact", fk("GreenCoffeePurchaseAcceptance_supplierContactId_fkey")],
  ])]);

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
