import { Controller, Get, Query, Req } from "@nestjs/common";
import type { ExecutiveDashboard, Period } from "@bbos/shared";
import { DashboardService } from "./dashboard.service";

@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get("home")
  home(@Req() request: { user?: { companyId: string } }) {
    return this.dashboard.home(request.user!.companyId);
  }

  @Get("industrial")
  industrial(@Req() request: { user?: { companyId: string } }, @Query("period") period: Period = "month") {
    return this.dashboard.industrial(request.user!.companyId, period);
  }

  @Get("executive")
  async executive(
    @Req() request: { user?: { companyId: string } },
    @Query("period") period: Period = "month",
  ): Promise<ExecutiveDashboard> {
    const data = await this.dashboard.executive(request.user!.companyId, period);
    const current = data.metricsByPeriod?.[period] ?? [];
    const fallbackMetric = {
      label: "Sem dados",
      value: "Sem dados",
      change: 0,
      supportingText: "Nenhum registro no período",
    };
    const safeCurrent = Array.from({ length: 8 }, (_, index) => current[index] ?? fallbackMetric);
    const safePeriod = (metrics: typeof current | undefined) =>
      Array.from({ length: 8 }, (_, index) => metrics?.[index] ?? safeCurrent[index] ?? fallbackMetric);

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
