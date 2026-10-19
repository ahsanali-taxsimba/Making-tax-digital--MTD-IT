import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { IsInt, IsString, Min } from "class-validator";
import { ForbiddenException } from "@nestjs/common";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { AuthUser } from "../common/types";
import { DocumentsService } from "../documents/documents.service";
import { PrismaService } from "../prisma/prisma.service";

class PortalDocumentDto {
  @IsString()
  fileName!: string;

  @IsString()
  mimeType!: string;

  @IsInt()
  @Min(1)
  sizeBytes!: number;
}

@ApiTags("portal")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CLIENT)
@Controller("portal")
export class PortalController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly documents: DocumentsService,
  ) {}

  @Get("obligations")
  async obligations(@CurrentUser() user: AuthUser) {
    const clientId = this.clientId(user);
    const [vat, itsa] = await Promise.all([
      this.prisma.vatObligation.findMany({ where: { clientId }, orderBy: { due: "asc" } }),
      this.prisma.itsaObligation.findMany({ where: { clientId }, include: { business: true }, orderBy: { due: "asc" } }),
    ]);
    return { vat, itsa };
  }

  @Get("submissions")
  async submissions(@CurrentUser() user: AuthUser) {
    const clientId = this.clientId(user);
    const [vatReturns, updates, eops, finals] = await Promise.all([
      this.prisma.vatReturn.findMany({ where: { clientId }, orderBy: { createdAt: "desc" } }),
      this.prisma.itsaUpdate.findMany({ where: { clientId }, orderBy: { createdAt: "desc" } }),
      this.prisma.itsaEndOfPeriodStatement.findMany({ where: { clientId }, orderBy: { createdAt: "desc" } }),
      this.prisma.itsaFinalDeclaration.findMany({ where: { clientId }, orderBy: { createdAt: "desc" } }),
    ]);
    return { vatReturns, updates, eops, finals };
  }

  @Get("documents")
  documentsList(@CurrentUser() user: AuthUser) {
    return this.documents.list(user, this.clientId(user));
  }

  @Post("documents")
  upload(@CurrentUser() user: AuthUser, @Body() dto: PortalDocumentDto) {
    return this.documents.create(user, this.clientId(user), dto);
  }

  private clientId(user: AuthUser): string {
    if (!user.clientId) {
      throw new ForbiddenException("Client portal user is not linked to a client");
    }
    return user.clientId;
  }
}
