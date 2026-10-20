import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from "@nestjs/common";
import { Observable, tap } from "rxjs";
import { AuthUser } from "../common/types";
import { AuditService } from "./audit.service";

const SKIP = ["/health", "/docs", "/audit", "/auth/refresh"];

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{
      method?: string;
      originalUrl?: string;
      url?: string;
      path?: string;
      user?: AuthUser;
      params?: Record<string, string>;
    }>();
    const method = String(request.method ?? "GET").toUpperCase();
    const path = request.originalUrl ?? request.url ?? request.path ?? "";
    const cleanPath = path.split("?")[0] ?? "";
    const mutating = method === "POST" || method === "PATCH" || method === "PUT" || method === "DELETE";
    if (!mutating || !request.user || SKIP.some((prefix) => cleanPath === prefix || cleanPath.startsWith(`${prefix}/`))) {
      return next.handle();
    }
    const segment = cleanPath.split("/").filter(Boolean)[0] ?? "http";
    return next.handle().pipe(
      tap({
        next: () => {
          void this.audit
            .log({
              actor: request.user,
              firmId: request.user?.firmId,
              clientId: request.user?.clientId ?? request.params?.clientId ?? null,
              action: `${segment}.${method.toLowerCase()}`,
              resourceId: request.params?.id ?? request.params?.documentId ?? request.params?.resourceId ?? null,
              metadata: { method, path: cleanPath },
            })
            .catch((error: Error) => this.logger.error(error.message));
        },
      }),
    );
  }
}
