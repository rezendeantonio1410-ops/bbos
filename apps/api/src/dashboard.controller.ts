import { Controller, Get, NotFoundException, Param, Query, Req, ServiceUnavailableException } from "@nestjs/common";
import type { ExecutiveDashboard, Period } from "@bbos/shared";
import { DashboardService } from "./dashboard.service";
import { salesPortfolioPartnerId } from "./sales-portfolio";
import { getStateShapes } from "./municipality-shapes";

@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get("home")
  home(
    @Req()
    request: {
      user?: {
        companyId: string;
        role: string;
        storefrontPartnerId?: string | null;
      };
    },
  ) {
    const portfolioPartnerId = salesPortfolioPartnerId(request.user!);
    return this.dashboard.home(
      request.user!.companyId,
      request.user!.role === "SALES",
      portfolioPartnerId,
    );
  }

  @Get("sales-geography")
  salesGeography(
    @Req()
    request: { user?: { companyId: string; role: string; storefrontPartnerId?: string | null } },
    @Query("period") period: Period = "month",
  ) {
    const safePeriod: Period = ["day", "week", "month", "year"].includes(period) ? period : "month";
    return this.dashboard.salesGeography(
      request.user!.companyId,
      safePeriod,
      request.user!.role === "SALES",
      salesPortfolioPartnerId(request.user!),
    );
  }

  /** Real municipality outlines (IBGE) for the sales map of one state. */
  @Get("geo/states/:state")
  async stateShapes(@Param("state") state: string) {
    let shapes;
    try {
      shapes = await getStateShapes(String(state ?? "").slice(0, 2));
    } catch {
      throw new ServiceUnavailableException("Mapa do IBGE indisponível agora. Tente novamente em instantes.");
    }
    if (!shapes) throw new NotFoundException("Estado não encontrado.");
    return shapes;
  }

  @Get("industrial")
  industrial(
    @Req() request: { user?: { companyId: string } },
    @Query("period") period: Period = "month",
  ) {
    return this.dashboard.industrial(request.user!.companyId, period);
  }

  @Get("executive")
  async executive(
    @Req() request: { user?: { companyId: string } },
    @Query("period") period: Period = "month",
  ): Promise<ExecutiveDashboard> {
    const data = await this.dashboard.executive(
      request.user!.companyId,
      period,
    );
    const current = data.metricsByPeriod?.[period] ?? [];
    const fallbackMetric = {
      label: "Sem dados",
      value: "Sem dados",
      change: 0,
      supportingText: "Nenhum registro no período",
    };
    const safeCurrent = Array.from(
      { length: 8 },
      (_, index) => current[index] ?? fallbackMetric,
    );
    const safePeriod = (metrics: typeof current | undefined) =>
      Array.from(
        { length: 8 },
        (_, index) => metrics?.[index] ?? safeCurrent[index] ?? fallbackMetric,
      );

    return {
      ...data,
      metricsByPeriod: {
        day: safePeriod(data.metricsByPeriod?.day),
        week: safePeriod(data.metricsByPeriod?.week),
        month: safePeriod(data.metricsByPeriod?.month),
        year: safePeriod(data.metricsByPeriod?.year),
      },
      goals: data.goals ?? [],
      projections: data.projections ?? [],
      diagnostics: data.diagnostics ?? [],
      alerts: data.alerts ?? [],
    };
  }
}
