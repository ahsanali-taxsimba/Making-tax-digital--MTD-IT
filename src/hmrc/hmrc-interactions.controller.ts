import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { IsOptional, IsUUID } from "class-validator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { AuthUser } from "../common/types";
import { ClientsService } from "../clients/clients.service";
import { PrismaService } from "../prisma/prisma.service";

class HmrcInteractionsQueryDto {
  @IsOptional()
  @IsUUID()
  clientId?: string;
}

@ApiTags("hmrc")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
@Controller("hmrc/interactions")
export class HmrcInteractionsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clients: ClientsService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Recent HMRC HTTP interactions for a firm client (support/debug)" })
  async list(@CurrentUser() user: AuthUser, @Query() query: HmrcInteractionsQueryDto) {
    if (query.clientId) {
      await this.clients.get(user, query.clientId);
    }
    const firmClients = await this.prisma.client.findMany({
      where: { firmId: user.firmId, ...(query.clientId ? { id: query.clientId } : {}) },
      select: { id: true },
    });
    return this.prisma.hmrcInteraction.findMany({
      where: { clientId: { in: firmClients.map((item) => item.id) } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }
}
