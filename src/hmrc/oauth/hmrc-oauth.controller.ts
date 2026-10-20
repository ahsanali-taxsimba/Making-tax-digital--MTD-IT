import { Body, Controller, Get, Post, Query, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { Throttle } from "@nestjs/throttler";
import { Response } from "express";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { AuthUser } from "../../common/types";
import {
  HmrcOAuthCallbackQueryDto,
  HmrcOAuthDisconnectDto,
  HmrcOAuthStartQueryDto,
  HmrcOAuthStatusQueryDto,
} from "./hmrc-oauth.dto";
import { HmrcOAuthService } from "./hmrc-oauth.service";

@ApiTags("hmrc-oauth")
@Controller("hmrc/oauth")
export class HmrcOAuthController {
  constructor(private readonly oauth: HmrcOAuthService) {}

  @Get("start")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: "Start the HMRC OAuth2 authorisation-code flow" })
  async start(
    @CurrentUser() user: AuthUser,
    @Query() query: HmrcOAuthStartQueryDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const started = await this.oauth.startAuth(user, query.clientId, query.environment);
    if (query.redirect === "true") {
      response.redirect(started.authorizationUrl);
      return;
    }
    return started;
  }

  @Get("callback")
  @ApiOperation({ summary: "HMRC OAuth2 callback — exchange code for tokens" })
  callback(@Query() query: HmrcOAuthCallbackQueryDto) {
    return this.oauth.handleCallback(query);
  }

  @Get("status")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: "HMRC connection status for a client and environment" })
  status(@CurrentUser() user: AuthUser, @Query() query: HmrcOAuthStatusQueryDto) {
    return this.oauth.status(user, query.clientId, query.environment);
  }

  @Post("refresh")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: "Force-refresh the HMRC access token and return the updated connection status" })
  refresh(@CurrentUser() user: AuthUser, @Body() dto: HmrcOAuthDisconnectDto) {
    return this.oauth.refreshNow(user, dto.clientId, dto.environment);
  }

  @Post("disconnect")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Soft-disconnect a client from HMRC and revoke the refresh token when possible" })
  disconnect(@CurrentUser() user: AuthUser, @Body() dto: HmrcOAuthDisconnectDto) {
    return this.oauth.disconnect(user, dto.clientId, dto.environment);
  }
}
