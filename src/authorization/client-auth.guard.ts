import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { AuthUser } from "../common/types";
import { AUTHZ_ERR, AuthorizationError } from "./authorization.errors";
import { AuthorizationService } from "./authorization.service";

@Injectable()
export class ClientAuthGuard implements CanActivate {
  constructor(private readonly authz: AuthorizationService) {}

  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest<{ user?: AuthUser }>().user;
    const firmUser = user ? this.authz.asFirm(user) : null;
    if (!firmUser || firmUser.role !== "firm_client" || !firmUser.clientId) {
      throw new AuthorizationError(AUTHZ_ERR.CLIENT_SCOPE, "Client portal authentication is required");
    }
    return true;
  }
}
