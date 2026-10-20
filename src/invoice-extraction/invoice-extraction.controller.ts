import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { Throttle } from "@nestjs/throttler";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { AuthUser } from "../common/types";
import { ConfirmExtractionDto, ExtractInvoiceQueryDto } from "./dto/invoice-extraction.dto";
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

  @Get("invoices/extraction/:documentId")
  @ApiOperation({ summary: "View extracted invoice data and confidence" })
  get(@CurrentUser() user: AuthUser, @Param("documentId", ParseUUIDPipe) documentId: string) {
    return this.extraction.getExtraction(user, documentId);
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
}
