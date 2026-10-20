import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { Throttle } from "@nestjs/throttler";
import { Response } from "express";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { AuthUser } from "../common/types";
import { ReceiptEvidenceQueryDto, ReceiptsQueryDto, UpdateReceiptTagsDto, UploadReceiptDto } from "./dto/receipts.dto";
import { ReceiptAttachmentService } from "./receipt-attachment.service";
import { ReceiptsService } from "./receipts.service";

const StaffAndClient = [UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.ASSISTANT, UserRole.CLIENT] as const;

@ApiTags("receipts")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...StaffAndClient)
@Controller()
export class ReceiptsController {
  constructor(
    private readonly receipts: ReceiptsService,
    private readonly attachments: ReceiptAttachmentService,
  ) {}

  @Post("receipts/upload")
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: "Upload a JPG, PNG, or PDF receipt, store it, and trigger OCR" })
  upload(@CurrentUser() user: AuthUser, @Body() dto: UploadReceiptDto) {
    return this.receipts.upload(user, dto);
  }

  @Get("receipts")
  @ApiOperation({ summary: "List receipts for a client" })
  list(@CurrentUser() user: AuthUser, @Query() query: ReceiptsQueryDto) {
    return this.receipts.list(user, query);
  }

  @Get("receipts/tags")
  @ApiOperation({ summary: "Receipt tag catalog" })
  tags() {
    return this.receipts.tags();
  }

  @Get("receipts/evidence")
  @ApiOperation({ summary: "VAT Box 4 proof and ITSA allowable-expense receipt counts" })
  evidence(@CurrentUser() user: AuthUser, @Query() query: ReceiptEvidenceQueryDto) {
    return this.receipts.evidence(user, query);
  }

  @Get("receipts/:id")
  @ApiOperation({ summary: "Get a receipt and its OCR fields" })
  get(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.receipts.get(user, id);
  }

  @Patch("receipts/:id/tags")
  @ApiOperation({ summary: "Replace receipt tags" })
  updateTags(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateReceiptTagsDto,
  ) {
    return this.receipts.updateTags(user, id, dto);
  }

  @Get("receipts/:id/file")
  @ApiOperation({ summary: "Download the stored receipt file" })
  async file(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Res() response: Response,
  ) {
    const file = await this.receipts.file(user, id);
    response.setHeader("Content-Type", file.contentType);
    response.setHeader("Content-Disposition", `inline; filename="${file.fileName}"`);
    response.send(file.buffer);
  }

  @Get("receipts/:id/ocr")
  @ApiOperation({ summary: "Get structured OCR fields extracted from a receipt" })
  getOcr(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.receipts.getOcr(user, id);
  }

  @Post("receipts/:id/ocr/reprocess")
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: "Re-run OCR extraction and feed categorisation and matching" })
  reprocessOcr(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.receipts.reprocessOcr(user, id);
  }

  @Get("receipts/:id/suggestions")
  @ApiOperation({ summary: "Suggest bank transactions from OCR merchant, amount, and date" })
  suggestions(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.receipts.suggestions(user, id);
  }

  @Post("receipts/:id/attach/bank-transaction/:transactionId")
  @ApiOperation({ summary: "Attach a receipt to a bank transaction" })
  attachBank(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("transactionId", ParseUUIDPipe) transactionId: string,
  ) {
    return this.attachments.attachToBankTransaction(user, id, transactionId).then((row) => this.receipts.publicReceipt(row));
  }

  @Post("receipts/:id/attach/invoice/:invoiceId")
  @ApiOperation({ summary: "Attach a receipt to a sales invoice" })
  attachInvoice(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("invoiceId", ParseUUIDPipe) invoiceId: string,
  ) {
    return this.attachments.attachToInvoice(user, id, invoiceId).then((row) => this.receipts.publicReceipt(row));
  }

  @Post("receipts/:id/attach/bill/:billId")
  @ApiOperation({ summary: "Attach a receipt to a purchase bill" })
  attachBill(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("billId", ParseUUIDPipe) billId: string,
  ) {
    return this.attachments.attachToBill(user, id, billId).then((row) => this.receipts.publicReceipt(row));
  }

  @Post("receipts/:id/attach/journal/:journalEntryId")
  @ApiOperation({ summary: "Attach a receipt to a journal entry" })
  attachJournal(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("journalEntryId", ParseUUIDPipe) journalEntryId: string,
  ) {
    return this.attachments.attachToJournal(user, id, journalEntryId).then((row) => this.receipts.publicReceipt(row));
  }

  @Post("receipts/:id/detach")
  @ApiOperation({ summary: "Detach a receipt from all bookkeeping records" })
  detach(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.attachments.detach(user, id).then((row) => this.receipts.publicReceipt(row));
  }

  @Get("bank-transactions/:id/receipts")
  @ApiOperation({ summary: "List receipts attached to a bank transaction" })
  bankReceipts(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.receipts.listForBankTransaction(user, id);
  }

  @Get("invoices/:id/receipts")
  @ApiOperation({ summary: "List receipts attached to an invoice" })
  invoiceReceipts(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.receipts.listForInvoice(user, id);
  }

  @Get("bills/:id/receipts")
  @ApiOperation({ summary: "List receipts attached to a bill" })
  billReceipts(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.receipts.listForBill(user, id);
  }

  @Get("journals/:id/receipts")
  @ApiOperation({ summary: "List receipts attached to a journal entry" })
  journalReceipts(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.receipts.listForJournal(user, id);
  }
}
