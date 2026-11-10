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
  | "SALES"
  | "MARKETPLACE_OPERATOR"
  | "PARTNER";

const ALL: readonly BbosRole[] = [
  "ADMIN",
  "EXECUTIVE",
  "INDUSTRIAL",
  "FINANCE",
  "SALES",
  "MARKETPLACE_OPERATOR",
];
const AUTHENTICATED: readonly BbosRole[] = [...ALL, "PARTNER"];
const CORE: readonly BbosRole[] = ALL.filter(
  (role) => role !== "MARKETPLACE_OPERATOR",
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
  FinanceController: ["ADMIN", "EXECUTIVE", "FINANCE"],
  FinanceSalesScheduleController: ["ADMIN", "EXECUTIVE", "FINANCE"],
  FinanceAssistedReconciliationController: ["ADMIN", "EXECUTIVE", "FINANCE"],
  ReconciliationController: ["ADMIN", "EXECUTIVE", "FINANCE"],
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
    executive: LEADERSHIP,
    industrial: OPERATIONS,
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
    exportOverview: CORE_WITHOUT_SALES,
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
