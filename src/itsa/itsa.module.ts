import { Module } from "@nestjs/common";
import { ClientsModule } from "../clients/clients.module";
import { HmrcModule } from "../hmrc/hmrc.module";
import { ItsaController, ItsaEngineController } from "./itsa.controller";
import { ItsaRepository } from "./itsa.repository";
import { ItsaService } from "./itsa.service";

@Module({
  imports: [ClientsModule, HmrcModule],
  controllers: [ItsaController, ItsaEngineController],
  providers: [ItsaService, ItsaRepository],
})
export class ItsaModule {}
