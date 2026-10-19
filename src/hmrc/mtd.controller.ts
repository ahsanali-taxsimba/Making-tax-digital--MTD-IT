import { Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { Throttle } from "@nestjs/throttler";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { AuthUser } from "../common/types";
import { MtdConnectionService } from "./mtd-connection.service";

@ApiTags("hmrc")
@Controller()
export class MtdController {
  constructor(private readonly connections: MtdConnectionService) {}

  @Post("clients/:id/mtd/start-auth")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  startAuth(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.connections.startAuth(user, id);
  }

  @Get("mtd/callback")
  handleCallback(
    @Query("code") code?: string,
    @Query("state") state?: string,
    @Query("error") error?: string,
    @Query("error_description") errorDescription?: string,
  ) {
    return this.connections.handleCallback({ code, state, error, error_description: errorDescription });
  }

  @Get("clients/:id/mtd/status")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  status(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.connections.status(user, id);
  }
}
