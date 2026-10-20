import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { AuthUser } from "../common/types";
import { AUTHZ_ERR, AuthorizationError } from "./authorization.errors";
import { AuthorizationService } from "./authorization.service";

@Injectable()
export class PlatformAuthGuard implements CanActivate {
  constructor(private readonly authz: AuthorizationService) {}

  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest<{ user?: AuthUser }>().user;
    if (!user || !this.authz.isPlatform(user)) {
      throw new AuthorizationError(AUTHZ_ERR.DENIED, "Platform staff authentication is required");
    }
    return true;
  }
}
