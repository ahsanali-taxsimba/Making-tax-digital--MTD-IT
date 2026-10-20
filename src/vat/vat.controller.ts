import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { Throttle } from "@nestjs/throttler";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { AuthUser } from "../common/types";
import { PreviewVatReturnDto, SubmitVatReturnDto, ValidateVatReturnDto } from "./dto/vat.dto";
import { VatService } from "./vat.service";

@ApiTags("mtd-vat")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("vat")
export class VatMappingController {
  constructor(private readonly vat: VatService) {}

  @Get("mapping")
  mapping() {
    return this.vat.mapping();
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
