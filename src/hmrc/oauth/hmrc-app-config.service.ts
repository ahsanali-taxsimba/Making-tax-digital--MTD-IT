import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HmrcEnvironment } from "@prisma/client";
import { TokenCryptoService } from "../../common/crypto/token-crypto.service";
import { PrismaService } from "../../prisma/prisma.service";
import { assertAppConfigured, HmrcAppSettings, parseHmrcEnvironment } from "./hmrc-oauth.utils";

@Injectable()
export class HmrcAppConfigService implements OnModuleInit {
  private readonly logger = new Logger(HmrcAppConfigService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly crypto: TokenCryptoService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.config.get<string>("nodeEnv") === "test") {
      return;
    }
    await this.persistFromEnv(HmrcEnvironment.SANDBOX);
    await this.persistFromEnv(HmrcEnvironment.LIVE);
  }

  settings(environment: HmrcEnvironment | string): HmrcAppSettings {
    const env = typeof environment === "string" ? parseHmrcEnvironment(environment) : environment;
    const block = env === HmrcEnvironment.LIVE ? this.config.get<Record<string, string>>("hmrc.live") : this.config.get<Record<string, string>>("hmrc.sandbox");
    return {
      environment: env,
      clientId: block?.clientId ?? this.config.get<string>("hmrc.clientId") ?? "",
      clientSecret: block?.clientSecret ?? this.config.get<string>("hmrc.clientSecret") ?? "",
      redirectUri: block?.redirectUri ?? this.config.get<string>("hmrc.redirectUri") ?? "",
      baseUrl: block?.baseUrl ?? this.config.get<string>(env === "LIVE" ? "hmrc.liveApiBase" : "hmrc.sandboxApiBase") ?? "",
      authBaseUrl:
        block?.authBaseUrl ?? this.config.get<string>(env === "LIVE" ? "hmrc.liveAuthBase" : "hmrc.sandboxAuthBase") ?? "",
    };
  }

  requireSettings(environment: HmrcEnvironment | string, requireSecrets = false): HmrcAppSettings {
    const app = this.settings(environment);
    const liveMode = this.config.get<string>("hmrc.mode") === "live";
    assertAppConfigured(app, requireSecrets || liveMode);
    return app;
  }

  defaultEnvironment(): HmrcEnvironment {
    return parseHmrcEnvironment(this.config.get<string>("hmrc.environment"));
  }

  scopes(): string[] {
    return this.config.get<string[]>("hmrc.scopes") ?? [];
  }

  refreshSkewMs(): number {
    return this.config.get<number>("hmrc.refreshSkewMs") ?? 60_000;
  }

  isLiveMode(): boolean {
    return this.config.get<string>("hmrc.mode") === "live";
  }

  private async persistFromEnv(environment: HmrcEnvironment): Promise<void> {
    const app = this.settings(environment);
    if (!app.clientId) {
      return;
    }
    try {
      await this.prisma.hmrcAppConfig.upsert({
        where: { environment },
        update: {
          clientId: app.clientId,
          clientSecretEnc: app.clientSecret ? this.crypto.encrypt(app.clientSecret) : "",
          redirectUri: app.redirectUri,
          baseUrl: app.baseUrl,
          authBaseUrl: app.authBaseUrl,
        },
        create: {
          environment,
          clientId: app.clientId,
          clientSecretEnc: app.clientSecret ? this.crypto.encrypt(app.clientSecret) : "",
          redirectUri: app.redirectUri,
          baseUrl: app.baseUrl,
          authBaseUrl: app.authBaseUrl,
        },
      });
    } catch (error) {
      this.logger.warn(`Could not persist HMRC app config for ${environment}`);
    }
  }
}
