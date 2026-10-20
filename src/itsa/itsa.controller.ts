import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { Throttle } from "@nestjs/throttler";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { AuthUser } from "../common/types";
import {
  CreateBusinessDto,
  ItsaClientQueryDto,
  ItsaListQueryDto,
  ItsaEngineEopsDto,
  ItsaEngineFinalDto,
  ItsaEngineQuarterlyDto,
  ItsaValidateQueryDto,
  PreviewItsaUpdateDto,
  SubmitEopsDto,
  SubmitFinalDeclarationDto,
  SubmitItsaUpdateDto,
} from "./dto/itsa.dto";
import { ItsaService } from "./itsa.service";

@ApiTags("mtd-itsa")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("itsa")
export class ItsaEngineController {
  constructor(private readonly itsa: ItsaService) {}

  @Get("mapping")
  @ApiOperation({ summary: "ITSA chart-of-accounts to HMRC category catalog" })
  mapping() {
    return this.itsa.mapping();
  }

  @Get("obligations")
  @ApiOperation({ summary: "Fetch HMRC ITSA obligations via HmrcClientService GET /income-tax/{nino}/obligations" })
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  obligations(@CurrentUser() user: AuthUser, @Query() query: ItsaClientQueryDto) {
    return this.itsa.obligations(user, query.clientId);
  }

  @Get("income-expenses")
  @ApiOperation({ summary: "Fetch HMRC ITSA income and expenses (sandbox GET /income-tax/{nino}/income-expenses)" })
  incomeExpenses(@CurrentUser() user: AuthUser, @Query() query: ItsaClientQueryDto) {
    return this.itsa.incomeAndExpenses(user, query.clientId);
  }

  @Post("quarterly-update")
  @ApiOperation({ summary: "Validate quarterly categories and submit via HmrcClientService POST /income-tax/{nino}/updates" })
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  submitUpdate(@CurrentUser() user: AuthUser, @Body() dto: ItsaEngineQuarterlyDto) {
    return this.itsa.submitUpdate(user, dto.clientId, dto);
  }

  @Put("uk-property/periodic")
  @ApiOperation({ summary: "Submit a UK property periodic update via PUT /income-tax/{nino}/uk-property/periodic" })
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  submitPropertyUpdate(@CurrentUser() user: AuthUser, @Body() dto: ItsaEngineQuarterlyDto) {
    return this.itsa.submitUpdate(user, dto.clientId, dto);
  }

  @Post("eops")
  @ApiOperation({ summary: "Validate EOPS completeness and submit via HmrcClientService POST /income-tax/{nino}/eops" })
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  submitEops(@CurrentUser() user: AuthUser, @Body() dto: ItsaEngineEopsDto) {
    return this.itsa.submitEops(user, dto.clientId, dto);
  }

  @Put("uk-property/eops")
  @ApiOperation({ summary: "Submit a UK property EOPS via PUT /income-tax/{nino}/uk-property/eops" })
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  submitPropertyEops(@CurrentUser() user: AuthUser, @Body() dto: ItsaEngineEopsDto) {
    return this.itsa.submitEops(user, dto.clientId, dto);
  }

  @Post("final-declaration")
  @ApiOperation({ summary: "Validate Final Declaration completeness and submit via HmrcClientService POST /income-tax/{nino}/final-declaration" })
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  submitFinal(@CurrentUser() user: AuthUser, @Body() dto: ItsaEngineFinalDto) {
    return this.itsa.submitFinal(user, dto.clientId, dto);
  }

  @Get("validate")
  @ApiOperation({ summary: "Pre-submission ITSA validation for quarterly, EOPS, or year-end" })
  validate(@CurrentUser() user: AuthUser, @Query() query: ItsaValidateQueryDto) {
    return this.itsa.validate(user, query.clientId, query);
  }

  @Get("businesses")
  listBusinesses(@CurrentUser() user: AuthUser, @Query() query: ItsaClientQueryDto) {
    return this.itsa.listBusinesses(user, query.clientId);
  }

  @Get("updates")
  @ApiOperation({ summary: "List quarterly updates stored for a client" })
  listUpdates(@CurrentUser() user: AuthUser, @Query() query: ItsaClientQueryDto) {
    return this.itsa.listUpdates(user, query.clientId);
  }

  @Get("eops")
  @ApiOperation({ summary: "List End of Period Statements for a client" })
  listEops(@CurrentUser() user: AuthUser, @Query() query: ItsaListQueryDto) {
    return this.itsa.listEops(user, query.clientId, query.taxYear);
  }

  @Get("final-declaration")
  @ApiOperation({ summary: "List Final Declarations for a client" })
  listFinals(@CurrentUser() user: AuthUser, @Query() query: ItsaListQueryDto) {
    return this.itsa.listFinals(user, query.clientId, query.taxYear);
  }
}

@ApiTags("mtd-itsa")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("clients/:id/itsa")
export class ItsaController {
  constructor(private readonly itsa: ItsaService) {}

  @Get("mapping")
  clientMapping(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.itsa.clientMapping(user, id);
  }

  @Post("updates/preview")
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  preview(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string, @Body() dto: PreviewItsaUpdateDto) {
    return this.itsa.previewUpdate(user, id, dto);
  }

  @Get("obligations")
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  obligations(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.itsa.obligations(user, id);
  }

  @Get("income-expenses")
  incomeExpenses(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.itsa.incomeAndExpenses(user, id);
  }

  @Get("updates")
  updates(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.itsa.listUpdates(user, id);
  }

  @Post("updates")
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  submitUpdate(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string, @Body() dto: SubmitItsaUpdateDto) {
    return this.itsa.submitUpdate(user, id, dto);
  }

  @Post("eops")
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  submitEops(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string, @Body() dto: SubmitEopsDto) {
    return this.itsa.submitEops(user, id, dto);
  }

  @Post("final-declaration")
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  submitFinal(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string, @Body() dto: SubmitFinalDeclarationDto) {
    return this.itsa.submitFinal(user, id, dto);
  }

  @Post("businesses")
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  addBusiness(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string, @Body() dto: CreateBusinessDto) {
    return this.itsa.addBusiness(user, id, dto);
  }
}
