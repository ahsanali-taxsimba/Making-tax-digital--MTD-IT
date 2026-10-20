import { Module } from "@nestjs/common";
import { BookkeepingModule } from "../bookkeeping/bookkeeping.module";
import { ClientsModule } from "../clients/clients.module";
import { CategorisationController } from "./categorisation.controller";
import { CategorisationRepository } from "./categorisation.repository";
import { CategorisationService } from "./categorisation.service";
import { ITSAInferenceService } from "./itsa-inference.service";
import { JournalDraftService } from "./journal-draft.service";
import { MCCMappingService } from "./mcc-mapping.service";
import { MerchantDictionaryService } from "./merchant-dictionary.service";
import { VATInferenceService } from "./vat-inference.service";

@Module({
  imports: [ClientsModule, BookkeepingModule],
  controllers: [CategorisationController],
  providers: [
    CategorisationRepository,
    MerchantDictionaryService,
    MCCMappingService,
    VATInferenceService,
    ITSAInferenceService,
    JournalDraftService,
    CategorisationService,
  ],
  exports: [
    CategorisationService,
    MerchantDictionaryService,
    MCCMappingService,
    VATInferenceService,
    ITSAInferenceService,
    JournalDraftService,
  ],
})
export class CategorisationModule {}
