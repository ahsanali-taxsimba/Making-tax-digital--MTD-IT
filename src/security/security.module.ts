import { Global, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { TokenCryptoService } from "../common/crypto/token-crypto.service";
import { AlertsService } from "./alerts.service";
import { IdentityHeadersInterceptor } from "./identity-headers.interceptor";
import { MetricsController } from "./metrics.controller";
import { MetricsService } from "./metrics.service";
import { MfaService } from "./mfa.service";
import { PasswordHasher } from "./password-hasher";
import { SecretsService } from "./secrets.service";

@Global()
@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>("jwt.accessSecret") ?? "dev-access-secret",
        signOptions: { expiresIn: (config.get<string>("jwt.accessTtl") ?? "15m") as `${number}${"s" | "m" | "h" | "d"}` },
      }),
    }),
  ],
  controllers: [MetricsController],
  providers: [
    PasswordHasher,
    SecretsService,
    MetricsService,
    AlertsService,
    TokenCryptoService,
    MfaService,
    IdentityHeadersInterceptor,
    { provide: APP_INTERCEPTOR, useClass: IdentityHeadersInterceptor },
  ],
  exports: [PasswordHasher, SecretsService, MetricsService, AlertsService, TokenCryptoService, MfaService],
})
export class SecurityModule {}
