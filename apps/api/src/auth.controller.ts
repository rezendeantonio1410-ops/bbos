import { Body, Controller, Get, Patch, Post, Req, Res } from "@nestjs/common";
import { AuthService, SESSION_COOKIE } from "./auth.service";
import { Public } from "./auth.guard";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("login")
  @Public()
  async login(@Body() body: { email?: string; password?: string }, @Req() request: any, @Res({ passthrough: true }) response: any) {
    const result = await this.auth.login(body.email ?? "", body.password ?? "", request.ip ?? request.socket?.remoteAddress ?? "unknown");
    response.cookie(SESSION_COOKIE, result.token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 7 * 86400000, path: "/" });
    return { user: result.user };
  }

  @Get("me")
  async me(@Req() request: any) {
    return { user: request.user };
  }

  @Patch("me/avatar")
  async updateAvatar(@Req() request: any, @Body() body: { avatarUrl?: string | null }) {
    return { user: await this.auth.updateAvatar(request.user.id, body.avatarUrl === undefined ? null : body.avatarUrl) };
  }

  @Post("logout")
  @Public()
  async logout(@Req() request: any, @Res({ passthrough: true }) response: any) {
    await this.auth.revoke(this.auth.readToken(request));
    response.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: "lax", path: "/" });
    return { ok: true };
  }
}
