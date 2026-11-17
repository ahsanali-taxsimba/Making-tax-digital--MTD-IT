import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { AuthUser } from "../common/types";
import { ClientsService } from "../clients/clients.service";
import { DocumentsService } from "../documents/documents.service";
import { PrismaService } from "../prisma/prisma.service";
import { ForbiddenException } from "@nestjs/common";

@ApiTags("client-workspace")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CLIENT)
@Controller("client")
export class ClientWorkspaceController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly documents: DocumentsService,
    private readonly clients: ClientsService,
  ) {}

  @Get("me")
  me(@CurrentUser() user: AuthUser) {
    return this.clients.get(user, this.clientId(user));
  }

  @Get("documents")
  documentsList(@CurrentUser() user: AuthUser) {
    return this.documents.list(user, this.clientId(user));
  }

  @Get("obligations")
  async obligations(@CurrentUser() user: AuthUser) {
    const clientId = this.clientId(user);
    const [vat, itsa] = await Promise.all([
      this.prisma.vatObligation.findMany({ where: { clientId }, orderBy: { due: "asc" } }),
      this.prisma.itsaObligation.findMany({
        where: { clientId },
        include: { business: true },
        orderBy: { due: "asc" },
      }),
    ]);
    return { vat, itsa };
  }

  private clientId(user: AuthUser): string {
    if (!user.clientId) {
      throw new ForbiddenException("Client portal user is not linked to a client");
    }
    return user.clientId;
  }
}
