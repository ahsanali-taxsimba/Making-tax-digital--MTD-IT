import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from "@nestjs/common";
import { Observable, tap } from "rxjs";
import { AuthUser } from "../common/types";
import { AlertsService } from "../security/alerts.service";
import { auditActionFor, serviceForPath } from "../security/service-catalog";
import { AuditService } from "./audit.service";

const SKIP = ["/health", "/docs", "/audit", "/auth/refresh", "/metrics"];

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly audit: AuditService,
    private readonly alerts: AlertsService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{
      method?: string;
      originalUrl?: string;
      url?: string;
      path?: string;
      user?: AuthUser;
      params?: Record<string, string>;
      body?: Record<string, unknown>;
    }>();
    const method = String(request.method ?? "GET").toUpperCase();
    const path = request.originalUrl ?? request.url ?? request.path ?? "";
    const cleanPath = path.split("?")[0] ?? "";
    const mutating = method === "POST" || method === "PATCH" || method === "PUT" || method === "DELETE";
    if (!mutating || !request.user || SKIP.some((prefix) => cleanPath === prefix || cleanPath.startsWith(`${prefix}/`))) {
      return next.handle();
    }
    const action = auditActionFor(method, cleanPath);
    const service = serviceForPath(cleanPath);
    return next.handle().pipe(
      tap({
        next: () => {
          if (method === "DELETE" && service === "document-management") {
            this.alerts.documentDeleted(request.user?.id ?? "unknown");
          }
          const box5 = Number(request.body?.box5 ?? request.body?.netVatDue ?? Number.NaN);
          if (service === "mtd-vat" && Number.isFinite(box5)) {
            this.alerts.abnormalVat(box5, { path: cleanPath });
          }
          void this.audit
            .log({
              actor: request.user,
              firmId: request.user?.firmId,
              clientId: request.user?.clientId ?? request.params?.clientId ?? null,
              action,
              resourceId: request.params?.id ?? request.params?.documentId ?? request.params?.resourceId ?? null,
              metadata: { method, path: cleanPath, service },
            })
            .catch((error: Error) => this.logger.error(error.message));
        },
      }),
    );
  }
}
