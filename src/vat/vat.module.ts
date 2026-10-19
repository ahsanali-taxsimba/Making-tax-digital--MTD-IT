import { Module } from "@nestjs/common";
import { ClientsModule } from "../clients/clients.module";
import { HmrcModule } from "../hmrc/hmrc.module";
import { VatController } from "./vat.controller";
import { VatService } from "./vat.service";

@Module({
  imports: [ClientsModule, HmrcModule],
  controllers: [VatController],
  providers: [VatService],
})
export class VatModule {}
