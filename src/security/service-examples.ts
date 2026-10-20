import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { TenantIsolationInterceptor } from "../authorization/tenant-isolation.interceptor";
import { AuditService } from "../audit/audit.service";
import type { LogicalService } from "./service-catalog";

/**
 * Shared security stack every logical microservice must keep on its controllers.
 * Today these are NestJS modules in one process; the same classes travel with a
 * service if it is split into its own Deployment.
 */
export const SERVICE_SECURITY_STACK = {
  jwt: JwtAuthGuard,
  rbac: RolesGuard,
  tenant: TenantIsolationInterceptor,
} as const;

export function exampleAudit(audit: AuditService, service: LogicalService) {
  return audit.log({
    action: `${service}.write`,
    resourceType: "system",
    metadata: { service },
  });
}
