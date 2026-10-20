import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HmrcOAuthService } from "./hmrc-oauth.service";

@Injectable()
export class HmrcTokenRefreshService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HmrcTokenRefreshService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly oauth: HmrcOAuthService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    if (this.config.get<string>("nodeEnv") === "test") {
      return;
    }
    const intervalMs = this.config.get<number>("hmrc.refreshIntervalMs") ?? 300_000;
    this.timer = setInterval(() => {
      void this.tick();
    }, Number.isFinite(intervalMs) ? intervalMs : 300_000);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async tick(): Promise<void> {
    try {
      const refreshed = await this.oauth.refreshExpiring();
      if (refreshed > 0) {
        this.logger.log(`Refreshed ${refreshed} HMRC access token(s)`);
      }
    } catch (error) {
      this.logger.warn(`HMRC token refresh sweep failed: ${error instanceof Error ? error.message : "unknown"}`);
    }
  }
}
