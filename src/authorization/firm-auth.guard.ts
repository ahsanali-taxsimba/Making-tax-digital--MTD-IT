import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { AuthUser } from "../common/types";
import { AUTHZ_ERR, AuthorizationError } from "./authorization.errors";
import { AuthorizationService } from "./authorization.service";

@Injectable()
export class FirmAuthGuard implements CanActivate {
  constructor(private readonly authz: AuthorizationService) {}

  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest<{ user?: AuthUser }>().user;
    if (!user || this.authz.isPlatform(user) || !user.firmId) {
      throw new AuthorizationError(AUTHZ_ERR.DENIED, "Accountancy firm authentication is required");
    }
    if (this.authz.asFirm(user)?.role === "firm_client") {
      throw new AuthorizationError(AUTHZ_ERR.DENIED, "Client portal users cannot access the practice workspace");
    }
    return true;
  }
}
