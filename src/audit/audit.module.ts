import { Global, Module } from "@nestjs/common";
import { AuthorizationModule } from "../authorization/authorization.module";
import { AuditController } from "./audit.controller";
import { AuditInterceptor } from "./audit.interceptor";
import { AuditService } from "./audit.service";
import { DigitalLinksService } from "./digital-links.service";

@Global()
@Module({
  imports: [AuthorizationModule],
  controllers: [AuditController],
  providers: [AuditService, DigitalLinksService, AuditInterceptor],
  exports: [AuditService, DigitalLinksService, AuditInterceptor],
})
export class AuditModule {}
