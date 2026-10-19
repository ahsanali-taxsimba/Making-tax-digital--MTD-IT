import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { LedgerAccountType, UserRole } from "@prisma/client";
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, IsUUID } from "class-validator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { AuthUser } from "../common/types";
import { LedgerService } from "./ledger.service";

class CreateLedgerDto {
  @IsString()
  name!: string;

  @IsEnum(LedgerAccountType)
  type!: LedgerAccountType;
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

@ApiTags("ledger")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("clients/:id")
export class LedgerController {
  constructor(private readonly ledger: LedgerService) {}

  @Get("ledger")
  list(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.ledger.list(user, id);
  }

  @Post("ledger")
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  createLedger(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string, @Body() dto: CreateLedgerDto) {
    return this.ledger.createLedger(user, id, dto.name, dto.type);
  }

  @Post("transactions")
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  addTransaction(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CreateTransactionDto,
  ) {
    return this.ledger.addTransaction(user, id, dto);
  }
}
