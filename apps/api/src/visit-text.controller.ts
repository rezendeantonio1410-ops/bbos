import { Body, Controller, Post, Req, UnauthorizedException } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { VisitTextPolishService, polishInput } from "./visit-text-polish";

@Controller("visit-text")
export class VisitTextController {
  constructor(
    private readonly auth: AuthService,
    private readonly polisher: VisitTextPolishService,
  ) {}

  @Post("polish")
  async polish(@Req() request: any, @Body() body: { text?: unknown }) {
    const actor = await this.auth.resolve(this.auth.readToken(request));
    if (!actor) throw new UnauthorizedException("Sessão inválida.");
    return this.polisher.polish(polishInput(body?.text), actor.id ?? actor.companyId);
  }
}
