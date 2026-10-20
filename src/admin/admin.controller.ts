import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { AuthUser } from "../common/types";
import { PlatformAuthGuard } from "../authorization/platform-auth.guard";
import { AdminService } from "./admin.service";

@ApiTags("admin")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PlatformAuthGuard)
@Controller("admin")
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get("firms")
  @ApiOperation({ summary: "List accountancy firms with aggregated counts only" })
  listFirms(@CurrentUser() user: AuthUser) {
    return this.admin.listFirms(user);
  }

  @Get("firms/:id/stats")
  @ApiOperation({ summary: "Aggregated firm stats with no client-level records" })
  stats(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.admin.firmStats(user, id);
  }

  @Get("firms/:id/metadata")
  @ApiOperation({ summary: "Support-only firm and client metadata (names and emails, no financials)" })
  metadata(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.admin.firmMetadata(user, id);
  }

  @Get("system/health")
  @ApiOperation({ summary: "Platform system health" })
  health(@CurrentUser() user: AuthUser) {
    return this.admin.health(user);
  }

  @Get("logs")
  @ApiOperation({ summary: "Platform logs without client financial payloads" })
  logs(@CurrentUser() user: AuthUser) {
    return this.admin.logs(user);
  }

  @Get("feature-flags")
  @ApiOperation({ summary: "Feature flags for platform developers" })
  flags(@CurrentUser() user: AuthUser) {
    return this.admin.featureFlags(user);
  }
}
