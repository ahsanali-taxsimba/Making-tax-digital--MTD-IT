import { Module } from "@nestjs/common";
import { ClientsModule } from "../clients/clients.module";
import { HmrcModule } from "../hmrc/hmrc.module";
import { ReceiptsModule } from "../receipts/receipts.module";
import { VatController, VatEngineController } from "./vat.controller";
import { VatRepository } from "./vat.repository";
import { VatService } from "./vat.service";

@Module({
  imports: [ClientsModule, HmrcModule, ReceiptsModule],
  controllers: [VatController, VatEngineController],
  providers: [VatService, VatRepository],
})
export class VatModule {}
