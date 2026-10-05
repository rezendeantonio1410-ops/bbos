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
const LEADERSHIP: readonly BbosRole[] = ["ADMIN", "EXECUTIVE"];
const OPERATIONS: readonly BbosRole[] = ["ADMIN", "EXECUTIVE", "INDUSTRIAL"];
const OPERATIONS_FINANCE: readonly BbosRole[] = [...OPERATIONS, "FINANCE"];
const COMMERCIAL: readonly BbosRole[] = [
  "ADMIN",
  "EXECUTIVE",
  "SALES",
  "FINANCE",
];
const MARKETPLACE: readonly BbosRole[] = [
  "ADMIN",
  "EXECUTIVE",
  "SALES",
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
  FinanceController: ["ADMIN", "EXECUTIVE", "FINANCE"],
  FinanceSalesScheduleController: ["ADMIN", "EXECUTIVE", "FINANCE"],
  FinanceAssistedReconciliationController: ["ADMIN", "EXECUTIVE", "FINANCE"],
  ReconciliationController: ["ADMIN", "EXECUTIVE", "FINANCE"],
  CommerceController: ["ADMIN", "EXECUTIVE", "SALES"],
  AdminCoffeeReferenceController: LEADERSHIP,
  AdminUsersController: ["ADMIN"],
  IntegrationsController: LEADERSHIP,
  OperationsFlowController: CORE,
  OperationsFlowActionsController: OPERATIONS,
  ProductionRequirementsController: OPERATIONS,
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
  AdminStorefrontMediaController: ["ADMIN", "EXECUTIVE", "SALES"],
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
  StorefrontPartnersController: {
    portalAccess: ["ADMIN"],
    portalAccessStatus: ["ADMIN"],
    portalPermissions: ["ADMIN"],
    getPortalPermissions: ["ADMIN"],
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
