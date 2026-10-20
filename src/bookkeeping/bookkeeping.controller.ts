import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { AuthUser } from "../common/types";
import { BookkeepingService } from "./bookkeeping.service";
import {
  ClientScopedQueryDto,
  CreateBankAccountDto,
  CreateBillDto,
  CreateChartAccountDto,
  CreateInvoiceDto,
  CreateJournalDto,
  CreatePeriodDto,
  ImportBankDto,
  ItsaSummaryQueryDto,
  ListJournalsQueryDto,
  PatchChartAccountDto,
  PeriodQueryDto,
  ReconcileBankDto,
  VatSummaryQueryDto,
} from "./dto/bookkeeping.dto";

@ApiTags("bookkeeping")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("bookkeeping")
export class BookkeepingController {
  constructor(private readonly bookkeeping: BookkeepingService) {}

  @Get("chart-of-accounts")
  @ApiOperation({ summary: "List chart of accounts templates and optional client ledgers" })
  listChart(@CurrentUser() user: AuthUser, @Query("clientId") clientId?: string, @Query("profile") profile?: string) {
    return this.bookkeeping.listChart(user, clientId, profile);
  }

  @Post("chart-of-accounts")
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Create a chart of accounts code" })
  createChart(@CurrentUser() user: AuthUser, @Body() dto: CreateChartAccountDto) {
    return this.bookkeeping.createChart(user, dto);
  }

  @Patch("chart-of-accounts/:id")
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Update a chart of accounts code" })
  patchChart(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string, @Body() dto: PatchChartAccountDto) {
    return this.bookkeeping.patchChart(user, id, dto);
  }

  @Get("ledger/trial-balance")
  @ApiOperation({ summary: "Trial balance for a client period" })
  trialBalance(@CurrentUser() user: AuthUser, @Query() query: PeriodQueryDto) {
    return this.bookkeeping.trialBalance(user, query);
  }

  @Get("ledger/profit-and-loss")
  @ApiOperation({ summary: "Profit and loss for a client period" })
  profitAndLoss(@CurrentUser() user: AuthUser, @Query() query: PeriodQueryDto) {
    return this.bookkeeping.profitAndLoss(user, query);
  }

  @Get("ledger/balance-sheet")
  @ApiOperation({ summary: "Balance sheet as at period end" })
  balanceSheet(@CurrentUser() user: AuthUser, @Query() query: PeriodQueryDto) {
    return this.bookkeeping.balanceSheet(user, query);
  }

  @Get("journals")
  @ApiOperation({ summary: "List journal entries" })
  listJournals(@CurrentUser() user: AuthUser, @Query() query: ListJournalsQueryDto) {
    return this.bookkeeping.listJournals(user, query);
  }

  @Post("journals")
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Post a balanced double-entry journal" })
  createJournal(@CurrentUser() user: AuthUser, @Body() dto: CreateJournalDto) {
    return this.bookkeeping.createJournal(user, dto);
  }

  @Get("journals/:id")
  @ApiOperation({ summary: "Get a journal entry with lines" })
  getJournal(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.bookkeeping.getJournal(user, id);
  }

  @Get("bank/accounts")
  @ApiOperation({ summary: "List bank accounts for a client" })
  bankAccounts(@CurrentUser() user: AuthUser, @Query() query: ClientScopedQueryDto) {
    return this.bookkeeping.listBankAccounts(user, query.clientId);
  }

  @Post("bank/accounts")
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Create a bank account" })
  createBankAccount(@CurrentUser() user: AuthUser, @Body() dto: CreateBankAccountDto) {
    return this.bookkeeping.createBankAccount(user, dto);
  }

  @Get("bank/accounts/:id/transactions")
  @ApiOperation({ summary: "List bank transactions and suggested matches" })
  bankTransactions(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.bookkeeping.bankTransactions(user, id);
  }

  @Post("bank/accounts/:id/import")
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Import a bank feed (CSV, OFX, or API payload)" })
  importBank(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string, @Body() dto: ImportBankDto) {
    return this.bookkeeping.importBank(user, id, dto);
  }

  @Post("bank/accounts/:id/reconcile")
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Match, split, ignore, and reconcile bank transactions" })
  reconcile(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string, @Body() dto: ReconcileBankDto) {
    return this.bookkeeping.reconcile(user, id, dto);
  }

  @Get("vat/summary")
  @ApiOperation({ summary: "VAT boxes 1, 4, 6 and 7 from posted journals for the MTD VAT engine" })
  vatSummary(@CurrentUser() user: AuthUser, @Query() query: VatSummaryQueryDto) {
    return this.bookkeeping.vatSummary(user, query);
  }

  @Get("itsa/summary")
  @ApiOperation({ summary: "ITSA income and expense totals from posted journals for the MTD ITSA engine" })
  itsaSummary(@CurrentUser() user: AuthUser, @Query() query: ItsaSummaryQueryDto) {
    return this.bookkeeping.itsaSummary(user, query);
  }

  @Get("invoices")
  @ApiOperation({ summary: "List sales invoices" })
  invoices(@CurrentUser() user: AuthUser, @Query() query: ClientScopedQueryDto) {
    return this.bookkeeping.listInvoices(user, query.clientId);
  }

  @Post("invoices")
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Post a sales invoice to income, VAT and debtors" })
  createInvoice(@CurrentUser() user: AuthUser, @Body() dto: CreateInvoiceDto) {
    return this.bookkeeping.createInvoice(user, dto);
  }

  @Get("bills")
  @ApiOperation({ summary: "List purchase bills" })
  bills(@CurrentUser() user: AuthUser, @Query() query: ClientScopedQueryDto) {
    return this.bookkeeping.listBills(user, query.clientId);
  }

  @Post("bills")
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Post a purchase bill to expenses, VAT and creditors" })
  createBill(@CurrentUser() user: AuthUser, @Body() dto: CreateBillDto) {
    return this.bookkeeping.createBill(user, dto);
  }

  @Get("periods")
  @ApiOperation({ summary: "List accounting periods" })
  periods(@CurrentUser() user: AuthUser, @Query() query: ClientScopedQueryDto) {
    return this.bookkeeping.listPeriods(user, query.clientId);
  }

  @Post("periods")
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Create a financial year or custom period" })
  createPeriod(@CurrentUser() user: AuthUser, @Body() dto: CreatePeriodDto) {
    return this.bookkeeping.createPeriod(user, dto);
  }

  @Post("periods/:id/lock")
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: "Lock a period against further postings" })
  lockPeriod(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Query() query: ClientScopedQueryDto,
  ) {
    return this.bookkeeping.lockPeriod(user, query.clientId, id);
  }
}
