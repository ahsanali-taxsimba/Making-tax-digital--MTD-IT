import { Module } from "@nestjs/common";
import { BookkeepingModule } from "../bookkeeping/bookkeeping.module";
import { ClientsModule } from "../clients/clients.module";
import { BillLookupService } from "./bill-lookup.service";
import { ConfidenceScoringService } from "./confidence-scoring.service";
import { InvoiceLookupService } from "./invoice-lookup.service";
import { JournalPostingService } from "./journal-posting.service";
import { MatchingController } from "./matching.controller";
import { MatchingRepository } from "./matching.repository";
import { MatchingService } from "./matching.service";

@Module({
  imports: [ClientsModule, BookkeepingModule],
  controllers: [MatchingController],
  providers: [
    MatchingRepository,
    InvoiceLookupService,
    BillLookupService,
    ConfidenceScoringService,
    JournalPostingService,
    MatchingService,
  ],
  exports: [
    MatchingService,
    InvoiceLookupService,
    BillLookupService,
    ConfidenceScoringService,
    JournalPostingService,
  ],
})
export class MatchingModule {}
