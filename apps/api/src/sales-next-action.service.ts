import { Injectable } from "@nestjs/common";

export type NextActionPriority = "URGENT" | "HIGH" | "NORMAL" | "INFORMATIVE";

export type SalesNextAction = {
  id: string;
  type: string;
  priority: NextActionPriority;
  title: string;
  description: string;
  customerId?: string;
  orderId?: string;
  creditRequestId?: string;
  entityType: string;
  entityId: string;
  ctaLabel: string;
  ctaHref: string;
  dueAt?: string;
  createdAt: string;
  resolved: boolean;
};

type CustomerInput = {
  id: string;
  name: string;
  city?: string | null;
  lastPurchase?: Date | string | null;
  accountsReceivable?: Array<{
    status: string;
    dueDate: Date | string;
    openAmount: unknown;
  }>;
};

type OrderInput = {
  id: string;
  orderNumber?: string | null;
  code: string;
  status: string;
  customerId: string;
  customer?: { name: string } | null;
  totalAmount: unknown;
  expectedDeliveryDate?: Date | string | null;
  invoicedAt?: Date | string | null;
};

type VisitInput = {
  id: string;
  customerId: string;
  customer?: { name: string } | null;
  scheduledAt: Date | string;
  status: string;
};

type OpportunityInput = {
  id: string;
  customerId: string;
  customer?: { name: string } | null;
  title: string;
  expectedCloseDate?: Date | string | null;
};

type CreditInput = {
  id: string;
  customerId: string;
  customer?: { name: string } | null;
  status: string;
  approvedLimit?: unknown;
  requestedLimit: unknown;
  updatedAt: Date | string;
};

type CommissionInput = {
  id: string;
  status: string;
  commissionAmount: unknown;
};

const DAY = 86_400_000;
const priorityOrder: Record<NextActionPriority, number> = {
  URGENT: 0,
  HIGH: 1,
  NORMAL: 2,
  INFORMATIVE: 3,
};

const iso = (value: Date | string) => new Date(value).toISOString();
const daysSince = (value: Date | string) =>
  Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / DAY));
const action = (input: Omit<SalesNextAction, "createdAt" | "resolved">) => ({
  ...input,
  createdAt: new Date().toISOString(),
  resolved: false,
});

@Injectable()
export class SalesNextActionService {
  build(input: {
    customers: CustomerInput[];
    orders: OrderInput[];
    visits: VisitInput[];
    opportunities: OpportunityInput[];
    creditRequests: CreditInput[];
    commissions: CommissionInput[];
    unreadNotificationCount?: number;
  }): SalesNextAction[] {
    const result: SalesNextAction[] = [];

    for (const customer of input.customers) {
      const overdue = (customer.accountsReceivable ?? []).find(
        (item) =>
          Number(item.openAmount) > 0 &&
          (item.status === "OVERDUE" || new Date(item.dueDate) < new Date()),
      );
      if (overdue) {
        result.push(
          action({
            id: `receivable:${customer.id}`,
            type: "OVERDUE_RECEIVABLE",
            priority: "URGENT",
            title: `${customer.name} possui título vencido`,
            description: "Regularizar a situação financeira antes de uma nova venda.",
            customerId: customer.id,
            entityType: "CUSTOMER",
            entityId: customer.id,
            ctaLabel: "Ver cliente",
            ctaHref: `/sales/desktop/clientes/${customer.id}`,
            dueAt: iso(overdue.dueDate),
          }),
        );
        continue;
      }

      if (customer.lastPurchase) {
        const days = daysSince(customer.lastPurchase);
        if (days >= 60) {
          result.push(
            action({
              id: `reorder:${customer.id}`,
              type: "CUSTOMER_REORDER",
              priority: "HIGH",
              title: `${customer.name} está há ${days} dias sem comprar`,
              description: "Retomar o relacionamento e avaliar uma nova necessidade.",
              customerId: customer.id,
              entityType: "CUSTOMER",
              entityId: customer.id,
              ctaLabel: "Entrar em contato",
              ctaHref: `/sales/desktop/clientes/${customer.id}`,
            }),
          );
        }
      } else {
        result.push(
          action({
            id: `first-contact:${customer.id}`,
            type: "FIRST_CONTACT",
            priority: "NORMAL",
            title: `${customer.name} ainda não realizou compras`,
            description: "Faça o primeiro contato comercial com este cliente.",
            customerId: customer.id,
            entityType: "CUSTOMER",
            entityId: customer.id,
            ctaLabel: "Entrar em contato",
            ctaHref: `/sales/desktop/clientes/${customer.id}`,
          }),
        );
      }
    }

    for (const visit of input.visits) {
      const isLate = visit.status === "SCHEDULED" && new Date(visit.scheduledAt) < new Date();
      result.push(
        action({
          id: `visit:${visit.id}`,
          type: isLate ? "OVERDUE_VISIT" : "TODAY_VISIT",
          priority: isLate ? "HIGH" : "NORMAL",
          title: isLate ? "Visita vencida" : "Visita agendada para hoje",
          description: visit.customer?.name ?? "Abrir compromisso comercial.",
          customerId: visit.customerId,
          entityType: "VISIT",
          entityId: visit.id,
          ctaLabel: isLate ? "Registrar visita" : "Abrir cliente",
          ctaHref: `/sales/desktop/clientes/${visit.customerId}`,
          dueAt: iso(visit.scheduledAt),
        }),
      );
    }

    for (const credit of input.creditRequests) {
      const pendingDocuments = credit.status === "PENDING_DOCUMENTS";
      const approved = credit.status === "APPROVED" || credit.status === "PARTIALLY_APPROVED";
      if (!["SUBMITTED", "UNDER_REVIEW", "PENDING_DOCUMENTS", "APPROVED", "PARTIALLY_APPROVED"].includes(credit.status)) continue;
      result.push(
        action({
          id: `credit:${credit.id}`,
          type: pendingDocuments ? "CREDIT_DOCUMENTS" : approved ? "CREDIT_APPROVED" : "CREDIT_REVIEW",
          priority: pendingDocuments ? "URGENT" : approved ? "INFORMATIVE" : "HIGH",
          title: pendingDocuments ? "Crédito aguardando documentos" : approved ? "Crédito aprovado" : "Crédito em análise",
          description: credit.customer?.name ?? "Acompanhar solicitação de crédito.",
          customerId: credit.customerId,
          creditRequestId: credit.id,
          entityType: "CREDIT_REQUEST",
          entityId: credit.id,
          ctaLabel: pendingDocuments ? "Enviar documento" : approved ? "Criar pedido" : "Resolver pendência",
          ctaHref: `/sales/desktop/clientes/${credit.customerId}`,
          dueAt: iso(credit.updatedAt),
        }),
      );
    }

    for (const opportunity of input.opportunities) {
      if (opportunity.expectedCloseDate && new Date(opportunity.expectedCloseDate) < new Date()) {
        result.push(
          action({
            id: `opportunity:${opportunity.id}`,
            type: "OVERDUE_FOLLOW_UP",
            priority: "HIGH",
            title: "Follow-up de oportunidade vencido",
            description: opportunity.title,
            customerId: opportunity.customerId,
            entityType: "OPPORTUNITY",
            entityId: opportunity.id,
            ctaLabel: "Registrar follow-up",
            ctaHref: `/sales/desktop/clientes/${opportunity.customerId}`,
            dueAt: iso(opportunity.expectedCloseDate),
          }),
        );
      }
    }

    for (const order of input.orders) {
      const label = order.orderNumber ?? order.code;
      if (["DRAFT", "CANCELLED"].includes(order.status)) continue;
      if (order.expectedDeliveryDate && new Date(order.expectedDeliveryDate) < new Date() && order.status !== "DELIVERED") {
        result.push(
          action({
            id: `order-overdue:${order.id}`,
            type: "OVERDUE_ORDER",
            priority: "URGENT",
            title: `Pedido #${label} está atrasado`,
            description: order.customer?.name ?? "Ver a pendência operacional do pedido.",
            customerId: order.customerId,
            orderId: order.id,
            entityType: "ORDER",
            entityId: order.id,
            ctaLabel: "Ver pedido",
            ctaHref: `/sales/desktop/pedidos/${order.id}`,
            dueAt: iso(order.expectedDeliveryDate),
          }),
        );
      } else if (order.status === "INVOICED") {
        result.push(
          action({
            id: `order-invoiced:${order.id}`,
            type: "TRACK_DELIVERY",
            priority: "INFORMATIVE",
            title: `Pedido #${label} faturado`,
            description: order.customer?.name ?? "Acompanhar entrega.",
            customerId: order.customerId,
            orderId: order.id,
            entityType: "ORDER",
            entityId: order.id,
            ctaLabel: "Acompanhar entrega",
            ctaHref: `/sales/desktop/pedidos/${order.id}`,
          }),
        );
      }
    }

    const released = input.commissions.filter((item) => item.status === "RELEASED");
    if (released.length) {
      result.push(
        action({
          id: "commissions:released",
          type: "COMMISSION_RELEASED",
          priority: "INFORMATIVE",
          title: "Comissão liberada",
          description: `${released.length} lançamento(s) disponível(is) para consulta.`,
          entityType: "COMMISSION",
          entityId: released[0]?.id ?? "released",
          ctaLabel: "Ver comissão",
          ctaHref: "/sales/desktop/comissoes",
        }),
      );
    }
    if (input.unreadNotificationCount) {
      result.push(
        action({
          id: "notifications:unread",
          type: "COMMERCIAL_NOTIFICATION",
          priority: "INFORMATIVE",
          title: `${input.unreadNotificationCount} atualização(ões) comercial(is)`,
          description: "Há informações novas sobre preços, promoções ou pedidos.",
          entityType: "NOTIFICATION",
          entityId: "unread",
          ctaLabel: "Ver notificações",
          ctaHref: "/sales/desktop/notificacoes",
        }),
      );
    }

    return result.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]).slice(0, 50);
  }
}
