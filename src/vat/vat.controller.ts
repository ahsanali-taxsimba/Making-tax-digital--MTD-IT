import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { Throttle } from "@nestjs/throttler";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { AuthUser } from "../common/types";
import {
  PreviewVatReturnDto,
  SubmitVatReturnDto,
  ValidateVatReturnDto,
  VatClientQueryDto,
  VatEngineSubmitDto,
  VatValidateQueryDto,
} from "./dto/vat.dto";
import { VatService } from "./vat.service";

@ApiTags("mtd-vat")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("vat")
export class VatEngineController {
  constructor(private readonly vat: VatService) {}

  @Get("mapping")
  @ApiOperation({ summary: "VAT Notice 700/12 box catalog and ledger sources" })
  mapping() {
    return this.vat.mapping();
  }

  @Get("obligations")
  @ApiOperation({ summary: "Fetch HMRC VAT obligations for a client via HmrcClientService GET /organisations/vat/{vrn}/obligations" })
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  obligations(@CurrentUser() user: AuthUser, @Query() query: VatClientQueryDto) {
    return this.vat.obligations(user, query.clientId);
  }

  @Get("returns")
  @ApiOperation({ summary: "List submitted VAT returns" })
  listReturns(@CurrentUser() user: AuthUser, @Query() query: VatClientQueryDto) {
    return this.vat.listReturns(user, query.clientId);
  }

  @Get("returns/:periodKey")
  @ApiOperation({ summary: "Fetch a VAT return from HMRC by period key" })
  fetchReturn(
    @CurrentUser() user: AuthUser,
    @Param("periodKey") periodKey: string,
    @Query() query: VatClientQueryDto,
  ) {
    return this.vat.fetchHmrcReturn(user, query.clientId, periodKey);
  }

  @Post("returns/draft")
  @ApiOperation({ summary: "Create a local VAT return draft (boxes 1–9) before HMRC submission" })
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  createDraft(@CurrentUser() user: AuthUser, @Body() dto: VatEngineSubmitDto) {
    return this.vat.createDraft(user, dto.clientId, dto);
  }

  @Post("returns/submit")
  @ApiOperation({ summary: "Validate VAT boxes 1–9 and submit via HmrcClientService POST /organisations/vat/{vrn}/returns" })
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  submit(@CurrentUser() user: AuthUser, @Body() dto: VatEngineSubmitDto) {
    return this.vat.submit(user, dto.clientId, dto);
  }

  @Get("payments")
  @ApiOperation({ summary: "Fetch HMRC VAT payments via HmrcClientService GET /organisations/vat/{vrn}/payments" })
  payments(@CurrentUser() user: AuthUser, @Query() query: VatClientQueryDto) {
    return this.vat.payments(user, query.clientId);
  }

  @Get("validate")
  @ApiOperation({ summary: "Pre-submission VAT return validation (Notice 700/12 + HMRC arithmetic)" })
  @ApiQuery({ name: "clientId", required: true })
  validate(@CurrentUser() user: AuthUser, @Query() query: VatValidateQueryDto) {
    const fromLedger = query.fromLedger ?? query.box1 === undefined;
    return this.vat.validateReturn(user, query.clientId, {
      ...query,
      fromLedger,
      vatDueSales: query.box1,
      vatDueAcquisitions: query.box2,
      totalVatDue: query.box3,
      vatReclaimedCurrPeriod: query.box4,
      netVatDue: query.box5,
      totalValueSalesExVAT: query.box6,
      totalValuePurchasesExVAT: query.box7,
      totalValueGoodsSuppliedExVAT: query.box8,
      totalAcquisitionsExVAT: query.box9,
    });
  }

  @Get("summaries")
  @ApiOperation({ summary: "Aggregated ledger totals for VAT periods" })
  summaries(@CurrentUser() user: AuthUser, @Query() query: VatClientQueryDto) {
    return this.vat.listSummaries(user, query.clientId);
  }
}

@ApiTags("mtd-vat")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("clients/:id/vat")
export class VatController {
  constructor(private readonly vat: VatService) {}

  @Get("mapping")
  clientMapping(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.vat.clientMapping(user, id);
  }

  @Post("returns/preview")
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  preview(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string, @Body() dto: PreviewVatReturnDto) {
    return this.vat.previewReturn(user, id, dto);
  }

  @Post("returns/validate")
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  validate(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string, @Body() dto: ValidateVatReturnDto) {
    return this.vat.validateReturn(user, id, dto);
  }

  @Get("obligations")
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  obligations(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.vat.obligations(user, id);
  }

  @Get("returns")
  listReturns(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.vat.listReturns(user, id);
  }

  @Get("returns/:periodKey")
  fetchReturn(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("periodKey") periodKey: string,
  ) {
    return this.vat.fetchHmrcReturn(user, id, periodKey);
  }

  @Post("returns/draft")
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  createDraft(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string, @Body() dto: SubmitVatReturnDto) {
    return this.vat.createDraft(user, id, dto);
  }

  @Post("returns")
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  submit(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string, @Body() dto: SubmitVatReturnDto) {
    return this.vat.submit(user, id, dto);
  }

  @Get("payments")
  payments(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.vat.payments(user, id);
  }
}
