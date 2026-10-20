import { Module, ValidationPipe } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AdminModule } from "./admin/admin.module";
import { AuthorizationModule } from "./authorization/authorization.module";
import { TenantIsolationInterceptor } from "./authorization/tenant-isolation.interceptor";
import { AuditInterceptor } from "./audit/audit.interceptor";
import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { BookkeepingModule } from "./bookkeeping/bookkeeping.module";
import { CategorisationModule } from "./categorisation/categorisation.module";
import { ClientsModule } from "./clients/clients.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { ResponseInterceptor } from "./common/interceptors/response.interceptor";
import configuration from "./config/configuration";
import { DocumentsModule } from "./documents/documents.module";
import { InvoiceExtractionModule } from "./invoice-extraction/invoice-extraction.module";
import { FirmsModule } from "./firms/firms.module";
import { HealthController } from "./health/health.controller";
import { HmrcModule } from "./hmrc/hmrc.module";
import { ObligationsModule } from "./hmrc/obligations/obligations.module";
import { ItsaModule } from "./itsa/itsa.module";
import { ChartOfAccountsModule } from "./ledger/chart-of-accounts.module";
import { LedgerModule } from "./ledger/ledger.module";
import { MessagesModule } from "./messages/messages.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { PortalModule } from "./portal/portal.module";
import { PrismaModule } from "./prisma/prisma.module";
import { TasksModule } from "./tasks/tasks.module";
import { UsersModule } from "./users/users.module";
import { VatModule } from "./vat/vat.module";
import { WebhooksModule } from "./webhooks/webhooks.module";
import { MatchingModule } from "./matching/matching.module";
import { ManualStatementsModule } from "./manual-statements/manual-statements.module";
import { ReceiptsModule } from "./receipts/receipts.module";
import { TenantModule } from "./tenant/tenant.module";
import { YapilyModule } from "./yapily/yapily.module";
import { SecurityModule } from "./security/security.module";
import { BillingModule } from "./billing/billing.module";
import { AgentModule } from "./agent/agent.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get<number>("throttle.ttl") ?? 60000,
          limit: config.get<number>("throttle.limit") ?? 60,
        },
      ],
    }),
    PrismaModule,
    SecurityModule,
    AuthorizationModule,
    AuditModule,
    TasksModule,
    NotificationsModule,
    WebhooksModule,
    AuthModule,
    FirmsModule,
    UsersModule,
    ClientsModule,
    HmrcModule,
    VatModule,
    ItsaModule,
    ObligationsModule,
    DocumentsModule,
    InvoiceExtractionModule,
    MessagesModule,
    ChartOfAccountsModule,
    LedgerModule,
    BookkeepingModule,
    CategorisationModule,
    MatchingModule,
    YapilyModule,
    ManualStatementsModule,
    ReceiptsModule,
    PortalModule,
    AdminModule,
    BillingModule,
    AgentModule,
    TenantModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_PIPE, useValue: new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }) },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TenantIsolationInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
