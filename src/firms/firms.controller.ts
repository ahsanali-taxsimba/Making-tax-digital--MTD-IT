import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { AuthUser } from "../common/types";
import { UpdateFirmDto } from "./dto/firm.dto";
import { FirmsService } from "./firms.service";

@ApiTags("firms")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("firms")
export class FirmsController {
  constructor(private readonly firms: FirmsService) {}

  @Get("me")
  me(@CurrentUser() user: AuthUser) {
    return this.firms.me(user);
  }

  @Get("me/dashboard")
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.ASSISTANT)
  dashboard(@CurrentUser() user: AuthUser) {
    return this.firms.dashboard(user);
  }

  @Get("me/hmrc")
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.ASSISTANT)
  hmrcConnections(@CurrentUser() user: AuthUser) {
    return this.firms.hmrcConnections(user);
  }

  @Patch("me")
  @Roles(UserRole.ADMIN)
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateFirmDto) {
    return this.firms.updateMe(user, dto);
  }
}
