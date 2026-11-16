import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { WebhooksService } from "../webhooks/webhooks.service";

@Injectable()
export class WebhookRetryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WebhookRetryService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly webhooks: WebhooksService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    if (this.config.get<string>("nodeEnv") === "test") {
      return;
    }
    const intervalMs = this.config.get<number>("jobs.webhookRetryMs") ?? 60_000;
    this.timer = setInterval(() => {
      void this.tick();
    }, Number.isFinite(intervalMs) ? intervalMs : 60_000);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async tick(): Promise<number> {
    const maxAttempts = this.config.get<number>("jobs.webhookMaxAttempts") ?? 5;
    const retried = await this.webhooks.retryUndelivered(maxAttempts);
    if (retried > 0) {
      this.logger.log(`Retried ${retried} webhook event(s)`);
    }
    return retried;
  }
}
