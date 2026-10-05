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

test("internal cupping sessions are available only to operational roles", () => {
  const guard = new RoleAccessGuard(privateReflector);

  assert.equal(
    guard.canActivate(
      executionContext({
        controller: "CuppingPublicController",
        handler: "list",
        role: "INDUSTRIAL",
      }),
    ),
    true,
  );
  assert.throws(
    () =>
      guard.canActivate(
        executionContext({
          controller: "CuppingPublicController",
          handler: "list",
          role: "FINANCE",
        }),
      ),
    ForbiddenException,
  );
});

test("operations flow keeps broad visibility but restricts stock changes", () => {
  const guard = new RoleAccessGuard(privateReflector);

  assert.equal(
    guard.canActivate(
      executionContext({
        controller: "OperationsFlowController",
        handler: "summary",
        role: "SALES",
      }),
    ),
    true,
  );
  assert.throws(
    () =>
      guard.canActivate(
        executionContext({
          controller: "OperationsFlowController",
          handler: "stockIn",
          role: "SALES",
        }),
      ),
    ForbiddenException,
  );
  assert.equal(
    guard.canActivate(
      executionContext({
        controller: "OperationsFlowController",
        handler: "stockPolicy",
        role: "INDUSTRIAL",
      }),
    ),
    true,
  );
  assert.throws(
    () =>
      guard.canActivate(
        executionContext({
          controller: "OperationsFlowActionsController",
          handler: "expiry",
          role: "FINANCE",
        }),
      ),
    ForbiddenException,
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

test("partner access is isolated from the internal BBOS", () => {
  const guard = new RoleAccessGuard(privateReflector);

  assert.equal(
    guard.canActivate(
      executionContext({
        controller: "PartnerPortalController",
        handler: "summary",
        role: "PARTNER",
      }),
    ),
    true,
  );
  assert.throws(
    () =>
      guard.canActivate(
        executionContext({ controller: "FinanceController", role: "PARTNER" }),
      ),
    ForbiddenException,
  );
  assert.throws(
    () =>
      guard.canActivate(
        executionContext({
          controller: "StorefrontPartnersController",
          handler: "portalAccess",
          role: "SALES",
        }),
      ),
    ForbiddenException,
  );
});

test("partner portal data queries are always scoped to the signed partner and company", () => {
  const source = readFileSync(
    join(__dirname, "partner-portal.controller.ts"),
    "utf8",
  );
  assert.match(source, /actor\.storefrontPartnerId/);
  assert.match(source, /r\."companyId"=\$1 AND r\."partnerId"=\$2/);
  assert.match(source, /c\."companyId"=\$1 AND c\."partnerId"=\$2/);
  assert.doesNotMatch(source, /JOIN "Customer"/);
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
