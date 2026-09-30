import { Body, Controller, Post, Req } from "@nestjs/common";
import { IntelligenceService } from "./intelligence.service";

@Controller("intelligence")
export class IntelligenceController {
  constructor(private readonly intelligence: IntelligenceService) {}

  @Post("ask")
  ask(
    @Req() request: { user?: { companyId: string } },
    @Body() body: { question?: string; path?: string },
  ) {
    return this.intelligence.ask(request.user!.companyId, body);
  }
}
