import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { AuthUser } from "../common/types";
import { ClientsService } from "./clients.service";
import { CreateClientDto, UpdateClientDto } from "./dto/client.dto";

@ApiTags("clients")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("clients")
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.clients.list(user);
  }

  @Get("me")
  me(@CurrentUser() user: AuthUser) {
    return this.clients.me(user);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.ASSISTANT)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateClientDto) {
    return this.clients.create(user, dto);
  }

  @Get(":id")
  get(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.clients.get(user, id);
  }

  @Patch(":id")
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.ASSISTANT)
  update(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateClientDto) {
    return this.clients.update(user, id, dto);
  }

  @Delete(":id")
  @Roles(UserRole.ADMIN)
  remove(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.clients.remove(user, id);
  }
}
