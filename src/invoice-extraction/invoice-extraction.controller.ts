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
  ConfirmExtractionDto,
  ExtractInvoiceQueryDto,
  ListExtractionsQueryDto,
  RejectExtractionDto,
} from "./dto/invoice-extraction.dto";
import { InvoiceExtractionService } from "./invoice-extraction.service";

@ApiTags("invoices")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.ASSISTANT)
@Controller()
export class InvoiceExtractionController {
  constructor(private readonly extraction: InvoiceExtractionService) {}

  @Post("invoices/extract-from-document/:documentId")
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: "Extract structured invoice data from an uploaded document" })
  extract(
    @CurrentUser() user: AuthUser,
    @Param("documentId", ParseUUIDPipe) documentId: string,
    @Query() query: ExtractInvoiceQueryDto,
  ) {
    return this.extraction.extractFromDocument(user, documentId, query.direction);
  }

  @Get("invoices/extractions")
  @ApiOperation({ summary: "List invoice extractions awaiting review" })
  list(@CurrentUser() user: AuthUser, @Query() query: ListExtractionsQueryDto) {
    return this.extraction.listExtractions(user, query.clientId);
  }

  @Get("invoices/extraction/:documentId")
  @ApiOperation({ summary: "View extracted invoice data and confidence" })
  get(@CurrentUser() user: AuthUser, @Param("documentId", ParseUUIDPipe) documentId: string) {
    return this.extraction.getExtraction(user, documentId);
  }

  @Get("invoices/extraction/:documentId/audit")
  @ApiOperation({ summary: "Audit trail for an invoice extraction" })
  audit(@CurrentUser() user: AuthUser, @Param("documentId", ParseUUIDPipe) documentId: string) {
    return this.extraction.listAudit(user, documentId);
  }

  @Post("invoices/extraction/:documentId/confirm")
  @ApiOperation({ summary: "Create a draft invoice or bill from extracted data (does not post)" })
  confirm(
    @CurrentUser() user: AuthUser,
    @Param("documentId", ParseUUIDPipe) documentId: string,
    @Body() dto: ConfirmExtractionDto,
  ) {
    return this.extraction.confirm(user, documentId, dto);
  }

  @Post("invoices/extraction/:documentId/save-draft")
  @ApiOperation({ summary: "Save accountant corrections without creating an invoice" })
  saveDraft(
    @CurrentUser() user: AuthUser,
    @Param("documentId", ParseUUIDPipe) documentId: string,
    @Body() dto: ConfirmExtractionDto,
  ) {
    return this.extraction.saveDraft(user, documentId, dto);
  }

  @Post("invoices/extraction/:documentId/reject")
  @ApiOperation({ summary: "Reject an extraction and keep the document for re-work" })
  reject(
    @CurrentUser() user: AuthUser,
    @Param("documentId", ParseUUIDPipe) documentId: string,
    @Body() dto: RejectExtractionDto,
  ) {
    return this.extraction.reject(user, documentId, dto.reason);
  }

  @Post("invoices/extraction/:documentId/reprocess")
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: "Re-run invoice extraction from the stored document" })
  reprocess(
    @CurrentUser() user: AuthUser,
    @Param("documentId", ParseUUIDPipe) documentId: string,
    @Query() query: ExtractInvoiceQueryDto,
  ) {
    return this.extraction.reprocess(user, documentId, query.direction);
  }
}
