import { Module } from "@nestjs/common";
import { ClientsModule } from "../clients/clients.module";
import { BankService } from "./bank.service";
import { BookkeepingController } from "./bookkeeping.controller";
import { BookkeepingRepository } from "./bookkeeping.repository";
import { BookkeepingService } from "./bookkeeping.service";
import { BookkeepingChartService } from "./chart.service";
import { InvoiceService } from "./invoice.service";
import { JournalService } from "./journal.service";
import { ReportsService } from "./reports.service";

@Module({
  imports: [ClientsModule],
  controllers: [BookkeepingController],
  providers: [
    BookkeepingRepository,
    JournalService,
    InvoiceService,
    BankService,
    ReportsService,
    BookkeepingChartService,
    BookkeepingService,
  ],
  exports: [BookkeepingService, ReportsService, JournalService, BankService, BookkeepingRepository],
})
export class BookkeepingModule {}
