import { Body, Controller, Get, Patch, Post, Req, Res, UnauthorizedException } from "@nestjs/common";
import { AuthService, SESSION_COOKIE } from "./auth.service";
import { Public } from "./auth.guard";

@Controller("auth")
@Public()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("login")
  async login(@Body() body: { email?: string; password?: string }, @Res({ passthrough: true }) response: any) {
    const result = await this.auth.login(body.email ?? "", body.password ?? "");
    response.cookie(SESSION_COOKIE, result.token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 7 * 86400000, path: "/" });
    return { user: result.user };
  }

  @Get("me")
  async me(@Req() request: any) {
    const user = await this.auth.resolve(this.auth.readToken(request));
    if (!user) throw new UnauthorizedException("Sessão não encontrada.");
    return { user };
  }

  @Patch("me/avatar")
  async updateAvatar(@Req() request: any, @Body() body: { avatarUrl?: string | null }) {
    const user = await this.auth.resolve(this.auth.readToken(request));
    if (!user) throw new UnauthorizedException("Sessão não encontrada.");
    return { user: await this.auth.updateAvatar(user.id, body.avatarUrl === undefined ? null : body.avatarUrl) };
  }

  @Post("logout")
  async logout(@Req() request: any, @Res({ passthrough: true }) response: any) {
    await this.auth.revoke(this.auth.readToken(request));
    response.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: "lax", path: "/" });
    return { ok: true };
  }
}
