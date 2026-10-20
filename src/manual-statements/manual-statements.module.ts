import { Module } from "@nestjs/common";
import { BookkeepingModule } from "../bookkeeping/bookkeeping.module";
import { ClientsModule } from "../clients/clients.module";
import { YapilyModule } from "../yapily/yapily.module";
import { CsvHealthCheckService } from "./csv-health-check.service";
import { EnrichmentService } from "./enrichment.service";
import { ManualStatementsController } from "./manual-statements.controller";
import { ManualStatementsRepository } from "./manual-statements.repository";
import { ManualStatementsService } from "./manual-statements.service";
import { StatementCSVParserService } from "./statement-csv-parser.service";

@Module({
  imports: [ClientsModule, BookkeepingModule, YapilyModule],
  controllers: [ManualStatementsController],
  providers: [
    ManualStatementsRepository,
    StatementCSVParserService,
    CsvHealthCheckService,
    EnrichmentService,
    ManualStatementsService,
  ],
  exports: [ManualStatementsService, StatementCSVParserService, EnrichmentService],
})
export class ManualStatementsModule {}
