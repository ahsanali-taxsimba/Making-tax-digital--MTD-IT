import { Module } from "@nestjs/common";
import { ClientsModule } from "../clients/clients.module";
import { HmrcModule } from "../hmrc/hmrc.module";
import { ItsaController, ItsaMappingController } from "./itsa.controller";
import { ItsaService } from "./itsa.service";

@Module({
  imports: [ClientsModule, HmrcModule],
  controllers: [ItsaController, ItsaMappingController],
  providers: [ItsaService],
})
export class ItsaModule {}
