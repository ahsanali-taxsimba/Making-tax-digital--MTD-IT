import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable, tap } from "rxjs";
import { AuthUser } from "../common/types";
import { AlertsService } from "./alerts.service";
import { MetricsService } from "./metrics.service";
import { IDENTITY_HEADERS, serviceForPath } from "./service-catalog";

@Injectable()
export class IdentityHeadersInterceptor implements NestInterceptor {
  constructor(
    private readonly metrics: MetricsService,
    private readonly alerts: AlertsService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<{
      user?: AuthUser;
      originalUrl?: string;
      url?: string;
      path?: string;
      method?: string;
      headers: Record<string, string>;
    }>();
    const response = http.getResponse<{ setHeader: (name: string, value: string) => void; statusCode?: number }>();
    const path = request.originalUrl ?? request.url ?? request.path ?? "/";
    const service = serviceForPath(path);
    const user = request.user;
    if (user) {
      request.headers[IDENTITY_HEADERS.userId] = user.id;
      request.headers[IDENTITY_HEADERS.principal] = user.principal ?? "firm";
      request.headers[IDENTITY_HEADERS.role] = String(user.platformRole ?? user.firmRole ?? user.role);
      request.headers[IDENTITY_HEADERS.firmId] = user.firmId ?? "";
      request.headers[IDENTITY_HEADERS.clientId] = user.clientId ?? "";
      request.headers[IDENTITY_HEADERS.service] = service;
      response.setHeader(IDENTITY_HEADERS.userId, user.id);
      response.setHeader(IDENTITY_HEADERS.principal, user.principal ?? "firm");
      response.setHeader(IDENTITY_HEADERS.role, String(user.platformRole ?? user.firmRole ?? user.role));
      if (user.firmId) response.setHeader(IDENTITY_HEADERS.firmId, user.firmId);
      if (user.clientId) response.setHeader(IDENTITY_HEADERS.clientId, user.clientId);
      response.setHeader(IDENTITY_HEADERS.service, service);
    }
    this.metrics.inc("mtd_http_requests_total", { service, method: String(request.method ?? "GET").toUpperCase() });
    this.alerts.httpHit(service);
    return next.handle().pipe(
      tap({
        next: () => {
          this.metrics.inc("mtd_http_responses_total", {
            service,
            status: String(response.statusCode ?? 200),
          });
        },
      }),
    );
  }
}
