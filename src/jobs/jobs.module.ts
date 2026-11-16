import { Module } from "@nestjs/common";
import { ItsaModule } from "../itsa/itsa.module";
import { VatModule } from "../vat/vat.module";
import { ObligationSyncService } from "./obligation-sync.service";
import { WebhookRetryService } from "./webhook-retry.service";

@Module({
  imports: [VatModule, ItsaModule],
  providers: [ObligationSyncService, WebhookRetryService],
})
export class JobsModule {}
