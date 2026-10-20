import { Module } from "@nestjs/common";
import { ClientsModule } from "../clients/clients.module";
import { DocumentsModule } from "../documents/documents.module";
import { FirmsModule } from "../firms/firms.module";
import { ClientWorkspaceController } from "./client-workspace.controller";
import { FirmWorkspaceController } from "./firm-workspace.controller";

@Module({
  imports: [FirmsModule, ClientsModule, DocumentsModule],
  controllers: [FirmWorkspaceController, ClientWorkspaceController],
})
export class TenantModule {}
