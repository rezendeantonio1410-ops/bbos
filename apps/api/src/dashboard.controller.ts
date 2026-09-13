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
    const safeCurrent = current.length
      ? current
      : [
          {
            label: "Sem dados",
            value: "Sem dados",
            change: 0,
            supportingText: "Nenhum registro no período",
          },
        ];

    return {
      ...data,
      metricsByPeriod: {
        day: data.metricsByPeriod?.day?.length ? data.metricsByPeriod.day : safeCurrent,
        week: data.metricsByPeriod?.week?.length ? data.metricsByPeriod.week : safeCurrent,
        month: data.metricsByPeriod?.month?.length ? data.metricsByPeriod.month : safeCurrent,
        year: data.metricsByPeriod?.year?.length ? data.metricsByPeriod.year : safeCurrent,
      },
      goals: data.goals ?? [],
      projections: data.projections ?? [],
      diagnostics: data.diagnostics ?? [],
      alerts: data.alerts ?? [],
    };
  }
}
