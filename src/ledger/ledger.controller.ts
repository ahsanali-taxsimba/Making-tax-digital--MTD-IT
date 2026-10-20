import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { LedgerAccountType, UserRole } from "@prisma/client";
import { IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, Min } from "class-validator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { AuthUser } from "../common/types";
import { ChartOfAccountsService } from "./chart-of-accounts.service";
import { LedgerService } from "./ledger.service";

class CreateLedgerDto {
  @IsString()
  name!: string;

  @IsEnum(LedgerAccountType)
  type!: LedgerAccountType;

  @IsInt()
  @Min(1000)
  code!: number;

  @IsString()
  category!: string;

  @IsOptional()
  @IsString()
  profile?: string;
}

class CreateTransactionDto {
  @IsOptional()
  @IsUUID()
  ledgerId?: string;

  @IsDateString()
  date!: string;

  @IsString()
  description!: string;

  @IsNumber()
  amount!: number;

  @IsOptional()
  @IsString()
  source?: string;
}

class ApplyChartDto {
  @IsString()
  profile!: string;
}

@ApiTags("ledger")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class LedgerController {
  constructor(
    private readonly ledger: LedgerService,
    private readonly charts: ChartOfAccountsService,
  ) {}

  @Get("chart-of-accounts")
  templates(@Query("profile") profile?: string) {
    return this.charts.templates(profile);
  }

  @Get("clients/:id/ledger")
  list(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string, @Query("profile") profile?: string) {
    return this.ledger.list(user, id, profile);
  }

  @Get("clients/:id/chart-of-accounts")
  clientChart(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string, @Query("profile") profile?: string) {
    return this.ledger.list(user, id, profile);
  }

  @Post("clients/:id/chart-of-accounts")
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  applyChart(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string, @Body() dto: ApplyChartDto) {
    return this.ledger.applyChart(user, id, dto.profile);
  }

  @Post("clients/:id/ledger")
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  createLedger(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string, @Body() dto: CreateLedgerDto) {
    return this.ledger.createLedger(user, id, dto);
  }

  @Post("clients/:id/transactions")
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  addTransaction(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CreateTransactionDto,
  ) {
    return this.ledger.addTransaction(user, id, dto);
  }
}
