import { Global, Module } from "@nestjs/common";
import { AuthorizationService } from "./authorization.service";
import { ClientAuthGuard } from "./client-auth.guard";
import { FirmAuthGuard } from "./firm-auth.guard";
import { PlatformAuthGuard } from "./platform-auth.guard";
import { TenantIsolationInterceptor } from "./tenant-isolation.interceptor";

@Global()
@Module({
  providers: [AuthorizationService, PlatformAuthGuard, FirmAuthGuard, ClientAuthGuard, TenantIsolationInterceptor],
  exports: [AuthorizationService, PlatformAuthGuard, FirmAuthGuard, ClientAuthGuard, TenantIsolationInterceptor],
})
export class AuthorizationModule {}
