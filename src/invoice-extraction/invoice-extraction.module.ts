import { Module } from "@nestjs/common";
import { BookkeepingModule } from "../bookkeeping/bookkeeping.module";
import { ClientsModule } from "../clients/clients.module";
import { ReceiptsModule } from "../receipts/receipts.module";
import { InvoiceExtractionController } from "./invoice-extraction.controller";
import { InvoiceExtractionRepository } from "./invoice-extraction.repository";
import { InvoiceExtractionService } from "./invoice-extraction.service";

@Module({
  imports: [ClientsModule, BookkeepingModule, ReceiptsModule],
  controllers: [InvoiceExtractionController],
  providers: [InvoiceExtractionRepository, InvoiceExtractionService],
  exports: [InvoiceExtractionService],
})
export class InvoiceExtractionModule {}
