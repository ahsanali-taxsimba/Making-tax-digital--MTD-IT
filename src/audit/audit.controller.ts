import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { FirmAuthGuard } from "../authorization/firm-auth.guard";
import { AuthUser } from "../common/types";
import { AuditService } from "./audit.service";
import { DigitalLinksService } from "./digital-links.service";

@ApiTags("audit")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, FirmAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
@Controller()
export class AuditController {
  constructor(
    private readonly audit: AuditService,
    private readonly links: DigitalLinksService,
  ) {}

  @Get("audit/logs")
  @ApiOperation({ summary: "Firm-scoped immutable audit log" })
  list(
    @CurrentUser() user: AuthUser,
    @Query("clientId") clientId?: string,
    @Query("firmId") firmId?: string,
    @Query("actorUserId") actorUserId?: string,
    @Query("action") action?: string,
    @Query("resourceType") resourceType?: string,
    @Query("resourceId") resourceId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("documentId") documentId?: string,
    @Query("invoiceId") invoiceId?: string,
    @Query("billId") billId?: string,
  ) {
    return this.audit.list(user, {
      firmId,
      clientId,
      actorUserId,
      action,
      resourceType,
      resourceId,
      from,
      to,
      documentId,
      invoiceId,
      billId,
    });
  }

  @Get("audit/export")
  @ApiOperation({ summary: "HMRC inspection export: full audit trail + digital links for a client and period" })
  async export(
    @CurrentUser() user: AuthUser,
    @Query("clientId") clientId?: string,
    @Query("period") period?: string,
  ) {
    const [trail, digitalLinks] = await Promise.all([
      this.audit.export(user, { clientId, period }),
      this.links.forClientPeriod(user, clientId, period),
    ]);
    return { ...trail, digitalLinks };
  }

  @Get("digital-links/itsa/:resourceId")
  @ApiOperation({ summary: "HMRC digital links: document → bank → journal → ITSA" })
  itsaLinks(@CurrentUser() user: AuthUser, @Param("resourceId") resourceId: string) {
    return this.links.build(user, resourceId, "itsa");
  }

  @Get("digital-links/invoice/:resourceId")
  @ApiOperation({ summary: "HMRC digital links: document → extraction → invoice → VAT" })
  invoiceLinks(@CurrentUser() user: AuthUser, @Param("resourceId") resourceId: string) {
    return this.links.build(user, resourceId, "invoice");
  }

  @Get("digital-links/:resourceId")
  @ApiOperation({ summary: "HMRC digital links: document → bank → journal → VAT" })
  vatLinks(@CurrentUser() user: AuthUser, @Param("resourceId") resourceId: string) {
    return this.links.build(user, resourceId, "vat");
  }
}
