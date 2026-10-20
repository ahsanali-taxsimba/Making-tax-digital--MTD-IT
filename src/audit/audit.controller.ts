import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { AuthUser } from "../common/types";
import { AuditService } from "./audit.service";

@ApiTags("audit")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
@Controller("audit")
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get("logs")
  list(
    @CurrentUser() user: AuthUser,
    @Query("clientId") clientId?: string,
    @Query("firmId") firmId?: string,
    @Query("actorUserId") actorUserId?: string,
    @Query("documentId") documentId?: string,
    @Query("invoiceId") invoiceId?: string,
    @Query("billId") billId?: string,
  ) {
    return this.audit.list({
      firmId: firmId && user.role === UserRole.ADMIN ? firmId : user.firmId,
      clientId,
      actorUserId,
      documentId,
      invoiceId,
      billId,
    });
  }
}
