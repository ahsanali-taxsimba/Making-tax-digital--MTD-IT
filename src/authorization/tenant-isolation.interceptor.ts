import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable } from "rxjs";
import { AuthUser } from "../common/types";
import { AuthorizationService } from "./authorization.service";

@Injectable()
export class TenantIsolationInterceptor implements NestInterceptor {
  constructor(private readonly authz: AuthorizationService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{ user?: AuthUser; originalUrl?: string; url?: string; path?: string }>();
    const user = request.user;
    if (user) {
      this.authz.assertRouteAccess(user, request.originalUrl ?? request.url ?? request.path ?? "");
    }
    return next.handle();
  }
}
