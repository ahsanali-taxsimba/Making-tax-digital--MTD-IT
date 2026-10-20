import { Body, Controller, ForbiddenException, Get, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { TaskStatus, TaskType, UserRole } from "@prisma/client";
import { IsIn, IsInt, IsOptional, IsString, Min } from "class-validator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { ClientAuthGuard } from "../authorization/client-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { AuthUser } from "../common/types";
import { DocumentsService } from "../documents/documents.service";
import { MessagesService } from "../messages/messages.service";
import { PrismaService } from "../prisma/prisma.service";

class PortalDocumentDto {
  @IsString()
  fileName!: string;

  @IsString()
  mimeType!: string;

  @IsInt()
  @Min(1)
  sizeBytes!: number;

  @IsOptional()
  @IsString()
  category?: string;
}

class PortalConfirmDto {
  @IsIn(["vat", "itsa", "records"])
  kind!: "vat" | "itsa" | "records";

  @IsOptional()
  @IsString()
  note?: string;
}

@ApiTags("portal")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ClientAuthGuard, RolesGuard)
@Roles(UserRole.CLIENT)
@Controller("portal")
export class PortalController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly documents: DocumentsService,
    private readonly messages: MessagesService,
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
      this.prisma.itsaUpdate.findMany({ where: { clientId }, include: { business: true }, orderBy: { createdAt: "desc" } }),
      this.prisma.itsaEndOfPeriodStatement.findMany({ where: { clientId }, include: { business: true }, orderBy: { createdAt: "desc" } }),
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

  @Post("confirm")
  async confirm(@CurrentUser() user: AuthUser, @Body() dto: PortalConfirmDto) {
    const clientId = this.clientId(user);
    const types =
      dto.kind === "vat"
        ? [TaskType.MTD_VAT_RETURN, TaskType.APPROVE_RETURN]
        : dto.kind === "itsa"
          ? [TaskType.MTD_ITSA_UPDATE, TaskType.APPROVE_RETURN]
          : [TaskType.PROVIDE_RECORDS];
    const note =
      dto.note ||
      (dto.kind === "records"
        ? "I have provided the records my accountant asked for."
        : dto.kind === "vat"
          ? "I have reviewed and approved the draft VAT return."
          : "I have reviewed and approved the quarterly Income Tax update.");
    const [message, tasks] = await Promise.all([
      this.messages.create(user, clientId, note),
      this.prisma.task.updateMany({
        where: { clientId, type: { in: types }, status: { in: [TaskStatus.OPEN, TaskStatus.IN_PROGRESS] } },
        data: { status: TaskStatus.COMPLETED, completedAt: new Date() },
      }),
    ]);
    return { confirmed: true, kind: dto.kind, message, tasksUpdated: tasks.count };
  }

  private clientId(user: AuthUser): string {
    if (!user.clientId) {
      throw new ForbiddenException("Client portal user is not linked to a client");
    }
    return user.clientId;
  }
}
