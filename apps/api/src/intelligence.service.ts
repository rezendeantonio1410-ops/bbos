import { ForbiddenException, Injectable } from "@nestjs/common";
import { CostingService } from "./costing.service";
import { DashboardService } from "./dashboard.service";
import { SalesOrdersService } from "./sales-orders.service";

type IntelligenceInput = { question?: string; path?: string };
type IntelligenceFact = { label: string; value: string; href: string };

const COST_INTELLIGENCE_ROLES = new Set([
  "ADMIN",
  "EXECUTIVE",
  "INDUSTRIAL",
  "FINANCE",
]);

const money = (value: number, currency = "BRL") => {
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}`;
  }
};

@Injectable()
export class IntelligenceService {
  constructor(
    private readonly dashboard: DashboardService,
    private readonly salesOrders: SalesOrdersService,
    private readonly costing: CostingService,
  ) {}

  async ask(companyId: string, role: string, input: IntelligenceInput) {
    const path = String(input.path ?? "/home");
    const question = String(input.question ?? "")
      .trim()
      .toLocaleLowerCase("pt-BR");
    if (path.startsWith("/exportacoes")) {
      return this.exportsAnswer(companyId);
    }
    if (path.startsWith("/custos")) {
      if (!COST_INTELLIGENCE_ROLES.has(role)) {
        throw new ForbiddenException(
          "Seu perfil não possui acesso à inteligência de custos.",
        );
      }
      return this.costsAnswer(companyId);
    }
    const snapshot = await this.dashboard.home(companyId);
    const facts: IntelligenceFact[] = [
      {
        label: "Vendas no mês",
        value: money(snapshot.salesMonth),
        href: "/vendas",
      },
      {
        label: "Pedidos em aberto",
        value: String(snapshot.openOrders),
        href: "/pedidos",
      },
      {
        label: "Pedidos atrasados",
        value: String(snapshot.overdueOrders),
        href: "/pedidos",
      },
      {
        label: "Produção no mês",
        value: `${snapshot.productionActualKg.toLocaleString("pt-BR")} kg`,
        href: "/producao",
      },
    ];
    const greenAvailable = snapshot.greenLots.reduce(
      (sum, lot) => sum + Math.max(0, lot.currentKg - lot.reservedKg),
      0,
    );
    const hasEvidence =
      snapshot.salesMonth > 0 ||
      snapshot.openOrders > 0 ||
      snapshot.productionActualKg > 0 ||
      snapshot.greenLots.length > 0 ||
      snapshot.finishedGoodsUnits > 0 ||
      snapshot.alerts.length > 0;
    const firstAlert = snapshot.alerts[0];

    let answer: string;
    if (
      question.includes("estoque") ||
      question.includes("café") ||
      question.includes("cafe")
    ) {
      answer = `O estoque confirmado mostra ${snapshot.finishedGoodsUnits.toLocaleString("pt-BR")} unidades acabadas e ${greenAvailable.toLocaleString("pt-BR")} kg de café verde disponíveis. Para decidir produção, também considero reservas e pedidos em aberto.`;
      facts.push({
        label: "Café verde disponível",
        value: `${greenAvailable.toLocaleString("pt-BR")} kg`,
        href: "/estoque",
      });
    } else if (question.includes("produ")) {
      answer =
        snapshot.productionPlannedKg > 0
          ? `A produção do mês registra ${snapshot.productionActualKg.toLocaleString("pt-BR")} kg realizados para ${snapshot.productionPlannedKg.toLocaleString("pt-BR")} kg planejados. A recomendação depende das pendências e do estoque reservado.`
          : "Ainda não há produção planejada suficiente no período para eu comparar realizado e plano com confiança.";
    } else if (question.includes("venda") || question.includes("receita")) {
      answer = `A receita registrada no mês é ${money(snapshot.salesMonth)}, com ${snapshot.openOrders} pedido(s) em aberto e ${snapshot.overdueOrders} atrasado(s). Não inferi tendência ou margem sem histórico e custos ligados.`;
    } else if (question.includes("pedido") || question.includes("atras")) {
      answer =
        snapshot.overdueOrders > 0
          ? `Há ${snapshot.overdueOrders} pedido(s) atrasado(s) entre ${snapshot.openOrders} em aberto. Essa é a prioridade comercial mais próxima do cliente.`
          : `Há ${snapshot.openOrders} pedido(s) em aberto e nenhum atraso registrado na consulta atual. Isso não substitui a revisão das etapas de separação, faturamento e expedição.`;
    } else if (firstAlert) {
      answer = `${firstAlert.title}. ${firstAlert.impact} A ação registrada pelo BBOS é: ${firstAlert.action}.`;
      facts.unshift({
        label: firstAlert.tone,
        value: firstAlert.title,
        href: firstAlert.href,
      });
    } else if (!hasEvidence) {
      answer =
        "Ainda não há movimentação operacional suficiente para concluir o que merece atenção. Registre ou conecte pedidos, estoque, produção e qualidade antes de transformar ausência de dados em recomendação.";
    } else {
      answer =
        "Na consulta atual, não encontrei uma exceção crítica registrada. O próximo passo seguro é acompanhar pedidos em aberto e preservar estoque, produção e caixa alinhados à promessa feita ao cliente.";
    }

    return this.response(answer, facts);
  }

  private async exportsAnswer(companyId: string) {
    const overview = await this.salesOrders.exportOverview(companyId);
    const totals = overview.metrics.totalsByCurrency.length
      ? overview.metrics.totalsByCurrency
          .map((item) => money(item.amount, item.currency))
          .join(" · ")
      : money(0);
    const answer =
      overview.metrics.orders === 0
        ? "Ainda não há pedido registrado em um canal de Exportação. Não vou tratar uma carteira vazia como operação internacional concluída."
        : overview.metrics.attention > 0
          ? `${overview.metrics.attention} pedido(s) internacional(is) exigem completar Incoterm, local nomeado ou prazo prometido. Corrija essa base antes de avançar para documentos e logística.`
          : `${overview.metrics.open} pedido(s) internacional(is) estão em aberto e a base comercial registrada está completa. A camada documental aduaneira ainda não faz parte deste diagnóstico.`;
    return this.response(answer, [
      {
        label: "Pedidos internacionais",
        value: String(overview.metrics.orders),
        href: "/exportacoes",
      },
      {
        label: "Em aberto",
        value: String(overview.metrics.open),
        href: "/exportacoes",
      },
      {
        label: "Exigem atenção",
        value: String(overview.metrics.attention),
        href: "/exportacoes",
      },
      { label: "Valor registrado", value: totals, href: "/exportacoes" },
    ]);
  }

  private async costsAnswer(companyId: string) {
    const summary = await this.costing.summary(companyId);
    const answer = summary.period
      ? `O período ${summary.period} registra custo industrial de ${money(summary.metrics.industrialCost)} e custo médio de ${money(summary.metrics.averageCostPerKg)} por kg. A explicação deve partir dos lançamentos e snapshots rastreáveis.`
      : "Ainda não há período de custos calculado. Sem fechamento, o BBOS não afirma margem, ROI ou produto mais rentável.";
    return this.response(answer, [
      {
        label: "Período",
        value: summary.period ?? "Não calculado",
        href: "/custos",
      },
      {
        label: "Custo industrial",
        value: money(summary.metrics.industrialCost),
        href: "/custos",
      },
      {
        label: "Custo médio/kg",
        value: money(summary.metrics.averageCostPerKg),
        href: "/custos",
      },
      {
        label: "Produtos calculados",
        value: String(
          summary.products.filter((product) => product.status === "CALCULATED")
            .length,
        ),
        href: "/custos",
      },
    ]);
  }

  private response(answer: string, facts: IntelligenceFact[]) {
    return {
      answer,
      facts,
      mode: "OPERATIONAL_RULES" as const,
      generative: false,
      sourceUpdatedAt: new Date().toISOString(),
    };
  }
}
