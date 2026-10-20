import { Module } from "@nestjs/common";
import { ClientsModule } from "../clients/clients.module";
import { ReceiptsModule } from "../receipts/receipts.module";
import { DocumentAttachmentService } from "./document-attachment.service";
import { DocumentSearchService } from "./document-search.service";
import { DocumentTagService } from "./document-tag.service";
import { ClientDocumentsController, DocumentsController } from "./documents.controller";
import { DocumentsRepository } from "./documents.repository";
import { DocumentsService } from "./documents.service";

@Module({
  imports: [ClientsModule, ReceiptsModule],
  controllers: [DocumentsController, ClientDocumentsController],
  providers: [
    DocumentsRepository,
    DocumentAttachmentService,
    DocumentTagService,
    DocumentSearchService,
    DocumentsService,
  ],
  exports: [DocumentsService, DocumentAttachmentService, DocumentSearchService, DocumentTagService],
})
export class DocumentsModule {}
