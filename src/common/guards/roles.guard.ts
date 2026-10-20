import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { UserRole } from "@prisma/client";
import { ROLES_KEY } from "../decorators/roles.decorator";
import { AuthUser } from "../types";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const user = context.switchToHttp().getRequest<{ user: AuthUser }>().user;
    if (!user || user.principal === "platform") {
      throw new ForbiddenException("Insufficient role for this resource");
    }
    const isClient = user.firmRole === "firm_client" || user.role === UserRole.CLIENT;
    if (!roles?.length) {
      if (isClient) {
        throw new ForbiddenException("Client portal users cannot access practice APIs");
      }
      return true;
    }
    if (!roles.includes(user.role)) {
      throw new ForbiddenException("Insufficient role for this resource");
    }
    return true;
  }
}
