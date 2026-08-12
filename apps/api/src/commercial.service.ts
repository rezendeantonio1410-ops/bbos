import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  type OnModuleDestroy,
} from "@nestjs/common";
import {
  CreditRequestStatus,
  PrismaClient,
  SalesOpportunityStage,
  SalesOrderStatus,
  SalesPersonStatus,
  SalesVisitStatus,
  UserRole,
} from "@bbos/database";
import { LocalDocumentStorageProvider } from "./document-storage";
import { SalesNextActionService } from "./sales-next-action.service";
import {
  commercialPeriod,
  isInactiveCustomer,
  isOrderAttention,
  percentChange,
  prioritizeCommercialAttention,
  representativeStatus,
  weightedPipeline,
} from "@bbos/shared";

@Injectable()
export class CommercialService implements OnModuleDestroy {
  readonly database = new PrismaClient();
  constructor(
    private readonly documentStorage: LocalDocumentStorageProvider,
    private readonly nextActionService: SalesNextActionService,
  ) {}
  onModuleDestroy() {
    return this.database.$disconnect();
  }

  async dashboard(companyId?: string) {
    const now = new Date();
    const period = commercialPeriod(now);
    const [
      people,
      customers,
      orders,
      visits,
      opportunities,
      creditRequests,
    ] = await Promise.all([
      this.database.salesPerson.findMany({
        where: { companyId, status: SalesPersonStatus.ACTIVE },
        include: {
          user: { select: { name: true } },
          portfolioAssignments: { where: { validTo: null } },
          targets: {
            where: {
              period: period.start.toISOString().slice(0, 7),
              targetType: "REVENUE",
            },
          },
        },
      }),
      this.database.customer.findMany({
        where: { companyId },
        include: {
          salesOrders: { orderBy: { orderedAt: "desc" }, take: 1 },
          accountsReceivable: true,
        },
      }),
      this.database.salesOrder.findMany({
        where: {
          companyId,
          orderedAt: { gte: period.previousStart, lte: period.end },
        },
        select: {
          id: true,
          code: true,
          customerId: true,
          salesPersonId: true,
          status: true,
          totalAmount: true,
          orderedAt: true,
          expectedDeliveryDate: true,
        },
      }),
      this.database.salesVisit.findMany({
        where: {
          companyId,
          status: SalesVisitStatus.SCHEDULED,
          scheduledAt: { lte: period.end },
        },
        include: { customer: { select: { name: true } } },
        orderBy: { scheduledAt: "asc" },
      }),
      this.database.salesOpportunity.findMany({
        where: {
          companyId,
          stage: {
            notIn: [SalesOpportunityStage.WON, SalesOpportunityStage.LOST],
          },
        },
        include: { customer: { select: { name: true } } },
      }),
      this.database.creditRequest.findMany({
        where: {
          companyId,
          status: {
            in: [
              CreditRequestStatus.SUBMITTED,
              CreditRequestStatus.UNDER_REVIEW,
              CreditRequestStatus.PENDING_DOCUMENTS,
            ],
          },
        },
      }),
    ]);
    const validOrders = orders.filter(
      (order) =>
        order.status !== SalesOrderStatus.DRAFT &&
        order.status !== SalesOrderStatus.CANCELLED,
    );
    const currentOrders = validOrders.filter(
      (order) => order.orderedAt >= period.start,
    );
    const previousOrders = validOrders.filter(
      (order) => order.orderedAt < period.start,
    );
    const revenue = currentOrders.reduce(
      (sum, order) => sum + Number(order.totalAmount),
      0,
    );
    const previousRevenue = previousOrders.reduce(
      (sum, order) => sum + Number(order.totalAmount),
      0,
    );
    const target = people.reduce(
      (sum, person) =>
        sum + person.targets.reduce((subtotal, item) => subtotal + Number(item.targetValue), 0),
      0,
    );
    const inactiveCustomers = customers.filter(
      (customer) => isInactiveCustomer(customer.salesOrders[0]?.orderedAt ?? null, now),
    );
    const periodOpportunities = opportunities.filter(
      (item) =>
        item.expectedCloseDate != null &&
        item.expectedCloseDate >= period.start &&
        item.expectedCloseDate <= period.end,
    );
    const pipeline = weightedPipeline(
      periodOpportunities.map((item) => ({
        estimatedValue: Number(item.estimatedValue),
        probability: Number(item.probability),
      })),
    );
    const pipelineTotal = periodOpportunities.reduce(
      (sum, item) => sum + Number(item.estimatedValue),
      0,
    );
    const projection = revenue + pipeline;
    const openStatuses: SalesOrderStatus[] = [
      SalesOrderStatus.CONFIRMED,
      SalesOrderStatus.RESERVED,
      SalesOrderStatus.PICKING,
      SalesOrderStatus.READY_TO_SHIP,
      SalesOrderStatus.IN_PRODUCTION,
      SalesOrderStatus.INVOICED,
    ];
    const openOrders = currentOrders.filter((order) =>
      openStatuses.includes(order.status),
    );
    const orderAttention = openOrders.filter(
      (order) => isOrderAttention(order.expectedDeliveryDate, order.status, now),
    );
    const representatives = people.map((person) => {
      const personRevenue = currentOrders
        .filter((order) => order.salesPersonId === person.id)
        .reduce((sum, order) => sum + Number(order.totalAmount), 0);
      const personTarget = person.targets.reduce(
        (sum, item) => sum + Number(item.targetValue),
        0,
      );
      const personOpportunities = periodOpportunities.filter(
        (item) => item.salesPersonId === person.id,
      );
      const personPipeline = weightedPipeline(
        personOpportunities.map((item) => ({
          estimatedValue: Number(item.estimatedValue),
          probability: Number(item.probability),
        })),
      );
      return {
        id: person.id,
        name: person.user.name,
        type: person.type,
        revenue: personRevenue,
        target: personTarget,
        achievement: personTarget ? personRevenue / personTarget : 0,
        pipeline: personPipeline,
        customers: person.portfolioAssignments.length,
        status: representativeStatus({
          revenue: personRevenue,
          target: personTarget,
          weightedPipeline: personPipeline,
          elapsedRatio: period.elapsedRatio,
        }),
      };
    });
    const attention: Array<{
      id: string;
      priority: "CRITICAL" | "HIGH" | "NORMAL" | "OPPORTUNITY";
      category: string;
      title: string;
      description: string;
      href: string;
      cta: string;
    }> = [];
    const criticalPeople = representatives.filter((item) => item.status === "CRITICAL");
    const attentionPeople = representatives.filter((item) => item.status === "ATTENTION");
    if (criticalPeople.length || attentionPeople.length)
      attention.push({
        id: "representative-pace",
        priority: criticalPeople.length ? "CRITICAL" : "HIGH",
        category: "Equipe",
        title: `${criticalPeople.length + attentionPeople.length} representante(s) abaixo do ritmo esperado`,
        description: "Priorize quem tem projeção insuficiente para a meta no momento atual do mês.",
        href: "/comercial/representantes?status=attention",
        cta: "Ver equipe",
      });
    if (inactiveCustomers.length)
      attention.push({
        id: "inactive-customers",
        priority: "HIGH",
        category: "Clientes",
        title: `${inactiveCustomers.length} cliente(s) sem comprar há mais de 60 dias`,
        description: "Carteiras que pedem retomada de relacionamento comercial.",
        href: "/comercial/clientes?status=inactive",
        cta: "Ver clientes",
      });
    if (orderAttention.length)
      attention.push({
        id: "orders-attention",
        priority: "CRITICAL",
        category: "Pedidos",
        title: `${orderAttention.length} pedido(s) precisam de atenção`,
        description: `${orderAttention.reduce((sum, item) => sum + Number(item.totalAmount), 0).toFixed(2)} em pedidos com prazo vencido.`,
        href: "/sales/desktop/pedidos?status=attention",
        cta: "Ver pedidos",
      });
    const staleOpportunities = opportunities.filter(
      (item) => now.getTime() - item.updatedAt.getTime() > 14 * 86400000,
    );
    if (staleOpportunities.length)
      attention.push({
        id: "stale-opportunities",
        priority: "NORMAL",
        category: "Oportunidades",
        title: `${staleOpportunities.length} oportunidade(s) sem ação recente`,
        description: "Oportunidades abertas sem atualização há mais de 14 dias.",
        href: "/comercial/oportunidades?status=stale",
        cta: "Ver pipeline",
      });
    const closingSoon = opportunities.filter((item) => {
      if (!item.expectedCloseDate) return false;
      const days = (item.expectedCloseDate.getTime() - now.getTime()) / 86400000;
      return days >= 0 && days <= 7;
    });
    if (closingSoon.length)
      attention.push({
        id: "closing-soon",
        priority: "OPPORTUNITY",
        category: "Oportunidades",
        title: `${closingSoon.length} oportunidade(s) próximas do fechamento`,
        description: "Fechamento previsto para os próximos sete dias.",
        href: "/comercial/oportunidades?status=closing-soon",
        cta: "Ver pipeline",
      });
    const overdueVisits = visits.filter((item) => item.scheduledAt < now);
    if (overdueVisits.length)
      attention.push({
        id: "overdue-visits",
        priority: "HIGH",
        category: "Visitas",
        title: `${overdueVisits.length} visita(s) atrasada(s)`,
        description: "Compromissos agendados ainda sem conclusão.",
        href: "/comercial/visitas?status=overdue",
        cta: "Ver visitas",
      });
    if (creditRequests.length)
      attention.push({
        id: "pending-credit",
        priority: "HIGH",
        category: "Crédito",
        title: `${creditRequests.length} análise(s) de crédito pendente(s)`,
        description: "Solicitações submetidas, em análise ou aguardando documentos.",
        href: "/comercial/credito?status=pending",
        cta: "Ver crédito",
      });
    return {
      revenue,
      previousRevenue,
      revenueChange: percentChange(revenue, previousRevenue),
      target,
      achievement: target ? revenue / target : 0,
      projection,
      pipeline,
      pipelineTotal,
      elapsedRatio: period.elapsedRatio,
      openOrders: openOrders.length,
      openOrdersValue: openOrders.reduce((sum, item) => sum + Number(item.totalAmount), 0),
      openOrdersAttention: orderAttention.length,
      activeCustomers: customers.length - inactiveCustomers.length,
      newCustomers: customers.filter(
        (customer) => customer.createdAt >= period.start && customer.createdAt <= period.end,
      ).length,
      inactiveCustomers: inactiveCustomers.length,
      averageTicket: currentOrders.length ? revenue / currentOrders.length : 0,
      previousAverageTicket: previousOrders.length ? previousRevenue / previousOrders.length : 0,
      averageTicketChange: percentChange(
        currentOrders.length ? revenue / currentOrders.length : 0,
        previousOrders.length ? previousRevenue / previousOrders.length : 0,
      ),
      representatives,
      attention: prioritizeCommercialAttention(attention),
    };
  }

  async dashboardForUser(userId: string | undefined) {
    const actor = await this.actor(userId);
    if (!actor) throw new ForbiddenException("Sessão autenticada obrigatória.");
    const manager =
      actor.role === UserRole.ADMIN ||
      actor.role === UserRole.EXECUTIVE ||
      actor.salesPerson?.type === "SALES_MANAGER";
    if (!manager)
      throw new ForbiddenException(
        "A visão gerencial do Comercial exige perfil de gestor.",
      );
    return this.dashboard(actor.companyId);
  }

  async representativeDashboard(userId: string | undefined) {
    const actor = await this.actor(userId);
    if (!actor?.salesPerson)
      throw new ForbiddenException("Representante autenticado obrigatório.");
    const salesPersonId = actor.salesPerson.id;
    const [customers, orders, targets, commissions, visits, activities, creditRequests, opportunities, unreadNotifications] =
      await Promise.all([
        this.database.customer.findMany({
          where: {
            companyId: actor.companyId,
            portfolioAssignments: { some: { salesPersonId, validTo: null } },
          },
          include: {
            addresses: { take: 1 },
            salesOrders: { orderBy: { orderedAt: "desc" }, take: 1 },
            accountsReceivable: true,
          },
          orderBy: { name: "asc" },
        }),
        this.database.salesOrder.findMany({
          where: { companyId: actor.companyId, salesPersonId },
          select: {
            id: true,
            orderNumber: true,
            code: true,
            customerId: true,
            customer: { select: { name: true } },
            status: true,
            totalAmount: true,
            orderedAt: true,
            expectedDeliveryDate: true,
            invoicedAt: true,
          },
        }),
        this.database.salesTarget.findMany({
          where: {
            companyId: actor.companyId,
            salesPersonId,
            period: new Date().toISOString().slice(0, 7),
            targetType: "REVENUE",
          },
        }),
        this.database.commissionEntry.findMany({
          where: {
            companyId: actor.companyId,
            salesPersonId,
          },
        }),
        this.database.salesVisit.findMany({
          where: {
            companyId: actor.companyId,
            salesPersonId,
            scheduledAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
          },
          include: { customer: { select: { name: true } } },
          orderBy: { scheduledAt: "asc" },
        }),
        this.database.customerActivity.findMany({
          where: {
            companyId: actor.companyId,
            customer: {
              portfolioAssignments: { some: { salesPersonId, validTo: null } },
            },
          },
          include: { customer: { select: { name: true } } },
          orderBy: { occurredAt: "desc" },
          take: 5,
        }),
        this.database.creditRequest.findMany({
          where: {
            companyId: actor.companyId,
            customer: {
              portfolioAssignments: { some: { salesPersonId, validTo: null } },
            },
            status: { in: ["SUBMITTED", "UNDER_REVIEW", "PENDING_DOCUMENTS", "APPROVED", "PARTIALLY_APPROVED"] },
          },
          include: { customer: { select: { name: true } } },
          orderBy: { updatedAt: "desc" },
        }),
        this.database.salesOpportunity.findMany({
          where: {
            companyId: actor.companyId,
            salesPersonId,
            stage: { notIn: ["WON", "LOST"] },
          },
          include: { customer: { select: { name: true } } },
          orderBy: { updatedAt: "desc" },
        }),
        this.database.commercialNotification.count({
          where: { companyId: actor.companyId, userId: actor.id, readAt: null },
        }),
      ]);
    const attention = customers
      .map((customer) => {
        const lastOrder = customer.salesOrders[0];
        const overdue = customer.accountsReceivable.some(
          (item) =>
            item.status === "OVERDUE" ||
            (item.dueDate < new Date() && Number(item.openAmount) > 0),
        );
        const days = lastOrder
          ? Math.floor((Date.now() - lastOrder.orderedAt.getTime()) / 86400000)
          : null;
        const reason = overdue
          ? "Pagamento vencido"
          : days == null
            ? "Ainda não realizou compras"
            : days >= 60
              ? `${days} dias sem comprar`
              : null;
        return reason
          ? {
              id: customer.id,
              name: customer.name,
              city: customer.addresses[0]?.city ?? "Cidade não informada",
              lastPurchase: lastOrder?.orderedAt ?? null,
              financialStatus: overdue ? "ATENÇÃO" : "INFORMATIVO",
              reason,
              nextAction: overdue ? "Ver financeiro" : "Entrar em contato",
            }
          : null;
      })
      .filter(Boolean);
    const revenue = orders
      .filter((o) => o.status !== "DRAFT" && o.status !== "CANCELLED")
      .reduce((sum, o) => sum + Number(o.totalAmount), 0);
    const target = targets.reduce(
      (sum, item) => sum + Number(item.targetValue),
      0,
    );
    const recentOrders = orders
      .slice(0, 5)
      .map((o) => ({ ...o, totalAmount: Number(o.totalAmount) }));
    return {
      user: { id: actor.id, name: actor.name, role: actor.role },
      territory: actor.salesPerson.territory,
      region: actor.salesPerson.region,
      customerCount: customers.length,
      revenue,
      target,
      achievement: target ? revenue / target : 0,
      commissionEstimated: commissions
        .filter((item) => item.status === "ESTIMATED" || item.status === "ACCRUED")
        .reduce(
        (sum, item) => sum + Number(item.commissionAmount),
        0,
        ),
      commissionReleased: commissions
        .filter((item) => item.status === "RELEASED" || item.status === "PAID")
        .reduce((sum, item) => sum + Number(item.commissionAmount), 0),
      openOrders: orders.filter(
        (o) => !["CANCELLED", "DELIVERED", "SHIPPED"].includes(o.status),
      ).length,
      inactiveCustomers: attention.filter(
        (item) => item && item.reason.includes("sem comprar"),
      ).length,
      attention,
      customers: customers.map((c) => ({
        id: c.id,
        name: c.name,
        city: c.addresses[0]?.city ?? "Cidade não informada",
        lastPurchase: c.salesOrders[0]?.orderedAt ?? null,
      })),
      visits,
      recentOrders,
      activities,
      nextActions: this.nextActionService.build({
        customers: customers.map((customer) => ({
          id: customer.id,
          name: customer.name,
          city: customer.addresses[0]?.city,
          lastPurchase: customer.salesOrders[0]?.orderedAt,
          accountsReceivable: customer.accountsReceivable,
        })),
        orders,
        visits,
        opportunities,
        creditRequests,
        commissions,
        unreadNotificationCount: unreadNotifications,
      }),
      canAccessManager:
        actor.role === UserRole.ADMIN ||
        actor.role === UserRole.EXECUTIVE ||
        actor.salesPerson.type === "SALES_MANAGER",
    };
  }

  async representativeStock(userId: string | undefined) {
    const actor = await this.actor(userId);
    if (!actor?.salesPerson)
      throw new ForbiddenException("Representante autenticado obrigatório.");
    const rows = await this.database.finishedProduct.findMany({
      include: { productVariant: { include: { product: true } } },
      orderBy: { name: "asc" },
    });
    return rows.map((row) => {
      const available = Math.max(0, row.quantityOnHand - row.reservedQuantity);
      return {
        productVariantId: row.productVariantId,
        product: row.productVariant?.product.name ?? row.name,
        sku: row.productVariant?.sku ?? row.sku,
        presentation: row.productVariant?.netWeightGrams
          ? `${row.productVariant.netWeightGrams} g`
          : `${row.packageWeightG} g`,
        available,
        reserved: row.reservedQuantity,
        status:
          available <= 0
            ? "OUT_OF_STOCK"
            : available <= 10
              ? "LOW_STOCK"
              : "AVAILABLE",
      };
    });
  }

  async representativeReports(userId: string | undefined) {
    const actor = await this.actor(userId);
    if (!actor?.salesPerson)
      throw new ForbiddenException("Representante autenticado obrigatório.");
    const orders = await this.database.salesOrder.findMany({
      where: {
        companyId: actor.companyId,
        salesPersonId: actor.salesPerson.id,
      },
      include: {
        customer: true,
        items: { include: { productVariant: { include: { product: true } } } },
      },
      orderBy: { orderedAt: "desc" },
    });
    const valid = orders.filter((o) => o.status !== "CANCELLED");
    const revenue = valid.reduce((sum, o) => sum + Number(o.totalAmount), 0);
    const productMap = new Map<
      string,
      { product: string; sku: string; units: number; revenue: number }
    >();
    for (const order of valid)
      for (const item of order.items) {
        const key = item.productVariantId;
        const current = productMap.get(key) ?? {
          product: item.productVariant.product.name,
          sku: item.productVariant.sku,
          units: 0,
          revenue: 0,
        };
        current.units += item.quantity;
        current.revenue += Number(item.totalAmount);
        productMap.set(key, current);
      }
    return {
      revenue,
      orders: valid.length,
      averageTicket: valid.length ? revenue / valid.length : 0,
      customers: new Set(valid.map((o) => o.customerId)).size,
      products: [...productMap.values()].sort((a, b) => b.revenue - a.revenue),
      recentOrders: valid.slice(0, 20).map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        customer: o.customer.name,
        total: Number(o.totalAmount),
        status: o.status,
        orderedAt: o.orderedAt,
      })),
    };
  }

  private async representativeActor(userId?: string) {
    const actor = await this.actor(userId);
    if (!actor?.salesPerson)
      throw new ForbiddenException("Representante autenticado obrigatório.");
    return actor;
  }
  async representativeOrders(
    userId: string | undefined,
    status?: SalesOrderStatus,
  ) {
    const actor = await this.representativeActor(userId);
    return this.database.salesOrder.findMany({
      where: {
        companyId: actor.companyId,
        ...(status ? { status } : {}),
        OR: [
          { salesPersonId: actor.salesPerson!.id },
          {
            customer: {
              portfolioAssignments: {
                some: { salesPersonId: actor.salesPerson!.id, validTo: null },
              },
            },
          },
        ],
      },
      include: {
        customer: true,
        items: { include: { productVariant: { include: { product: true } } } },
        accountsReceivable: true,
        finishedGoodsMovements: true,
      },
      orderBy: { updatedAt: "desc" },
    });
  }
  async representativeOrder(id: string, userId: string | undefined) {
    const orders = await this.representativeOrders(userId);
    const order = orders.find((item) => item.id === id);
    if (!order)
      throw new ForbiddenException("Pedido fora da carteira autorizada.");
    return order;
  }

  listPeople(companyId?: string) {
    return this.database.salesPerson.findMany({
      where: { companyId },
      include: {
        user: { select: { name: true, email: true } },
        portfolioAssignments: {
          where: { validTo: null },
          include: { customer: true },
        },
        targets: true,
        commissionEntries: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }
  getPerson(id: string) {
    return this.database.salesPerson.findUnique({
      where: { id },
      include: {
        user: { select: { name: true, email: true } },
        portfolioAssignments: {
          where: { validTo: null },
          include: { customer: true },
        },
        targets: true,
        commissionEntries: {
          include: { salesOrder: { include: { customer: true } } },
        },
        visits: {
          include: { customer: true },
          orderBy: { scheduledAt: "desc" },
        },
        opportunities: {
          include: { customer: true },
          orderBy: { updatedAt: "desc" },
        },
      },
    });
  }
  listCustomers(companyId?: string, salesPersonId?: string | string[]) {
    const scope = Array.isArray(salesPersonId)
      ? { in: salesPersonId }
      : salesPersonId;
    return this.database.customer.findMany({
      where: {
        companyId,
        ...(scope
          ? {
              portfolioAssignments: {
                some: { salesPersonId: scope, validTo: null },
              },
            }
          : {}),
      },
      include: {
        portfolioAssignments: {
          where: { validTo: null },
          include: {
            salesPerson: { include: { user: { select: { name: true } } } },
          },
        },
        salesOrders: { orderBy: { orderedAt: "desc" }, take: 5 },
      },
      orderBy: { name: "asc" },
    });
  }
  async listCustomersForUser(userId: string | undefined, companyId?: string) {
    const actor = await this.actor(userId);
    if (!actor) throw new ForbiddenException("Sessão autenticada obrigatória.");
    const scopeCompany = companyId ?? actor.companyId;
    if (scopeCompany !== actor.companyId)
      throw new ForbiddenException("Empresa não autorizada.");
    if (actor.role === UserRole.SALES && !actor.salesPerson)
      throw new ForbiddenException(
        "Usuário comercial sem representante vinculado.",
      );
    if (actor.salesPerson?.type === "SALES_MANAGER") {
      const ids = [
        actor.salesPerson.id,
        ...actor.salesPerson.team.map((p) => p.id),
      ];
      return this.listCustomers(scopeCompany, ids);
    }
    return this.listCustomers(scopeCompany, actor.salesPerson?.id);
  }
  getCustomer(id: string) {
    return this.database.customer.findUnique({
      where: { id },
      include: {
        portfolioAssignments: {
          where: { validTo: null },
          include: {
            salesPerson: { include: { user: { select: { name: true } } } },
          },
        },
        salesOrders: {
          orderBy: { orderedAt: "desc" },
          include: {
            items: {
              include: { productVariant: { include: { product: true } } },
            },
          },
        },
        salesVisits: {
          orderBy: { scheduledAt: "desc" },
          include: {
            salesPerson: { include: { user: { select: { name: true } } } },
          },
        },
        opportunities: {
          orderBy: { updatedAt: "desc" },
          include: {
            salesPerson: { include: { user: { select: { name: true } } } },
          },
        },
      },
    });
  }
  getCustomer360(id: string) {
    return this.database.customer.findUnique({
      where: { id },
      include: {
        portfolioAssignments: {
          where: { validTo: null },
          include: {
            salesPerson: { include: { user: { select: { name: true } } } },
          },
        },
        contacts: true,
        documents: { orderBy: { createdAt: "desc" } },
        creditRequests: { orderBy: { createdAt: "desc" } },
        activities: { orderBy: { occurredAt: "desc" }, take: 50 },
        salesOrders: {
          orderBy: { orderedAt: "desc" },
          include: {
            items: {
              include: { productVariant: { include: { product: true } } },
            },
          },
        },
        accountsReceivable: {
          orderBy: { dueDate: "desc" },
          include: { payments: true },
        },
        salesVisits: {
          orderBy: { scheduledAt: "desc" },
          include: {
            salesPerson: { include: { user: { select: { name: true } } } },
          },
        },
        opportunities: {
          orderBy: { updatedAt: "desc" },
          include: {
            salesPerson: { include: { user: { select: { name: true } } } },
          },
        },
      },
    });
  }
  async getCustomer360ForUser(id: string, userId?: string) {
    await this.assertCustomerAccess(userId, id);
    return this.getCustomer360(id);
  }
  async createCustomer(input: {
    companyId: string;
    name: string;
    taxId?: string;
    segment?: string;
    salesPersonId?: string;
    contacts?: Array<{
      name: string;
      role: string;
      phone?: string;
      whatsapp?: string;
      email?: string;
    }>;
  }) {
    if (!input.name || !input.companyId)
      throw new BadRequestException("Empresa e nome são obrigatórios.");
    const customer = await this.database.customer.create({
      data: {
        companyId: input.companyId,
        name: input.name,
        taxId: input.taxId,
        segment: input.segment,
        contacts: input.contacts?.length
          ? {
              create: input.contacts.map((contact) => ({
                ...contact,
                companyId: input.companyId,
              })),
            }
          : undefined,
      },
    });
    if (input.salesPersonId)
      await this.database.customerPortfolioAssignment.create({
        data: {
          companyId: input.companyId,
          customerId: customer.id,
          salesPersonId: input.salesPersonId,
          isPrimary: true,
        },
      });
    return this.getCustomer360(customer.id);
  }
  async createDocument(input: {
    companyId: string;
    customerId: string;
    uploadedById: string;
    name: string;
    type: string;
    storageKey: string;
    mimeType?: string;
    sizeBytes?: number;
  }) {
    if (
      !input.storageKey ||
      (input.sizeBytes != null && input.sizeBytes > 15 * 1024 * 1024)
    )
      throw new BadRequestException("Arquivo inválido ou maior que 15 MB.");
    return this.database.customerDocument.create({ data: input });
  }
  private async actor(userId?: string) {
    if (!userId) return null;
    return this.database.user.findUnique({
      where: { id: userId },
      include: { salesPerson: { include: { team: true } } },
    });
  }
  async assertCustomerAccess(userId: string | undefined, customerId: string) {
    if (!userId)
      throw new ForbiddenException("Sessão autenticada obrigatória.");
    const customer = await this.database.customer.findUnique({
      where: { id: customerId },
    });
    if (!customer) throw new BadRequestException("Cliente não encontrado.");
    const actor = await this.actor(userId);
    if (!actor || actor.companyId !== customer.companyId)
      throw new ForbiddenException("Acesso não autorizado.");
    if (actor.role === UserRole.SALES) {
      if (
        !actor.salesPerson ||
        !(await this.database.customerPortfolioAssignment.findFirst({
          where: {
            customerId,
            salesPersonId: actor.salesPerson.id,
            validTo: null,
          },
        }))
      )
        throw new ForbiddenException("Cliente fora da carteira autorizada.");
    }
    if (actor.salesPerson?.type === "SALES_MANAGER") {
      const teamIds = [
        actor.salesPerson.id,
        ...actor.salesPerson.team.map((p) => p.id),
      ];
      const assignment =
        await this.database.customerPortfolioAssignment.findFirst({
          where: { customerId, salesPersonId: { in: teamIds }, validTo: null },
        });
      if (!assignment)
        throw new ForbiddenException("Cliente fora do escopo da equipe.");
    }
    return { customer, actor };
  }
  async uploadDocument(input: {
    userId?: string;
    customerId: string;
    fileName: string;
    mimeType: string;
    buffer: Buffer;
    type: string;
  }) {
    const { customer, actor } = await this.assertCustomerAccess(
      input.userId,
      input.customerId,
    );
    if (!actor)
      throw new BadRequestException("Sessão do usuário é obrigatória.");
    const allowed = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
    ];
    if (!allowed.includes(input.mimeType))
      throw new BadRequestException("Tipo de arquivo não permitido.");
    const stored = await this.documentStorage.upload({
      customerId: customer.id,
      fileName: input.fileName,
      mimeType: input.mimeType,
      buffer: input.buffer,
    });
    const previous = await this.database.customerDocument.findFirst({
      where: { customerId: customer.id, type: input.type },
      orderBy: { version: "desc" },
    });
    const document = await this.database.customerDocument.create({
      data: {
        companyId: customer.companyId,
        customerId: customer.id,
        uploadedById: actor.id,
        name: input.fileName,
        type: input.type,
        storageKey: stored.storageKey,
        mimeType: stored.mimeType,
        sizeBytes: stored.sizeBytes,
        version: (previous?.version ?? 0) + 1,
      },
    });
    await this.database.customerActivity.create({
      data: {
        companyId: customer.companyId,
        customerId: customer.id,
        actorId: actor.id,
        type: "DOCUMENT_UPLOADED",
        title: `Documento enviado: ${input.fileName}`,
        metadata: { documentId: document.id, type: input.type },
      },
    });
    return document;
  }
  async downloadDocument(input: {
    userId?: string;
    customerId: string;
    documentId: string;
  }) {
    const { customer } = await this.assertCustomerAccess(
      input.userId,
      input.customerId,
    );
    const document = await this.database.customerDocument.findFirst({
      where: {
        id: input.documentId,
        customerId: customer.id,
        companyId: customer.companyId,
      },
    });
    if (!document)
      throw new BadRequestException(
        "Documento não encontrado ou não autorizado.",
      );
    return {
      document,
      buffer: await this.documentStorage.get(document.storageKey),
    };
  }
  async createCreditRequest(input: {
    companyId: string;
    customerId: string;
    requestedById: string;
    requestedLimit: number;
    requestedTermDays: number;
    expectedMonthlyBuy?: number;
    paymentMethod?: string;
    commercialReferences?: string;
    justification?: string;
  }) {
    const person = await this.database.salesPerson.findFirst({
      where: {
        id: input.requestedById,
        companyId: input.companyId,
        status: SalesPersonStatus.ACTIVE,
      },
    });
    if (!person) throw new BadRequestException("Representante não autorizado.");
    return this.database.creditRequest.create({
      data: {
        ...input,
        status: CreditRequestStatus.SUBMITTED,
        submittedAt: new Date(),
      },
    });
  }
  async createCreditRequestForUser(
    input: Omit<
      Parameters<CommercialService["createCreditRequest"]>[0],
      "requestedById"
    > & { userId: string },
  ) {
    const actor = await this.actor(input.userId);
    if (!actor?.salesPerson)
      throw new BadRequestException(
        "Somente representante pode solicitar crédito.",
      );
    const result = await this.createCreditRequest({
      ...input,
      requestedById: actor.salesPerson.id,
    });
    await this.database.commercialNotification.create({
      data: {
        companyId: result.companyId,
        userId: actor.id,
        type: "CREDIT_SUBMITTED",
        title: "Solicitação de crédito enviada",
        message: "Sua solicitação foi encaminhada para análise.",
        entityType: "CreditRequest",
        entityId: result.id,
      },
    });
    await this.database.customerActivity.create({
      data: {
        companyId: result.companyId,
        customerId: result.customerId,
        actorId: actor.id,
        type: "CREDIT_REQUESTED",
        title: "Solicitação de crédito enviada",
        metadata: { creditRequestId: result.id },
      },
    });
    return result;
  }
  async reviewCreditRequest(
    id: string,
    input: {
      reviewerId: string;
      status: CreditRequestStatus;
      approvedLimit?: number;
      approvedTermDays?: number;
      reviewNote?: string;
      decisionReason?: string;
      internalNotes?: string;
    },
  ) {
    const reviewer = await this.database.user.findUnique({
      where: { id: input.reviewerId },
    });
    if (
      !reviewer ||
      !(
        [UserRole.ADMIN, UserRole.EXECUTIVE, UserRole.FINANCE] as string[]
      ).includes(reviewer.role)
    )
      throw new ForbiddenException(
        "Somente Financeiro, Executivo ou Administrador pode aprovar crédito.",
      );
    const current = await this.database.creditRequest.findUnique({
      where: { id },
      include: { customer: true, requestedBy: { include: { user: true } } },
    });
    if (!current) throw new BadRequestException("Solicitação não encontrada.");
    const allowed: Record<string, string[]> = {
      DRAFT: ["SUBMITTED", "CANCELLED"],
      SUBMITTED: ["UNDER_REVIEW", "CANCELLED"],
      UNDER_REVIEW: [
        "PENDING_DOCUMENTS",
        "APPROVED",
        "PARTIALLY_APPROVED",
        "REJECTED",
        "CANCELLED",
      ],
      PENDING_DOCUMENTS: ["UNDER_REVIEW", "CANCELLED"],
    };
    if (!(allowed[current.status] ?? []).includes(input.status))
      throw new BadRequestException(
        `Transição inválida: ${current.status} -> ${input.status}.`,
      );
    const request = await this.database.creditRequest.update({
      where: { id },
      data: {
        status: input.status,
        approvedLimit: input.approvedLimit,
        approvedTermDays: input.approvedTermDays,
        reviewNote: input.reviewNote,
        decisionReason: input.decisionReason,
        internalNotes: input.internalNotes,
        analystUserId: reviewer.id,
        reviewedById: reviewer.id,
        reviewedAt: new Date(),
      },
      include: { customer: true, requestedBy: { include: { user: true } } },
    });
    const type =
      input.status === CreditRequestStatus.APPROVED
        ? "CREDIT_APPROVED"
        : input.status === CreditRequestStatus.PARTIALLY_APPROVED
          ? "CREDIT_PARTIALLY_APPROVED"
          : input.status === CreditRequestStatus.REJECTED
            ? "CREDIT_REJECTED"
            : input.status === CreditRequestStatus.PENDING_DOCUMENTS
              ? "CREDIT_DOCUMENT_REQUESTED"
              : "CREDIT_UNDER_REVIEW";
    await this.database.commercialNotification.create({
      data: {
        companyId: request.companyId,
        userId: request.requestedBy.userId,
        type: type as never,
        title:
          input.status === CreditRequestStatus.APPROVED
            ? "Crédito aprovado"
            : "Atualização da análise de crédito",
        message: `${request.customer.name}: status ${input.status}.`,
        entityType: "CreditRequest",
        entityId: request.id,
      },
    });
    await this.database.customerActivity.create({
      data: {
        companyId: request.companyId,
        customerId: request.customerId,
        actorId: reviewer.id,
        type: `CREDIT_${input.status}`,
        title: `Crédito atualizado: ${input.status}`,
        metadata: { creditRequestId: request.id },
      },
    });
    return request;
  }
  listCreditRequests(companyId?: string, status?: CreditRequestStatus) {
    return this.database.creditRequest.findMany({
      where: { companyId, ...(status ? { status } : {}) },
      include: {
        customer: true,
        requestedBy: { include: { user: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });
  }
  async submitCreditDocumentRequest(
    id: string,
    reviewerId: string,
    note: string,
  ) {
    const request = await this.database.creditRequest.findUnique({
      where: { id },
      include: { requestedBy: true, customer: true },
    });
    if (!request) throw new BadRequestException("Solicitação não encontrada.");
    const reviewer = await this.database.user.findUnique({
      where: { id: reviewerId },
    });
    if (
      !reviewer ||
      !(
        [UserRole.ADMIN, UserRole.EXECUTIVE, UserRole.FINANCE] as string[]
      ).includes(reviewer.role)
    )
      throw new BadRequestException("Perfil não autorizado.");
    const updated = await this.database.creditRequest.update({
      where: { id },
      data: {
        status: CreditRequestStatus.PENDING_DOCUMENTS,
        reviewNote: note,
        analystUserId: reviewerId,
      },
    });
    await this.database.commercialNotification.create({
      data: {
        companyId: request.companyId,
        userId: request.requestedBy.userId,
        type: "CREDIT_DOCUMENT_REQUESTED",
        title: "Documentação de crédito pendente",
        message: note,
        entityType: "CreditRequest",
        entityId: id,
      },
    });
    return updated;
  }
  listCustomerActivities(customerId: string) {
    return this.database.customerActivity.findMany({
      where: { customerId },
      orderBy: { occurredAt: "desc" },
      take: 100,
    });
  }
  createCustomerActivity(input: {
    companyId: string;
    customerId: string;
    actorId?: string;
    type: string;
    title: string;
    description?: string;
    metadata?: object;
  }) {
    return this.database.customerActivity.create({ data: input });
  }
  listTargets(companyId?: string, salesPersonId?: string) {
    return this.database.salesTarget.findMany({
      where: { companyId, ...(salesPersonId ? { salesPersonId } : {}) },
      include: {
        salesPerson: { include: { user: { select: { name: true } } } },
      },
      orderBy: { period: "desc" },
    });
  }
  listCommissions(companyId?: string, salesPersonId?: string) {
    return this.database.commissionEntry.findMany({
      where: { companyId, ...(salesPersonId ? { salesPersonId } : {}) },
      include: {
        salesPerson: { include: { user: { select: { name: true } } } },
        salesOrder: { include: { customer: true } },
      },
      orderBy: { calculatedAt: "desc" },
    });
  }
  listVisits(companyId?: string, salesPersonId?: string) {
    return this.database.salesVisit.findMany({
      where: { companyId, ...(salesPersonId ? { salesPersonId } : {}) },
      include: {
        customer: true,
        salesPerson: { include: { user: { select: { name: true } } } },
      },
      orderBy: { scheduledAt: "asc" },
    });
  }
  listOpportunities(companyId?: string, salesPersonId?: string) {
    return this.database.salesOpportunity.findMany({
      where: { companyId, ...(salesPersonId ? { salesPersonId } : {}) },
      include: {
        customer: true,
        salesPerson: { include: { user: { select: { name: true } } } },
      },
      orderBy: { updatedAt: "desc" },
    });
  }
  async createVisit(input: any) {
    if (
      !input.companyId ||
      !input.salesPersonId ||
      !input.customerId ||
      !input.scheduledAt
    )
      throw new BadRequestException(
        "Cliente, representante e data são obrigatórios.",
      );
    return this.database.salesVisit.create({
      data: {
        ...input,
        status: input.status ?? SalesVisitStatus.SCHEDULED,
        scheduledAt: new Date(input.scheduledAt),
      },
    });
  }
  async createOpportunity(input: any) {
    if (
      !input.companyId ||
      !input.salesPersonId ||
      !input.customerId ||
      !input.title
    )
      throw new BadRequestException(
        "Cliente, representante e título são obrigatórios.",
      );
    return this.database.salesOpportunity.create({
      data: {
        ...input,
        stage: input.stage ?? SalesOpportunityStage.PROSPECT,
        estimatedValue: input.estimatedValue ?? 0,
        estimatedVolume: input.estimatedVolume ?? 0,
        probability: input.probability ?? 0,
      },
    });
  }
}
