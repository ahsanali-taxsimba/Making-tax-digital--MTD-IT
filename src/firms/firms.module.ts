import { Module } from "@nestjs/common";
import { ClientsModule } from "../clients/clients.module";
import { FirmWorkspaceController } from "./firm-workspace.controller";
import { FirmsController } from "./firms.controller";
import { FirmsService } from "./firms.service";

@Module({
  imports: [ClientsModule],
  controllers: [FirmsController, FirmWorkspaceController],
  providers: [FirmsService],
  exports: [FirmsService],
})
export class FirmsModule {}
