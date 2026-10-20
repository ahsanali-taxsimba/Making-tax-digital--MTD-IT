import { Injectable } from "@nestjs/common";
import { AuthUser } from "../common/types";
import { BankService } from "./bank.service";
import { BookkeepingChartService } from "./chart.service";
import {
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
  ReconciliationIgnoreDto,
  ReconciliationMatchDto,
  ReconciliationQueryDto,
  ReconciliationSummaryQueryDto,
  BankSplitDto,
  VatSummaryQueryDto,
} from "./dto/bookkeeping.dto";
import { InvoiceService } from "./invoice.service";
import { JournalService } from "./journal.service";
import { ReportsService } from "./reports.service";

@Injectable()
export class BookkeepingService {
  constructor(
    private readonly charts: BookkeepingChartService,
    private readonly journals: JournalService,
    private readonly invoices: InvoiceService,
    private readonly bank: BankService,
    private readonly reports: ReportsService,
  ) {}

  listChart(user: AuthUser, clientId?: string, profile?: string) {
    return this.charts.list(user, clientId, profile);
  }

  createChart(user: AuthUser, dto: CreateChartAccountDto) {
    return this.charts.create(user, dto);
  }

  patchChart(user: AuthUser, id: string, dto: PatchChartAccountDto) {
    return this.charts.patch(user, id, dto);
  }

  trialBalance(user: AuthUser, query: PeriodQueryDto) {
    return this.reports.trialBalance(user, query);
  }

  profitAndLoss(user: AuthUser, query: PeriodQueryDto) {
    return this.reports.profitAndLoss(user, query);
  }

  balanceSheet(user: AuthUser, query: PeriodQueryDto) {
    return this.reports.balanceSheet(user, query);
  }

  listJournals(user: AuthUser, query: ListJournalsQueryDto) {
    return this.journals.list(user, query);
  }

  getJournal(user: AuthUser, id: string) {
    return this.journals.get(user, id);
  }

  createJournal(user: AuthUser, dto: CreateJournalDto) {
    return this.journals.create(user, dto);
  }

  listBankAccounts(user: AuthUser, clientId: string) {
    return this.bank.listAccounts(user, clientId);
  }

  createBankAccount(user: AuthUser, dto: CreateBankAccountDto) {
    return this.bank.createAccount(user, dto);
  }

  bankTransactions(user: AuthUser, id: string) {
    return this.bank.transactions(user, id);
  }

  importBank(user: AuthUser, id: string, dto: ImportBankDto) {
    return this.bank.import(user, id, dto);
  }

  reconcile(user: AuthUser, id: string, dto: ReconcileBankDto) {
    return this.bank.reconcile(user, id, dto);
  }

  reconciliationSuggestions(user: AuthUser, query: ReconciliationQueryDto) {
    return this.bank.suggestions(user, query);
  }

  matchBankTransaction(user: AuthUser, dto: ReconciliationMatchDto) {
    return this.bank.matchOne(user, dto);
  }

  ignoreBankTransaction(user: AuthUser, dto: ReconciliationIgnoreDto) {
    return this.bank.ignoreOne(user, dto);
  }

  splitBankTransaction(user: AuthUser, dto: BankSplitDto) {
    return this.bank.splitOne(user, dto);
  }

  reconciliationSummary(user: AuthUser, query: ReconciliationSummaryQueryDto) {
    return this.bank.summary(user, query);
  }

  vatSummary(user: AuthUser, query: VatSummaryQueryDto) {
    return this.reports.vatSummary(user, query);
  }

  itsaSummary(user: AuthUser, query: ItsaSummaryQueryDto) {
    return this.reports.itsaSummary(user, query);
  }

  createInvoice(user: AuthUser, dto: CreateInvoiceDto) {
    return this.invoices.createInvoice(user, dto);
  }

  createBill(user: AuthUser, dto: CreateBillDto) {
    return this.invoices.createBill(user, dto);
  }

  listInvoices(user: AuthUser, clientId: string) {
    return this.invoices.listInvoices(user, clientId);
  }

  listBills(user: AuthUser, clientId: string) {
    return this.invoices.listBills(user, clientId);
  }

  createPeriod(user: AuthUser, dto: CreatePeriodDto) {
    return this.charts.createPeriod(user, dto);
  }

  listPeriods(user: AuthUser, clientId: string) {
    return this.charts.listPeriods(user, clientId);
  }

  lockPeriod(user: AuthUser, clientId: string, id: string) {
    return this.charts.lockPeriodForClient(user, clientId, id);
  }
}
