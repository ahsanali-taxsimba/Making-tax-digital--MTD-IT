import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BillingService } from "./billing.service";

@Injectable()
export class BillingUsageService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BillingUsageService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly billing: BillingService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    if (this.config.get<string>("nodeEnv") === "test") {
      return;
    }
    const intervalMs = this.config.get<number>("stripe.usageSyncMs") ?? 3_600_000;
    this.timer = setInterval(() => {
      void this.tick();
    }, Number.isFinite(intervalMs) ? intervalMs : 3_600_000);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async tick(): Promise<void> {
    try {
      const updated = await this.billing.syncUsage();
      if (updated > 0) {
        this.logger.log(`Reported usage for ${updated} usage-based subscription(s)`);
      }
    } catch (error) {
      this.logger.warn(`Billing usage sync failed: ${error instanceof Error ? error.message : "unknown"}`);
    }
  }
}
