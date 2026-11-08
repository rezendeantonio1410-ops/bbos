import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const recoverableMigration = "20261108170000_customer_specific_pricing_v1";

function runPrisma(args) {
  const result = spawnSync("pnpm", ["exec", "prisma", ...args], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`prisma ${args.join(" ")} exited with ${result.status}`);
}

async function recoverKnownRolledBackMigration() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT migration_name, finished_at, rolled_back_at, applied_steps_count
       FROM "_prisma_migrations"
      WHERE migration_name = $1
      ORDER BY started_at DESC
      LIMIT 1`,
    recoverableMigration,
  );
  const failed = rows[0];
  if (!failed || failed.finished_at || failed.rolled_back_at) return;
  if (Number(failed.applied_steps_count) !== 0)
    throw new Error(
      `Refusing automatic recovery: ${recoverableMigration} recorded applied steps.`,
    );

  const state = await prisma.$queryRawUnsafe(`
    SELECT
      to_regclass('public."CustomerProductPrice"') IS NOT NULL AS "priceTableExists",
      to_regclass('public."CustomerProductPriceEvent"') IS NOT NULL AS "eventTableExists",
      EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema='public'
           AND table_name='SalesOrderItem'
           AND column_name IN (
             'pricingSource',
             'baseProductPriceId',
             'customerProductPriceId',
             'priceSnapshot'
           )
      ) AS "salesItemColumnsExist"
  `);
  const snapshot = state[0];
  if (
    snapshot?.priceTableExists ||
    snapshot?.eventTableExists ||
    snapshot?.salesItemColumnsExist
  )
    throw new Error(
      `Refusing automatic recovery: ${recoverableMigration} left database objects behind.`,
    );

  console.log(
    `Recovering ${recoverableMigration}: zero steps and no partial objects confirmed.`,
  );
  await prisma.$disconnect();
  runPrisma([
    "migrate",
    "resolve",
    "--rolled-back",
    recoverableMigration,
    "--schema=prisma/schema.prisma",
  ]);
}

try {
  await recoverKnownRolledBackMigration();
  await prisma.$disconnect();
  runPrisma(["migrate", "deploy", "--schema=prisma/schema.prisma"]);
} catch (error) {
  await prisma.$disconnect();
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
