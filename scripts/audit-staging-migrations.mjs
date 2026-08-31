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
async function enumValue(type, value) { return exists(`SELECT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname=$1 AND e.enumlabel=$2) AS value`, type, value); }
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
  async function add(name, checks) { recoveries.push([name, await audit(name, checks)]); }

  await add("20260814120000_green_coffee_purchase_v2", [
    ["ENUM PurchaseApprovalStatus", en("PurchaseApprovalStatus")], ["ENUM PurchaseOperationalStatus", en("PurchaseOperationalStatus")],
    ["ENUM PurchasePaymentTermType", en("PurchasePaymentTermType")], ["ENUM PurchaseInstallmentStatus", en("PurchaseInstallmentStatus")],
    ["TABLE GreenCoffeePurchaseInstallment", table("GreenCoffeePurchaseInstallment")], ["TABLE SupplierBankAccount", table("SupplierBankAccount")],
    ["TABLE CoffeeSpecies", table("CoffeeSpecies")], ["TABLE CoffeeVariety", table("CoffeeVariety")],
    ["COLUMN purchase.approvalStatus", col("GreenCoffeePurchase", "approvalStatus")], ["COLUMN purchase.operationalStatus", col("GreenCoffeePurchase", "operationalStatus")],
    ["COLUMN purchase.createdByUserId", col("GreenCoffeePurchase", "createdByUserId")], ["COLUMN purchase.createdByName", col("GreenCoffeePurchase", "createdByName")],
    ["INDEX installment purchase/number", idx("GreenCoffeePurchaseInstallment_purchaseId_installmentNumber_key")], ["FK installment purchase", fk("GreenCoffeePurchaseInstallment_purchaseId_fkey")],
  ]);

  const mismatchCount = Number(await scalar(`SELECT COUNT(*)::int AS value FROM "GreenCoffeePurchaseInstallment" i JOIN "AccountsPayable" a ON a.id=i."accountsPayableId" WHERE a."purchaseId" IS DISTINCT FROM i."purchaseId"`));
  await add("20260814130000_purchase_financial_purchase_link", [
    ["COLUMN AccountsPayable.purchaseId", col("AccountsPayable", "purchaseId")], ["INDEX AccountsPayable purchase/dueDate", idx("AccountsPayable_purchaseId_dueDate_idx")],
    ["FK AccountsPayable purchase", fk("AccountsPayable_purchaseId_fkey")], ["BACKFILL CONSISTENCY", Promise.resolve(mismatchCount === 0)],
  ]);

  await add("20260814150000_purchase_external_acceptance", [
    ["ENUM PurchaseExternalAcceptanceStatus", en("PurchaseExternalAcceptanceStatus")], ["COLUMN Supplier.contactRole", col("Supplier", "contactRole")],
    ["COLUMN Supplier.whatsapp", col("Supplier", "whatsapp")], ["COLUMN purchase.externalAcceptanceStatus", col("GreenCoffeePurchase", "externalAcceptanceStatus")],
    ["TABLE GreenCoffeePurchaseAcceptance", table("GreenCoffeePurchaseAcceptance")], ["INDEX acceptance token", idx("GreenCoffeePurchaseAcceptance_tokenHash_key")],
    ["FK acceptance purchase", fk("GreenCoffeePurchaseAcceptance_purchaseId_fkey")], ["FK acceptance supplier", fk("GreenCoffeePurchaseAcceptance_supplierId_fkey")],
  ]);

  await add("20260814180000_purchase_submission_lifecycle", [["COLUMN submittedForApprovalAt", col("GreenCoffeePurchase", "submittedForApprovalAt")], ["COLUMN submittedForApprovalByUserId", col("GreenCoffeePurchase", "submittedForApprovalByUserId")]]);
  await add("20260815090000_purchase_return_adjustment", [["COLUMN returnedByUserId", col("GreenCoffeePurchase", "returnedByUserId")], ["COLUMN returnedAt", col("GreenCoffeePurchase", "returnedAt")], ["COLUMN returnReason", col("GreenCoffeePurchase", "returnReason")], ["COLUMN correctionRequest", col("GreenCoffeePurchase", "correctionRequest")]]);
  await add("20260816120000_supplier_contacts", [
    ["TABLE SupplierContact", table("SupplierContact")], ["COLUMN acceptance.supplierContactId", col("GreenCoffeePurchaseAcceptance", "supplierContactId")],
    ["COLUMN acceptance.contactPhoneSnapshot", col("GreenCoffeePurchaseAcceptance", "contactPhoneSnapshot")], ["COLUMN acceptance.contactEmailSnapshot", col("GreenCoffeePurchaseAcceptance", "contactEmailSnapshot")],
    ["INDEX SupplierContact supplier/active/confirm", idx("SupplierContact_supplierId_active_canConfirmBusiness_idx")], ["FK SupplierContact supplier", fk("SupplierContact_supplierId_fkey")], ["FK acceptance supplierContact", fk("GreenCoffeePurchaseAcceptance_supplierContactId_fkey")],
  ]);
  await add("20260818100000_user_avatar", [["COLUMN User.avatarUrl", col("User", "avatarUrl")]]);

  await add("20260819090000_green_coffee_reference_data_v1", [
    ["COLUMN CoffeeVariety.breeder", col("CoffeeVariety", "breeder")], ["COLUMN CoffeeVariety.sortOrder", col("CoffeeVariety", "sortOrder")], ["TABLE CoffeeRegion", table("CoffeeRegion")], ["TABLE ScreenClassification", table("ScreenClassification")],
    ["INDEX CoffeeRegion unique", idx("CoffeeRegion_companyId_state_name_key")], ["INDEX CoffeeRegion active", idx("CoffeeRegion_companyId_state_active_idx")], ["FK CoffeeRegion company", fk("CoffeeRegion_companyId_fkey")],
    ["INDEX ScreenClassification unique", idx("ScreenClassification_companyId_code_key")], ["INDEX ScreenClassification active", idx("ScreenClassification_companyId_active_idx")], ["FK ScreenClassification company", fk("ScreenClassification_companyId_fkey")],
    ["COLUMN purchase.speciesId", col("GreenCoffeePurchase", "speciesId")], ["COLUMN purchase.cultivarId", col("GreenCoffeePurchase", "cultivarId")], ["COLUMN purchase.coffeeRegionId", col("GreenCoffeePurchase", "coffeeRegionId")], ["COLUMN purchase.screenClassificationId", col("GreenCoffeePurchase", "screenClassificationId")],
    ["INDEX purchase species", idx("GreenCoffeePurchase_speciesId_idx")], ["INDEX purchase cultivar", idx("GreenCoffeePurchase_cultivarId_idx")], ["INDEX purchase region", idx("GreenCoffeePurchase_coffeeRegionId_idx")], ["INDEX purchase screen", idx("GreenCoffeePurchase_screenClassificationId_idx")],
    ["FK purchase species", fk("GreenCoffeePurchase_speciesId_fkey")], ["FK purchase cultivar", fk("GreenCoffeePurchase_cultivarId_fkey")], ["FK purchase region", fk("GreenCoffeePurchase_coffeeRegionId_fkey")], ["FK purchase screen", fk("GreenCoffeePurchase_screenClassificationId_fkey")],
  ]);

  const supplierActiveShape = await prisma.$queryRawUnsafe(`SELECT is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='Supplier' AND column_name='active'`);
  await add("20260819093000_supplier_active_reference_bootstrap", [["COLUMN Supplier.active", col("Supplier", "active")], ["Supplier.active NOT NULL", Promise.resolve(supplierActiveShape[0]?.is_nullable === "NO")], ["Supplier.active DEFAULT true", Promise.resolve(String(supplierActiveShape[0]?.column_default).toLowerCase() === "true")]]);

  await add("20260819110000_supplier_origin_units", [
    ["TABLE SupplierOriginUnit", table("SupplierOriginUnit")], ["INDEX origin unique", idx("SupplierOriginUnit_supplierId_name_key")], ["INDEX origin supplier/state/active", idx("SupplierOriginUnit_supplierId_state_active_idx")], ["INDEX origin region", idx("SupplierOriginUnit_coffeeRegionId_idx")],
    ["FK origin supplier", fk("SupplierOriginUnit_supplierId_fkey")], ["FK origin region", fk("SupplierOriginUnit_coffeeRegionId_fkey")], ["COLUMN purchase.originUnitId", col("GreenCoffeePurchase", "originUnitId")], ["INDEX purchase origin", idx("GreenCoffeePurchase_originUnitId_idx")], ["FK purchase origin", fk("GreenCoffeePurchase_originUnitId_fkey")],
  ]);

  await add("20260819130000_supplier_origin_details", [
    ["ENUM COOPERATIVE", enumValue("GreenCoffeeSupplierType", "COOPERATIVE")], ["ENUM ASSOCIATION", enumValue("GreenCoffeeSupplierType", "ASSOCIATION")], ["ENUM EXPORTER", enumValue("GreenCoffeeSupplierType", "EXPORTER")], ["ENUM OTHER", enumValue("GreenCoffeeSupplierType", "OTHER")],
    ["COLUMN Supplier.tradeName", col("Supplier", "tradeName")], ["COLUMN origin.taxId", col("SupplierOriginUnit", "taxId")], ["COLUMN origin.stateRegistration", col("SupplierOriginUnit", "stateRegistration")], ["COLUMN origin.address", col("SupplierOriginUnit", "address")],
    ["COLUMN origin.latitude", col("SupplierOriginUnit", "latitude")], ["COLUMN origin.longitude", col("SupplierOriginUnit", "longitude")], ["COLUMN origin.altitudeMeters", col("SupplierOriginUnit", "altitudeMeters")], ["COLUMN origin.coffeeAreaHa", col("SupplierOriginUnit", "coffeeAreaHa")],
    ["TABLE SupplierOriginProduction", table("SupplierOriginProduction")], ["INDEX production origin", idx("SupplierOriginProduction_originUnitId_active_idx")], ["INDEX production species/cultivar", idx("SupplierOriginProduction_speciesId_cultivarId_idx")],
    ["FK production origin", fk("SupplierOriginProduction_originUnitId_fkey")], ["FK production species", fk("SupplierOriginProduction_speciesId_fkey")], ["FK production cultivar", fk("SupplierOriginProduction_cultivarId_fkey")],
  ]);

  await add("20260819150000_structured_supplier_addresses", [
    ["COLUMN Supplier.postalCode", col("Supplier", "postalCode")], ["COLUMN Supplier.district", col("Supplier", "district")], ["COLUMN Supplier.addressComplement", col("Supplier", "addressComplement")], ["COLUMN Supplier.ibgeCityCode", col("Supplier", "ibgeCityCode")],
    ["COLUMN origin.postalCode", col("SupplierOriginUnit", "postalCode")], ["COLUMN origin.district", col("SupplierOriginUnit", "district")], ["COLUMN origin.addressComplement", col("SupplierOriginUnit", "addressComplement")], ["COLUMN origin.ibgeCityCode", col("SupplierOriginUnit", "ibgeCityCode")],
  ]);

  await add("20260819160000_supplier_tax_verification", [
    ["ENUM TaxVerificationStatus", en("TaxVerificationStatus")], ["COLUMN Supplier.taxIdVerificationStatus", col("Supplier", "taxIdVerificationStatus")], ["COLUMN Supplier.taxIdVerifiedAt", col("Supplier", "taxIdVerifiedAt")], ["COLUMN Supplier.taxIdVerificationSource", col("Supplier", "taxIdVerificationSource")],
    ["COLUMN Supplier.stateRegistrationVerificationStatus", col("Supplier", "stateRegistrationVerificationStatus")], ["COLUMN Supplier.stateRegistrationVerifiedAt", col("Supplier", "stateRegistrationVerifiedAt")], ["COLUMN Supplier.stateRegistrationVerificationSource", col("Supplier", "stateRegistrationVerificationSource")],
  ]);

  const registrationShape = await prisma.$queryRawUnsafe(`SELECT is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='Supplier' AND column_name='stateRegistrationType'`);
  await add("20260819170000_supplier_state_registration_type", [
    ["COLUMN Supplier.stateRegistrationType", col("Supplier", "stateRegistrationType")], ["stateRegistrationType NOT NULL", Promise.resolve(registrationShape[0]?.is_nullable === "NO")], ["stateRegistrationType DEFAULT NUMBER", Promise.resolve(String(registrationShape[0]?.column_default).includes("NUMBER"))],
  ]);

  await add("20260820100000_purchase_broker_v2", [
    ["ENUM PurchaseConfirmationDocumentStatus", en("PurchaseConfirmationDocumentStatus")], ["TABLE Broker", table("Broker")], ["FK Broker company", fk("Broker_companyId_fkey")], ["INDEX Broker company/taxId", idx("Broker_companyId_taxId_key")], ["INDEX Broker company/active", idx("Broker_companyId_active_idx")],
    ["COLUMN purchase.brokerId", col("GreenCoffeePurchase", "brokerId")], ["COLUMN purchase.brokerCommissionPercent", col("GreenCoffeePurchase", "brokerCommissionPercent")], ["COLUMN purchase.brokerCommissionAmount", col("GreenCoffeePurchase", "brokerCommissionAmount")], ["INDEX purchase broker", idx("GreenCoffeePurchase_brokerId_idx")], ["FK purchase broker", fk("GreenCoffeePurchase_brokerId_fkey")],
    ["TABLE PurchaseConfirmationDocumentVersion", table("PurchaseConfirmationDocumentVersion")], ["INDEX document purchase/version", idx("PurchaseConfirmationDocumentVersion_purchaseId_version_key")], ["INDEX document purchase/status", idx("PurchaseConfirmationDocumentVersion_purchaseId_status_idx")], ["FK document purchase", fk("PurchaseConfirmationDocumentVersion_purchaseId_fkey")],
    ["COLUMN AccountsPayable.brokerId", col("AccountsPayable", "brokerId")], ["COLUMN AccountsPayable.brokerCommissionPayableKey", col("AccountsPayable", "brokerCommissionPayableKey")], ["INDEX AccountsPayable broker key", idx("AccountsPayable_brokerCommissionPayableKey_key")], ["FK AccountsPayable broker", fk("AccountsPayable_brokerId_fkey")],
  ]);

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
