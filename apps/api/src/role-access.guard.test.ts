import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { ForbiddenException } from "@nestjs/common";
import { CONTROLLER_ROLE_POLICY, RoleAccessGuard } from "./role-access.guard";

function executionContext(options: {
  controller: string;
  handler?: string;
  role?: string;
}) {
  const controller = { [options.controller]: class {} }[options.controller]!;
  const handler = {
    [options.handler ?? "index"]: function () {},
  }[options.handler ?? "index"]!;
  return {
    getClass: () => controller,
    getHandler: () => handler,
    switchToHttp: () => ({
      getRequest: () => ({
        user: options.role ? { role: options.role } : undefined,
      }),
    }),
  } as never;
}

const privateReflector = {
  getAllAndOverride: () => false,
} as never;

test("finance access is enforced by the API, not only hidden in navigation", () => {
  const guard = new RoleAccessGuard(privateReflector);

  assert.equal(
    guard.canActivate(
      executionContext({ controller: "FinanceController", role: "FINANCE" }),
    ),
    true,
  );
  assert.throws(
    () =>
      guard.canActivate(
        executionContext({ controller: "FinanceController", role: "SALES" }),
      ),
    ForbiddenException,
  );
});

test("dashboard endpoints honor their narrower executive and industrial scopes", () => {
  const guard = new RoleAccessGuard(privateReflector);

  assert.throws(
    () =>
      guard.canActivate(
        executionContext({
          controller: "DashboardController",
          handler: "executive",
          role: "FINANCE",
        }),
      ),
    ForbiddenException,
  );
  assert.equal(
    guard.canActivate(
      executionContext({
        controller: "DashboardController",
        handler: "industrial",
        role: "INDUSTRIAL",
      }),
    ),
    true,
  );
});

test("unmapped private controllers fail closed", () => {
  const guard = new RoleAccessGuard(privateReflector);
  assert.throws(
    () =>
      guard.canActivate(
        executionContext({ controller: "FutureController", role: "ADMIN" }),
      ),
    /Política de acesso não definida/,
  );
});

test("every registered non-public controller has an explicit access policy", () => {
  const source = readFileSync(join(__dirname, "app.module.ts"), "utf8");
  const controllerBlock = source.match(
    /controllers:\s*\[([\s\S]*?)\],\s*providers:/,
  )?.[1];
  assert.ok(controllerBlock, "controller registry must be readable");
  const registered = controllerBlock
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const publicOnly = new Set([
    "HealthController",
    "PurchaseAcceptanceController",
    "CuppingPublicController",
    "BlingWebhookController",
    "StorefrontShippingController",
    "StorefrontCatalogController",
    "StorefrontCustomerController",
    "PublicStorefrontMediaController",
  ]);
  const missing = registered.filter(
    (controller) =>
      !publicOnly.has(controller) && !CONTROLLER_ROLE_POLICY[controller],
  );
  assert.deepEqual(missing, []);
});
