import { Controller, Get, Param, ParseUUIDPipe, Patch, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { AuthUser } from "../common/types";
import { NotificationsService } from "./notifications.service";

@ApiTags("notifications")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.notifications.list(user);
  }

  @Patch(":id/read")
  markRead(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.notifications.markRead(user, id);
  }
}
