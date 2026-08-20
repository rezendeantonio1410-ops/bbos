import { Controller, Get, Query, Req } from "@nestjs/common";
import type { Period } from "@bbos/shared";
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
  executive(@Req() request: { user?: { companyId: string } }, @Query("period") period: Period = "month") {
    return this.dashboard.executive(request.user!.companyId, period);
  }
}
