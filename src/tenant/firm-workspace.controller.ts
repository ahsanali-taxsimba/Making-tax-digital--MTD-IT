import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { AuthUser } from "../common/types";
import { AuthorizationService } from "../authorization/authorization.service";
import { FirmAuthGuard } from "../authorization/firm-auth.guard";
import { ClientsService } from "../clients/clients.service";
import { FirmsService } from "../firms/firms.service";
import { PrismaService } from "../prisma/prisma.service";

@ApiTags("firm")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, FirmAuthGuard)
@Controller("firm")
export class FirmWorkspaceController {
  constructor(
    private readonly firms: FirmsService,
    private readonly clientsService: ClientsService,
    private readonly prisma: PrismaService,
    private readonly authz: AuthorizationService,
  ) {}

  @Get("me")
  @ApiOperation({ summary: "Current accountancy firm (tenant) profile" })
  me(@CurrentUser() user: AuthUser) {
    this.authz.assertFirm(user, "view", "firm", { firmId: user.firmId });
    return this.firms.me(user);
  }

  @Get("clients")
  @ApiOperation({ summary: "Clients that belong to the signed-in firm only" })
  clients(@CurrentUser() user: AuthUser) {
    this.authz.assertCanAccessClientData(user, { firmId: user.firmId });
    return this.clientsService.list(user);
  }

  @Get("clients/:id")
  @ApiOperation({ summary: "A single client in the signed-in firm" })
  client(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.clientsService.get(user, id);
  }

  @Get("documents")
  @ApiOperation({ summary: "Document library for the signed-in firm" })
  async documentsList(@CurrentUser() user: AuthUser) {
    this.authz.assertFirm(user, "view", "document", { firmId: user.firmId });
    return this.prisma.documentFile.findMany({
      where: { firmId: user.firmId },
      select: { id: true, clientId: true, fileName: true, type: true, uploadedAt: true },
      orderBy: { uploadedAt: "desc" },
      take: 100,
    });
  }

  @Get("vat/returns")
  @ApiOperation({ summary: "VAT returns for clients in this firm" })
  async vatReturns(@CurrentUser() user: AuthUser) {
    this.authz.assertFirm(user, "view", "vat_return", { firmId: user.firmId });
    return this.prisma.vatReturn.findMany({
      where: { client: { firmId: user.firmId } },
      select: { id: true, clientId: true, periodKey: true, status: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  @Get("itsa/submissions")
  @ApiOperation({ summary: "ITSA submissions for clients in this firm" })
  async itsaSubmissions(@CurrentUser() user: AuthUser) {
    this.authz.assertFirm(user, "view", "itsa_submission", { firmId: user.firmId });
    return this.prisma.itsaUpdate.findMany({
      where: { client: { firmId: user.firmId } },
      select: { id: true, clientId: true, taxYear: true, status: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }
}
