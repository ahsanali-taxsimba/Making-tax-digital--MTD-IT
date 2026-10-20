import { Module } from "@nestjs/common";
import { ClientsModule } from "../clients/clients.module";
import { LedgerController } from "./ledger.controller";
import { LedgerService } from "./ledger.service";

@Module({
  imports: [ClientsModule],
  controllers: [LedgerController],
  providers: [LedgerService],
})
export class LedgerModule {}
