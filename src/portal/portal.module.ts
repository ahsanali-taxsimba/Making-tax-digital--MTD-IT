import { Module } from "@nestjs/common";
import { DocumentsModule } from "../documents/documents.module";
import { PortalController } from "./portal.controller";

@Module({
  imports: [DocumentsModule],
  controllers: [PortalController],
})
export class PortalModule {}
