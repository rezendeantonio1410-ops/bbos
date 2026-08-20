import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, SetMetadata } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthService } from "./auth.service";

export const IS_PUBLIC = "bbos:isPublic";
export const Public = () => SetMetadata(IS_PUBLIC, true);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()]);
    if (isPublic) return true;
    const request = context.switchToHttp().getRequest<any>();
    const user = await this.auth.resolve(this.auth.readToken(request));
    if (!user) throw new UnauthorizedException("Sessão não encontrada.");
    request.user = user;
    return true;
  }
}
