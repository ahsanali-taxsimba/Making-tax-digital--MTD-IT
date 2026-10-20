import { Module } from "@nestjs/common";
import { DocumentsModule } from "../documents/documents.module";
import { MessagesModule } from "../messages/messages.module";
import { PortalController } from "./portal.controller";

@Module({
  imports: [DocumentsModule, MessagesModule],
  controllers: [PortalController],
})
export class PortalModule {}
