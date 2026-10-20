import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { AuthUser } from "../common/types";
import { AuthorizationService } from "../authorization/authorization.service";
import { ClientAuthGuard } from "../authorization/client-auth.guard";
import { ClientsService } from "../clients/clients.service";
import { DocumentsService } from "../documents/documents.service";
import { PrismaService } from "../prisma/prisma.service";

@ApiTags("client")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ClientAuthGuard)
@Controller("client")
export class ClientWorkspaceController {
  constructor(
    private readonly clients: ClientsService,
    private readonly documents: DocumentsService,
    private readonly prisma: PrismaService,
    private readonly authz: AuthorizationService,
  ) {}

  @Get("me")
  @ApiOperation({ summary: "The signed-in client record only" })
  me(@CurrentUser() user: AuthUser) {
    this.authz.assertFirm(user, "view", "client", { firmId: user.firmId, clientId: user.clientId });
    return this.clients.me(user);
  }

  @Get("documents")
  @ApiOperation({ summary: "Documents for the signed-in client only" })
  documentsList(@CurrentUser() user: AuthUser) {
    this.authz.assertFirm(user, "view", "document", { firmId: user.firmId, clientId: user.clientId });
    return this.documents.list(user, user.clientId!);
  }

  @Get("obligations")
  @ApiOperation({ summary: "VAT and ITSA obligations for the signed-in client only" })
  async obligations(@CurrentUser() user: AuthUser) {
    this.authz.assertFirm(user, "view", "vat_return", { firmId: user.firmId, clientId: user.clientId });
    const [vat, itsa] = await Promise.all([
      this.prisma.vatObligation.findMany({ where: { clientId: user.clientId! }, orderBy: { due: "asc" } }),
      this.prisma.itsaObligation.findMany({ where: { clientId: user.clientId! }, orderBy: { due: "asc" } }),
    ]);
    return { vat, itsa };
  }
}
