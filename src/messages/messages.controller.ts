import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { IsOptional, IsString, IsUUID, MinLength } from "class-validator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { resolveScopedClientId } from "../common/tenancy";
import { AuthUser } from "../common/types";
import { MessagesService } from "./messages.service";

class MessageQueryDto {
  @IsOptional()
  @IsUUID()
  clientId?: string;
}

class CreateMessageDto {
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @IsString()
  @MinLength(1)
  body!: string;
}

@ApiTags("messages")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("messages")
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: MessageQueryDto) {
    return this.messages.list(user, resolveScopedClientId(user, query.clientId));
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateMessageDto) {
    return this.messages.create(user, resolveScopedClientId(user, dto.clientId), dto.body);
  }
}
