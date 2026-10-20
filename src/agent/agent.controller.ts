import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { AuthUser } from "../common/types";
import { AgentService } from "./agent.service";
import { AgentMessageDto, CreateConversationDto } from "./dto/agent.dto";

@ApiTags("bookkeeping-agent")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.ASSISTANT)
@Controller("agent")
export class AgentController {
  constructor(private readonly agent: AgentService) {}

  @Get("conversations")
  @ApiOperation({ summary: "List bookkeeping copilot threads for the signed-in staff member" })
  list(@CurrentUser() user: AuthUser) {
    return this.agent.listConversations(user);
  }

  @Post("conversations")
  @ApiOperation({ summary: "Start a bookkeeping copilot thread" })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateConversationDto) {
    return this.agent.createConversation(user, dto.title);
  }

  @Get("conversations/:id")
  @ApiOperation({ summary: "Load a copilot thread, messages and confirmable actions" })
  get(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.agent.getConversation(user, id);
  }

  @Post("conversations/:id/messages")
  @ApiOperation({ summary: "Ask the bookkeeping agent. Write actions are queued for confirmation." })
  ask(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string, @Body() dto: AgentMessageDto) {
    return this.agent.ask(user, id, dto.content);
  }

  @Post("messages")
  @ApiOperation({ summary: "Ask in a new thread" })
  askNew(@CurrentUser() user: AuthUser, @Body() dto: AgentMessageDto) {
    return this.agent.ask(user, undefined, dto.content);
  }

  @Post("actions/:id/apply")
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Apply a proposed categorisation, match, task or invoice" })
  apply(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.agent.applyAction(user, id);
  }

  @Post("actions/:id/dismiss")
  @ApiOperation({ summary: "Dismiss a proposed action without posting" })
  dismiss(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.agent.dismissAction(user, id);
  }
}
