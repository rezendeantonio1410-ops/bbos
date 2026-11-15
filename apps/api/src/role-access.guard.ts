import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC } from "./auth.guard";

export type BbosRole =
  | "ADMIN"
  | "EXECUTIVE"
  | "INDUSTRIAL"
  | "FINANCE"
  | "ACCOUNTANT"
  | "SALES"
  | "MARKETPLACE_OPERATOR"
  | "PARTNER";

const ALL: readonly BbosRole[] = [
  "ADMIN",
  "EXECUTIVE",
  "INDUSTRIAL",
  "FINANCE",
  "ACCOUNTANT",
  "SALES",
  "MARKETPLACE_OPERATOR",
];
const AUTHENTICATED: readonly BbosRole[] = [...ALL, "PARTNER"];
const CORE: readonly BbosRole[] = ALL.filter(
  (role) => role !== "MARKETPLACE_OPERATOR" && role !== "ACCOUNTANT",
);
const CORE_WITHOUT_SALES: readonly BbosRole[] = CORE.filter(
  (role) => role !== "SALES",
);
const LEADERSHIP: readonly BbosRole[] = ["ADMIN", "EXECUTIVE"];
const OPERATIONS: readonly BbosRole[] = ["ADMIN", "EXECUTIVE", "INDUSTRIAL"];
const OPERATIONS_FINANCE: readonly BbosRole[] = [...OPERATIONS, "FINANCE"];
const COMMERCIAL: readonly BbosRole[] = [
  "ADMIN",
  "EXECUTIVE",
  "SALES",
  "FINANCE",
];
const COMMERCIAL_WITHOUT_SALES: readonly BbosRole[] = COMMERCIAL.filter(
  (role) => role !== "SALES",
);
const MARKETPLACE: readonly BbosRole[] = [
  "ADMIN",
  "EXECUTIVE",
  "MARKETPLACE_OPERATOR",
];
const ACCOUNTING_READ: readonly BbosRole[] = [
  "ADMIN",
  "EXECUTIVE",
  "FINANCE",
  "ACCOUNTANT",
];
const ACCOUNTING_WRITE: readonly BbosRole[] = [
  "ADMIN",
  "EXECUTIVE",
  "FINANCE",
];

/**
 * Server-side access matrix. Navigation visibility is only presentation; this
 * policy is the authority and deliberately fails closed for unmapped modules.
 */
export const CONTROLLER_ROLE_POLICY: Readonly<
  Record<string, readonly BbosRole[]>
> = {
  AuthController: AUTHENTICATED,
  NotificationsController: ALL,
  MobileNotificationsController: ALL,
  IntelligenceController: CORE,
  DashboardController: CORE,
  BlendsController: OPERATIONS,
  ReceiptsController: OPERATIONS_FINANCE,
  GreenCoffeePurchasesController: OPERATIONS_FINANCE,
  InventoryController: OPERATIONS_FINANCE,
  ProductionController: OPERATIONS,
  ProductsController: ["ADMIN", "EXECUTIVE", "INDUSTRIAL", "SALES"],
  CostingController: OPERATIONS_FINANCE,
  SalesOrderCatalogOptionsController: CORE,
  SalesOrdersController: CORE,
  SalesOrderApprovalsController: CORE,
  SalesOrderManualPaymentsController: ["ADMIN"],
  FinanceController: ACCOUNTING_WRITE,
  FinanceSalesScheduleController: ACCOUNTING_WRITE,
  FinanceAssistedReconciliationController: ACCOUNTING_WRITE,
  ReconciliationController: ACCOUNTING_WRITE,
  CommerceController: ["ADMIN", "EXECUTIVE"],
  AdminCoffeeReferenceController: LEADERSHIP,
  AdminUsersController: ["ADMIN"],
  IntegrationsController: LEADERSHIP,
  OperationsFlowController: CORE_WITHOUT_SALES,
  OperationsFlowActionsController: OPERATIONS,
  ProductionRequirementsController: OPERATIONS,
  OrderPackagingController: OPERATIONS,
  BrokersController: COMMERCIAL,
  CustomersController: COMMERCIAL,
  CuppingController: OPERATIONS,
  CuppingTrainingController: OPERATIONS,
  ProfessionalSamplesController: OPERATIONS,
  CuppingPublicController: OPERATIONS,
  StorefrontOrdersController: MARKETPLACE,
  StorefrontFulfillmentController: MARKETPLACE,
  StorefrontCouponsController: MARKETPLACE,
  StorefrontPartnersController: ["ADMIN", "EXECUTIVE", "SALES"],
  PartnerPortalController: ["PARTNER"],
  StorefrontOperationsController: LEADERSHIP,
  FiscalInboundController: OPERATIONS_FINANCE,
  MarketplacesController: MARKETPLACE,
  AdminStorefrontMediaController: LEADERSHIP,
};

const HANDLER_ROLE_POLICY: Readonly<
  Record<string, Readonly<Record<string, readonly BbosRole[]>>>
> = {
  DashboardController: {
    home: [...CORE, "ACCOUNTANT"],
    executive: LEADERSHIP,
    industrial: OPERATIONS,
  },
  FinanceController: {
    summary: ACCOUNTING_READ,
    receivables: ACCOUNTING_READ,
    payables: ACCOUNTING_READ,
    accounts: ACCOUNTING_READ,
    institutions: ACCOUNTING_READ,
    createInstitution: ACCOUNTING_WRITE,
    createAccount: ACCOUNTING_WRITE,
    createPayable: ACCOUNTING_WRITE,
    receive: ACCOUNTING_WRITE,
    pay: ACCOUNTING_WRITE,
  },
  FinanceSalesScheduleController: {
    list: ACCOUNTING_READ,
    order: ACCOUNTING_READ,
  },
  FinanceAssistedReconciliationController: {
    candidates: ACCOUNTING_READ,
    settle: ACCOUNTING_WRITE,
  },
  ReconciliationController: {
    summary: ACCOUNTING_READ,
    pending: ACCOUNTING_READ,
    accounts: ACCOUNTING_READ,
    institutions: ACCOUNTING_READ,
    bankTransactions: ACCOUNTING_READ,
    list: ACCOUNTING_READ,
    suggestions: ACCOUNTING_READ,
    create: ACCOUNTING_WRITE,
    importBankTransaction: ACCOUNTING_WRITE,
    importStatement: ACCOUNTING_WRITE,
    match: ACCOUNTING_WRITE,
    autoMatch: ACCOUNTING_WRITE,
    unmatch: ACCOUNTING_WRITE,
    ignore: ACCOUNTING_WRITE,
  },
  FiscalInboundController: {
    list: [...OPERATIONS_FINANCE, "ACCOUNTANT"],
    detail: [...OPERATIONS_FINANCE, "ACCOUNTANT"],
    importXml: OPERATIONS_FINANCE,
    sync: OPERATIONS_FINANCE,
    matchPurchase: OPERATIONS_FINANCE,
    allocateItem: OPERATIONS_FINANCE,
  },
  CostingController: {
    summary: [...OPERATIONS_FINANCE, "ACCOUNTANT"],
    listCostCenters: [...OPERATIONS_FINANCE, "ACCOUNTANT"],
    getCostCenter: [...OPERATIONS_FINANCE, "ACCOUNTANT"],
    listResources: [...OPERATIONS_FINANCE, "ACCOUNTANT"],
    getProductVariantCost: [...OPERATIONS_FINANCE, "ACCOUNTANT"],
    getSkuCost: [...OPERATIONS_FINANCE, "ACCOUNTANT"],
    listEvents: [...OPERATIONS_FINANCE, "ACCOUNTANT"],
    options: [...OPERATIONS_FINANCE, "ACCOUNTANT"],
    listTariffs: [...OPERATIONS_FINANCE, "ACCOUNTANT"],
    listRules: [...OPERATIONS_FINANCE, "ACCOUNTANT"],
    listPeriods: [...OPERATIONS_FINANCE, "ACCOUNTANT"],
    preflight: [...OPERATIONS_FINANCE, "ACCOUNTANT"],
    createCostEvent: OPERATIONS_FINANCE,
    createTariff: OPERATIONS_FINANCE,
    updateResource: OPERATIONS_FINANCE,
    createRule: OPERATIONS_FINANCE,
    createPeriod: OPERATIONS_FINANCE,
    calculate: OPERATIONS_FINANCE,
    close: OPERATIONS_FINANCE,
  },
  OperationsFlowController: {
    stockIn: OPERATIONS,
    stockPolicy: OPERATIONS,
  },
  ProductsController: {
    createProduct: OPERATIONS,
    ncmSuggestion: OPERATIONS,
    createVariant: OPERATIONS,
    updateProduct: OPERATIONS,
    updateVariant: OPERATIONS,
    retryBling: OPERATIONS,
    uploadStorefrontImage: OPERATIONS,
    updateStorefrontImage: OPERATIONS,
    deleteStorefrontImage: OPERATIONS,
    getRules: OPERATIONS,
    getRulesForLine: OPERATIONS,
    validateSku: OPERATIONS,
  },
  SalesOrdersController: {
    list: [...CORE, "ACCOUNTANT"],
    options: [...CORE, "ACCOUNTANT"],
    exportOverview: [...CORE_WITHOUT_SALES, "ACCOUNTANT"],
    fulfillment: [...CORE, "ACCOUNTANT"],
    get: [...CORE, "ACCOUNTANT"],
    pdf: [...CORE, "ACCOUNTANT"],
    billingPdf: [...CORE, "ACCOUNTANT"],
    postingAgencies: CORE_WITHOUT_SALES,
    requoteShipping: CORE_WITHOUT_SALES,
    selectRequoteShipping: CORE_WITHOUT_SALES,
    label: CORE_WITHOUT_SALES,
    prepareReexpedition: LEADERSHIP,
    decideTermApproval: LEADERSHIP,
    decideDiscount: LEADERSHIP,
    reserve: CORE_WITHOUT_SALES,
    cancel: CORE_WITHOUT_SALES,
    ship: CORE_WITHOUT_SALES,
    deliver: CORE,
    picking: CORE_WITHOUT_SALES,
    readyToShip: CORE_WITHOUT_SALES,
    confirmPicking: CORE_WITHOUT_SALES,
    invoice: CORE_WITHOUT_SALES,
  },
  StorefrontPartnersController: {
    create: LEADERSHIP,
    update: LEADERSHIP,
    portalAccess: ["ADMIN"],
    portalAccessStatus: ["ADMIN"],
    portalPermissions: ["ADMIN"],
    getPortalPermissions: ["ADMIN"],
  },
  BrokersController: {
    create: COMMERCIAL_WITHOUT_SALES,
    update: COMMERCIAL_WITHOUT_SALES,
  },
  CustomersController: {
    list: [...COMMERCIAL, "ACCOUNTANT"],
    getHealth: [...COMMERCIAL, "ACCOUNTANT"],
    creditHistory: [...COMMERCIAL, "ACCOUNTANT"],
    salesHistory: [...COMMERCIAL, "ACCOUNTANT"],
    visitHistory: [...COMMERCIAL, "ACCOUNTANT"],
    recentVisits: ["ADMIN", "EXECUTIVE", "SALES"],
    createVisit: ["ADMIN", "EXECUTIVE", "SALES"],
    credit: LEADERSHIP,
  },
};

@Injectable()
export class RoleAccessGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const controller = context.getClass().name;
    const handler = context.getHandler().name;
    const allowed =
      HANDLER_ROLE_POLICY[controller]?.[handler] ??
      CONTROLLER_ROLE_POLICY[controller];
    if (!allowed) {
      throw new ForbiddenException(
        "Política de acesso não definida para este recurso.",
      );
    }

    const request = context
      .switchToHttp()
      .getRequest<{ user?: { role?: string } }>();
    if (
      !request.user?.role ||
      !allowed.includes(request.user.role as BbosRole)
    ) {
      throw new ForbiddenException(
        "Seu perfil não possui acesso a este recurso.",
      );
    }
    return true;
  }
}
