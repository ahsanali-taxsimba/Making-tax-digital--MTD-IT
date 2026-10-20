import { Module } from "@nestjs/common";
import { ItsaModule } from "../../itsa/itsa.module";
import { VatModule } from "../../vat/vat.module";
import { ObligationSyncService } from "./obligation-sync.service";

@Module({
  imports: [VatModule, ItsaModule],
  providers: [ObligationSyncService],
})
export class ObligationsModule {}
