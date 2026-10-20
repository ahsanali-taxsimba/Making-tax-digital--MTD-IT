import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { Throttle } from "@nestjs/throttler";
import { Response } from "express";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { AuthUser } from "../common/types";
import { BankFeedPipelineService } from "./bank-feed-pipeline.service";
import {
  YapilyAccountsQueryDto,
  YapilyConsentCallbackQueryDto,
  YapilyConsentStartDto,
  YapilyConsentStatusQueryDto,
  YapilyPipelineQueryDto,
  YapilyTransactionsQueryDto,
  YapilyTransactionSyncDto,
} from "./dto/yapily.dto";
import { YapilyService } from "./yapily.service";

@ApiTags("yapily")
@Controller("yapily")
export class YapilyController {
  constructor(
    private readonly yapily: YapilyService,
    private readonly pipeline: BankFeedPipelineService,
  ) {}

  @Post("consent/start")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.ASSISTANT)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: "Start Yapily Open Banking consent and return the institution authorisation URL" })
  async start(
    @CurrentUser() user: AuthUser,
    @Body() dto: YapilyConsentStartDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const started = await this.yapily.startConsent(user, dto);
    if (dto.redirect) {
      response.redirect(started.authorizationUrl);
      return;
    }
    return started;
  }

  @Get("consent/callback")
  @ApiOperation({ summary: "Yapily consent callback — store the encrypted consent token" })
  callback(@Query() query: YapilyConsentCallbackQueryDto) {
    return this.yapily.handleCallback(query);
  }

  @Get("consent/status")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: "Yapily consent status for a client (never returns the token)" })
  status(@CurrentUser() user: AuthUser, @Query() query: YapilyConsentStatusQueryDto) {
    return this.yapily.status(user, query.clientId);
  }

  @Get("accounts")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.ASSISTANT)
  @ApiOperation({ summary: "Fetch Yapily accounts and upsert BankAccount rows" })
  accounts(@CurrentUser() user: AuthUser, @Query() query: YapilyAccountsQueryDto) {
    return this.yapily.syncAccounts(user, query.clientId);
  }

  @Get("accounts/:id/transactions")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.ASSISTANT)
  @ApiOperation({ summary: "Fetch Yapily transactions and enrich them; autoPost runs the full bank-feed pipeline" })
  transactions(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Query() query: YapilyTransactionsQueryDto,
  ) {
    if (query.autoPost) {
      return this.pipeline.run(user, {
        bankAccountId: id,
        from: query.from,
        to: query.to,
        autoPost: true,
        autoMatch: true,
        autoCategorise: true,
      });
    }
    return this.yapily.syncTransactions(user, id, query);
  }

  @Post("transactions/sync")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.ASSISTANT)
  @ApiOperation({
    summary: "Run the end-to-end bank feed: sync, enrich, categorise, match, reconcile, and optionally post journals",
  })
  sync(@CurrentUser() user: AuthUser, @Body() dto: YapilyTransactionSyncDto) {
    return this.pipeline.run(user, dto);
  }

  @Get("pipeline")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.ASSISTANT)
  @ApiOperation({ summary: "Consent, accounts, and reconciliation status for the bank-feed workspace" })
  pipelineStatus(@CurrentUser() user: AuthUser, @Query() query: YapilyPipelineQueryDto) {
    return this.pipeline.status(user, query);
  }

  @Get("accounts/:id/balance")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.ASSISTANT)
  @ApiOperation({ summary: "Fetch the Yapily balance and update BankAccount.balance" })
  balance(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.yapily.syncBalance(user, id);
  }

  @Get("accounts/:id/reconciliation")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.ASSISTANT)
  @ApiOperation({ summary: "Unmatched Yapily transactions and suggested journal matches" })
  reconciliation(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.yapily.reconciliation(user, id);
  }
}
