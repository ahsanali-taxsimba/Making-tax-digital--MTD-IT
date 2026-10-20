import { Module } from "@nestjs/common";
import { ClientsModule } from "../clients/clients.module";
import { HmrcModule } from "../hmrc/hmrc.module";
import { ReceiptsModule } from "../receipts/receipts.module";
import { ItsaController, ItsaEngineController } from "./itsa.controller";
import { ItsaRepository } from "./itsa.repository";
import { ItsaService } from "./itsa.service";

@Module({
  imports: [ClientsModule, HmrcModule, ReceiptsModule],
  controllers: [ItsaController, ItsaEngineController],
  providers: [ItsaService, ItsaRepository],
})
export class ItsaModule {}
