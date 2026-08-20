import { ForbiddenException, Controller, Post, Req } from "@nestjs/common";
import { PrismaClient, seedCoffeeReferences } from "@bbos/database";
import { requireSession } from "./auth-context";
import { AuthService } from "./auth.service";

@Controller("admin/coffee-reference-data")
export class AdminCoffeeReferenceController {
  private readonly db = new PrismaClient();

  constructor(private readonly auth: AuthService) {}

  @Post("initialize")
  async initialize(@Req() request: any) {
    const actor = await requireSession(request, this.auth);
    if (actor.role !== "ADMIN" && actor.role !== "EXECUTIVE") {
      throw new ForbiddenException("Apenas usuários administrativos podem inicializar dados mestres.");
    }
    await seedCoffeeReferences(this.db, true, actor.companyId);
    const [suppliers, species, cultivars, regions, screens] = await Promise.all([
      this.db.supplier.count({ where: { companyId: actor.companyId, active: true } }),
      this.db.coffeeSpecies.count({ where: { companyId: actor.companyId, active: true } }),
      this.db.coffeeVariety.count({ where: { species: { companyId: actor.companyId }, active: true } }),
      this.db.coffeeRegion.count({ where: { companyId: actor.companyId, active: true } }),
      this.db.screenClassification.count({ where: { companyId: actor.companyId, active: true } }),
    ]);
    if (species !== 2 || cultivars !== 38 || regions !== 24 || screens !== 6 || suppliers < 1) {
      throw new Error(`Dados mestres incompletos: suppliers=${suppliers} species=${species} cultivars=${cultivars} regions=${regions} screens=${screens}`);
    }
    return { success: true, companyId: actor.companyId, suppliers, species, cultivars, regions, screens };
  }
}
