import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { Throttle } from "@nestjs/throttler";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { AuthUser } from "../common/types";
import {
  BulkManualUploadDto,
  ManualHealthCheckDto,
  ManualParseDto,
  ManualUploadDto,
  ManualUploadsQueryDto,
} from "./dto/manual-statements.dto";
import { ManualStatementsService } from "./manual-statements.service";

@ApiTags("bank-manual")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.ASSISTANT, UserRole.CLIENT)
@Controller("bank/manual")
export class ManualStatementsController {
  constructor(private readonly statements: ManualStatementsService) {}

  @Get("profiles")
  @ApiOperation({ summary: "CSV format profiles for HSBC, Barclays, NatWest, Santander, and generic UK statements" })
  profiles() {
    return this.statements.profiles();
  }

  @Get("uploads")
  @ApiOperation({ summary: "List uploaded manual bank statements for a client" })
  list(@CurrentUser() user: AuthUser, @Query() query: ManualUploadsQueryDto) {
    return this.statements.list(user, query);
  }

  @Post("health-check")
  @ApiOperation({ summary: "CSV health check: missing dates, duplicate rows, and balance inconsistencies" })
  healthCheck(@Body() dto: ManualHealthCheckDto) {
    return this.statements.healthCheck(dto);
  }

  @Post("upload")
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: "Upload a .CSV bank statement, store metadata, and trigger parsing into the Yapily pipeline" })
  upload(@CurrentUser() user: AuthUser, @Body() dto: ManualUploadDto) {
    return this.statements.upload(user, dto);
  }

  @Post("upload/bulk")
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.ASSISTANT)
  @ApiOperation({ summary: "Bulk CSV upload for accountants — one or more client statements" })
  uploadBulk(@CurrentUser() user: AuthUser, @Body() dto: BulkManualUploadDto) {
    return this.statements.uploadBulk(user, dto);
  }

  @Post("parse/:uploadId")
  @ApiOperation({
    summary: "Parse an uploaded CSV into BankTransaction records and run enrichment, categorisation, and matching",
  })
  parse(
    @CurrentUser() user: AuthUser,
    @Param("uploadId", ParseUUIDPipe) uploadId: string,
    @Body() dto: ManualParseDto,
  ) {
    return this.statements.parse(user, uploadId, dto);
  }
}
