import { Module } from "@nestjs/common";
import { ClientsModule } from "../clients/clients.module";
import { DocumentsModule } from "../documents/documents.module";
import { ClientWorkspaceController } from "./client-workspace.controller";
import { PortalController } from "./portal.controller";

@Module({
  imports: [DocumentsModule, ClientsModule],
  controllers: [PortalController, ClientWorkspaceController],
})
export class PortalModule {}
