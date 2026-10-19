import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { Throttle } from "@nestjs/throttler";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { AuthUser } from "../common/types";
import { CreateBusinessDto, PreviewItsaUpdateDto, SubmitEopsDto, SubmitFinalDeclarationDto, SubmitItsaUpdateDto } from "./dto/itsa.dto";
import { ItsaService } from "./itsa.service";

@ApiTags("mtd-itsa")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("itsa")
export class ItsaMappingController {
  constructor(private readonly itsa: ItsaService) {}

  @Get("mapping")
  mapping() {
    return this.itsa.mapping();
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
