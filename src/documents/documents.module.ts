import { Module } from "@nestjs/common";
import { ClientsModule } from "../clients/clients.module";
import { ClientDocumentsController, DocumentsController } from "./documents.controller";
import { DocumentsService } from "./documents.service";

@Module({
  imports: [ClientsModule],
  controllers: [DocumentsController, ClientDocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
