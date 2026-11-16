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

test("contabilidade consulta dados sem executar mutações financeiras ou operacionais", () => {
  const guard = new RoleAccessGuard(privateReflector);
  const allowedReads = [
    ["FinanceController", "summary"],
    ["FinanceController", "receivables"],
    ["ReconciliationController", "list"],
    ["CostingController", "summary"],
    ["FiscalInboundController", "list"],
    ["SalesOrdersController", "list"],
    ["SalesOrdersController", "pdf"],
    ["CustomersController", "salesHistory"],
  ] as const;
  for (const [controller, handler] of allowedReads) {
    assert.equal(
      guard.canActivate(
        executionContext({ controller, handler, role: "ACCOUNTANT" }),
      ),
      true,
      `${controller}.${handler} should be readable by ACCOUNTANT`,
    );
  }

  const deniedWrites = [
    ["FinanceController", "createPayable"],
    ["FinanceController", "receive"],
    ["ReconciliationController", "match"],
    ["CostingController", "createCostEvent"],
    ["FiscalInboundController", "importXml"],
    ["SalesOrdersController", "invoice"],
    ["SalesOrdersController", "reserve"],
    ["CustomersController", "credit"],
  ] as const;
  for (const [controller, handler] of deniedWrites) {
    assert.throws(
      () =>
        guard.canActivate(
          executionContext({ controller, handler, role: "ACCOUNTANT" }),
        ),
      ForbiddenException,
      `${controller}.${handler} must stay blocked for ACCOUNTANT`,
    );
  }
});

test("manual Pix approval is restricted to administrators", () => {
  const guard = new RoleAccessGuard(privateReflector);

  assert.equal(
    guard.canActivate(
      executionContext({
        controller: "SalesOrderManualPaymentsController",
        handler: "confirm",
        role: "ADMIN",
      }),
    ),
    true,
  );
  for (const role of ["EXECUTIVE", "FINANCE", "SALES"]) {
    assert.throws(
      () =>
        guard.canActivate(
          executionContext({
            controller: "SalesOrderManualPaymentsController",
            handler: "confirm",
            role,
          }),
        ),
      ForbiddenException,
    );
  }
});

test("seller requests credit but only leadership reaches the decision endpoint", () => {
  const guard = new RoleAccessGuard(privateReflector);

  assert.equal(
    guard.canActivate(
      executionContext({
        controller: "CustomersController",
        handler: "requestCredit",
        role: "SALES",
      }),
    ),
    true,
  );
  for (const role of ["SALES", "FINANCE"]) {
    assert.throws(
      () =>
        guard.canActivate(
          executionContext({
            controller: "CustomersController",
            handler: "credit",
            role,
          }),
        ),
      ForbiddenException,
    );
  }
  assert.equal(
    guard.canActivate(
      executionContext({
        controller: "CustomersController",
        handler: "credit",
        role: "ADMIN",
      }),
    ),
    true,
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

test("operations flow is not exposed to sellers and keeps stock changes operational", () => {
  const guard = new RoleAccessGuard(privateReflector);

  assert.throws(
    () =>
      guard.canActivate(
        executionContext({
          controller: "OperationsFlowController",
          handler: "summary",
          role: "SALES",
        }),
      ),
    ForbiddenException,
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

test("o vendedor consulta o catálogo comercial sem administrar produto fiscal", () => {
  const guard = new RoleAccessGuard(privateReflector);
  assert.equal(
    guard.canActivate(
      executionContext({
        controller: "ProductsController",
        handler: "listCatalog",
        role: "SALES",
      }),
    ),
    true,
  );
  for (const handler of [
    "createProduct",
    "createVariant",
    "updateProduct",
    "updateVariant",
    "retryBling",
    "ncmSuggestion",
    "uploadStorefrontImage",
  ]) {
    assert.throws(
      () =>
        guard.canActivate(
          executionContext({
            controller: "ProductsController",
            handler,
            role: "SALES",
          }),
        ),
      ForbiddenException,
    );
  }
});

test("o vendedor negocia e registra entrega, mas não opera estoque, fiscal ou expedição", () => {
  const guard = new RoleAccessGuard(privateReflector);
  for (const handler of [
    "create",
    "editDraft",
    "requestDiscount",
    "confirm",
    "deliver",
  ]) {
    assert.equal(
      guard.canActivate(
        executionContext({
          controller: "SalesOrdersController",
          handler,
          role: "SALES",
        }),
      ),
      true,
    );
  }
  for (const handler of [
    "reserve",
    "picking",
    "confirmPicking",
    "invoice",
    "label",
    "ship",
    "cancel",
    "prepareReexpedition",
    "decideDiscount",
    "decideTermApproval",
    "exportOverview",
  ]) {
    assert.throws(
      () =>
        guard.canActivate(
          executionContext({
            controller: "SalesOrdersController",
            handler,
            role: "SALES",
          }),
        ),
      ForbiddenException,
    );
  }
});

test("o vendedor não administra parceiros, corretores ou mídia da loja", () => {
  const guard = new RoleAccessGuard(privateReflector);
  assert.equal(
    guard.canActivate(
      executionContext({
        controller: "StorefrontPartnersController",
        handler: "list",
        role: "SALES",
      }),
    ),
    true,
  );
  for (const [controller, handler] of [
    ["StorefrontPartnersController", "create"],
    ["StorefrontPartnersController", "update"],
    ["BrokersController", "create"],
    ["BrokersController", "update"],
    ["AdminStorefrontMediaController", "list"],
  ] as const) {
    assert.throws(
      () =>
        guard.canActivate(
          executionContext({ controller, handler, role: "SALES" }),
        ),
      ForbiddenException,
    );
  }
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
        handler: "createOrder",
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
          handler: "portalPermissions",
          role: "EXECUTIVE",
        }),
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

test("o vendedor registra atendimentos sem abrir a operação para o financeiro", () => {
  const guard = new RoleAccessGuard(privateReflector);

  for (const handler of ["recentVisits", "createVisit"]) {
    assert.equal(
      guard.canActivate(
        executionContext({
          controller: "CustomersController",
          handler,
          role: "SALES",
        }),
      ),
      true,
    );
    assert.throws(
      () =>
        guard.canActivate(
          executionContext({
            controller: "CustomersController",
            handler,
            role: "FINANCE",
          }),
        ),
      ForbiddenException,
    );
  }
});

test("o vendedor não acessa e-commerce nem marketplaces", () => {
  const guard = new RoleAccessGuard(privateReflector);
  for (const controller of [
    "CommerceController",
    "StorefrontOrdersController",
    "StorefrontFulfillmentController",
    "MarketplacesController",
  ]) {
    assert.throws(
      () =>
        guard.canActivate(
          executionContext({ controller, handler: "list", role: "SALES" }),
        ),
      ForbiddenException,
    );
  }
});

test("partner portal data queries are always scoped to the signed partner and company", () => {
  const source = readFileSync(
    join(__dirname, "partner-portal.controller.ts"),
    "utf8",
  );
  assert.match(source, /actor\.storefrontPartnerId/);
  assert.match(source, /r\."companyId"=\$1 AND r\."partnerId"=\$2/);
  assert.match(source, /c\."companyId"=\$1 AND c\."partnerId"=\$2/);
  assert.match(source, /FROM "StorefrontPartnerCustomer" link/);
  assert.match(source, /so\."createdByStorefrontPartnerId"=\$2/);
  assert.match(source, /assertPartnerOrder/);
  assert.match(source, /orders\/:orderId\/billing\/pdf/);
  assert.match(source, /orders\/:orderId\/invoice\/pdf/);
  assert.match(source, /O DANFE ficará disponível após a autorização da NF-e/);
  assert.match(source, /"Cache-Control": "private, no-store"/);
  assert.match(source, /"SELLER", "SALES_MANAGER", "DISTRIBUTOR"/);
  assert.match(source, /partner\.portalAccessLevel === "SALES_MANAGER"/);
  assert.match(source, /assertCanManageCustomerPortfolio/);
  assert.match(source, /canCreateCustomers: \["SELLER", "SALES_MANAGER"\]/);
  assert.match(source, /isDistributor/);
  assert.doesNotMatch(source, /salesOrders\.confirm\(/);
});

test("distributor portal is tied to one matching customer account", () => {
  const source = readFileSync(
    join(__dirname, "storefront-partners.controller.ts"),
    "utf8",
  );
  assert.match(source, /accessLevel === "DISTRIBUTOR"/);
  assert.match(source, /customerIds\.length !== 1/);
  assert.match(source, /partnerTaxId !== customerTaxId/);
  assert.match(source, /mesmo CPF\/CNPJ/);
});

test("distributor catalog is filtered and priced on the server", () => {
  const source = readFileSync(
    join(__dirname, "partner-portal.controller.ts"),
    "utf8",
  );
  assert.match(source, /private async distributorCatalog/);
  assert.match(source, /private async distributorVariantOptions/);
  assert.match(source, /productVariant\.findMany/);
  assert.match(source, /productionToOrder: true/);
  assert.match(source, /Produção sob encomenda/);
  assert.match(source, /sc\.type='DISTRIBUIDOR'/);
  assert.match(source, /CustomerProductPrice/);
  assert.match(source, /CustomerCatalogProduct/);
  assert.match(source, /displayLineName/);
  assert.match(source, /catalogSortOrder/);
  assert.match(source, /distributorCatalog\.variantIds\.has/);
  assert.match(source, /customerProductPriceId/);
  assert.match(source, /paymentTermDays/);
  assert.match(source, /dias após a emissão da NF-e/);
  assert.match(source, /termApprovals\.ensureForOrder/);
  assert.match(source, /baseProductPriceId/);
  assert.match(source, /Produto não liberado na lista comercial/);
  assert.match(source, /aguardando aprovação de José ou Suzi/);
  assert.match(source, /data desejada será confirmada/);
  assert.match(source, /SalesOrderCustomerLifecycleService/);
  assert.match(source, /ORDER_SUBMITTED/);
  assert.match(source, /SALES_DISTRIBUTOR_ORDER/);
  assert.match(source, /SalesOrderCustomerEvent/);
  assert.match(source, /notifications: partnerNotifications/);
});

test("Signa catalog exposes only approved combinations and maps Reserva to Raro", () => {
  const migration = readFileSync(
    join(
      __dirname,
      "../../../packages/database/prisma/migrations/20261116170000_signa_exclusive_catalog_v1/migration.sql",
    ),
    "utf8",
  );
  assert.match(migration, /'Clássicos','Clássicos','GOU-WLE-250'/);
  assert.match(migration, /'Caramelo','Caramelo','CLA-CAR-1000'/);
  assert.match(migration, /'Frutado','Frutado','EPI-WLF-1000'/);
  assert.match(migration, /'Reserva','Reserva','RAR-WLR-250'/);
  assert.match(migration, /'WHITE_LABEL_RARO','RAROS'/);
  assert.match(migration, /esperadas 10 apresentações ativas/);
  assert.doesNotMatch(migration, /RAR-WLR-500|RAR-WLR-1000/);
});

test("distributor order requires José or Suzi approval and enters production", () => {
  const controllerSource = readFileSync(
    join(__dirname, "sales-orders.controller.ts"),
    "utf8",
  );
  const serviceSource = readFileSync(
    join(__dirname, "sales-orders.service.ts"),
    "utf8",
  );
  assert.match(controllerSource, /partnerAccessLevel === "DISTRIBUTOR"/);
  assert.match(controllerSource, /isDesignatedTermCreditApprover\(actor\)/);
  assert.match(controllerSource, /Somente José ou Suzi podem aprovar/);
  assert.match(controllerSource, /Defina a data de entrega antes de aprovar/);
  assert.match(serviceSource, /productionToOrder/);
  assert.match(serviceSource, /SalesOrderStatus\.IN_PRODUCTION/);
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
