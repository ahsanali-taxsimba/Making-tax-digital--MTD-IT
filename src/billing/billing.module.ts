import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BillingAdminController } from "./billing-admin.controller";
import { BillingAdminService } from "./billing-admin.service";
import { BillingController } from "./billing.controller";
import { BillingService } from "./billing.service";
import { BillingUsageService } from "./billing-usage.service";
import { BillingWebhookController } from "./billing-webhook.controller";
import { STRIPE_GATEWAY } from "./billing.tokens";
import { LiveStripeGateway } from "./stripe.live";
import { MockStripeGateway } from "./stripe.mock";
import { StripeGateway } from "./stripe.types";

@Global()
@Module({
  controllers: [BillingController, BillingWebhookController, BillingAdminController],
  providers: [
    MockStripeGateway,
    LiveStripeGateway,
    BillingService,
    BillingAdminService,
    BillingUsageService,
    {
      provide: STRIPE_GATEWAY,
      inject: [ConfigService, MockStripeGateway, LiveStripeGateway],
      useFactory: (config: ConfigService, mock: MockStripeGateway, live: LiveStripeGateway): StripeGateway =>
        config.get("stripe.mode") === "live" ? live : mock,
    },
  ],
  exports: [BillingService, BillingAdminService],
})
export class BillingModule {}
