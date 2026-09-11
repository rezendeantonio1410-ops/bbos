import { BadRequestException, Body, Controller, Get, Patch, Post, Req, UnauthorizedException, Param } from "@nestjs/common";
import { PrismaClient, UserRole } from "@bbos/database";
import { AuthService, hashPassword } from "./auth.service";

@Controller("admin/users")
export class AdminUsersController {
  private readonly db = new PrismaClient();
  constructor(private readonly auth: AuthService) {}

  private async admin(request: any) {
    const actor = await this.auth.resolve(this.auth.readToken(request));
    if (!actor) throw new UnauthorizedException("Sessão inválida.");
    if (actor.role !== "ADMIN") throw new UnauthorizedException("Acesso restrito a administradores.");
    return actor;
  }

  @Get()
  async list(@Req() request: any) {
    const actor = await this.admin(request);
    return this.db.user.findMany({
      where: { companyId: actor.companyId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, role: true, active: true, avatarUrl: true, createdAt: true, updatedAt: true },
    });
  }

  @Post()
  async create(@Req() request: any, @Body() body: Record<string, any>) {
    const actor = await this.admin(request);
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const role = String(body.role ?? "ADMIN").toUpperCase();
    if (!name) throw new BadRequestException("Nome é obrigatório.");
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new BadRequestException("E-mail inválido.");
    if (password.length < 6) throw new BadRequestException("A senha temporária precisa ter pelo menos 6 caracteres.");
    if (!(role in UserRole)) throw new BadRequestException("Perfil de acesso inválido.");
    const existing = await this.db.user.findUnique({ where: { email } });
    if (existing) throw new BadRequestException("Já existe um usuário com este e-mail.");
    return this.db.user.create({
      data: { companyId: actor.companyId, name, email, passwordHash: hashPassword(password), role: role as UserRole, active: true },
      select: { id: true, name: true, email: true, role: true, active: true, avatarUrl: true, createdAt: true },
    });
  }

  @Patch(":id/avatar")
  async avatar(@Req() request: any, @Param("id") id: string, @Body() body: { avatarUrl?: string | null }) {
    const actor = await this.admin(request);
    const target = await this.db.user.findFirst({ where: { id, companyId: actor.companyId }, select: { id: true } });
    if (!target) throw new BadRequestException("Usuário não encontrado.");
    const avatarUrl = body.avatarUrl ?? null;
    if (avatarUrl !== null && (!/^data:image\/(jpeg|png|webp);base64,/i.test(avatarUrl) || avatarUrl.length > 3_000_000)) {
      throw new BadRequestException("Envie uma imagem JPG, PNG ou WebP de até 2 MB.");
    }
    return this.db.user.update({ where: { id }, data: { avatarUrl }, select: { id: true, name: true, email: true, role: true, active: true, avatarUrl: true } });
  }

  @Patch(":id/status")
  async status(@Req() request: any, @Param("id") id: string, @Body() body: { active?: boolean }) {
    const actor = await this.admin(request);
    if (id === actor.id && body.active === false) throw new BadRequestException("Você não pode desativar seu próprio acesso.");
    const target = await this.db.user.findFirst({ where: { id, companyId: actor.companyId } });
    if (!target) throw new BadRequestException("Usuário não encontrado.");
    return this.db.user.update({ where: { id }, data: { active: body.active !== false }, select: { id: true, name: true, email: true, role: true, active: true } });
  }
}
