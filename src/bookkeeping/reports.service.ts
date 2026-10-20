import { Injectable } from "@nestjs/common";
import { ClientsService } from "../clients/clients.service";
import { AuthUser } from "../common/types";
import { toChartProfile } from "../ledger/chart-of-accounts.catalog";
import { BookkeepingRepository } from "./bookkeeping.repository";
import { PeriodQueryDto } from "./dto/bookkeeping.dto";
import { LedgerSnapshot } from "./domain/journal.rules";
import { itsaSummaryFromJournals } from "./domain/itsa-summary";
import { balanceSheet, profitAndLoss, trialBalance } from "./domain/reports";
import { vatSummaryFromJournals } from "./domain/vat-summary";
import { JournalService } from "./journal.service";

@Injectable()
export class ReportsService {
  constructor(
    private readonly repo: BookkeepingRepository,
    private readonly clients: ClientsService,
    private readonly journals: JournalService,
  ) {}

  async trialBalance(user: AuthUser, query: PeriodQueryDto) {
    const { accounts, lines, period } = await this.load(user, query);
    return {
      period,
      rows: trialBalance(accounts, lines, period.start, period.end),
    };
  }

  async profitAndLoss(user: AuthUser, query: PeriodQueryDto) {
    const { accounts, lines, period } = await this.load(user, query);
    const rows = trialBalance(accounts, lines, period.start, period.end);
    return { period, ...profitAndLoss(rows) };
  }

  async balanceSheet(user: AuthUser, query: PeriodQueryDto) {
    const { accounts, lines, period } = await this.load(user, query);
    const rows = trialBalance(accounts, lines, period.start, period.end);
    return { period, ...balanceSheet(rows) };
  }

  async vatSummary(user: AuthUser, query: PeriodQueryDto) {
    const { journals, period } = await this.load(user, query);
    const summary = vatSummaryFromJournals(
      journals.flatMap((entry) =>
        entry.lines.map((line) => ({
          ledger: line.ledger as LedgerSnapshot,
          debit: Number(line.debit),
          credit: Number(line.credit),
          tax: line.taxCode
            ? { id: line.taxCode.id, code: line.taxCode.code, name: line.taxCode.name, rate: Number(line.taxCode.rate), type: line.taxCode.type }
            : null,
        })),
      ),
    );
    return { period, ...summary };
  }

  async itsaSummary(user: AuthUser, query: PeriodQueryDto & { businessType?: string }) {
    const { journals, period } = await this.load(user, query);
    const summary = itsaSummaryFromJournals(
      journals.flatMap((entry) =>
        entry.lines.map((line) => ({
          ledger: line.ledger as LedgerSnapshot,
          debit: Number(line.debit),
          credit: Number(line.credit),
        })),
      ),
      query.businessType,
    );
    return { period, ...summary };
  }

  private async load(user: AuthUser, query: PeriodQueryDto) {
    await this.clients.get(user, query.clientId);
    const period = this.journals.resolvePeriod(query);
    const start = period.start ?? "1900-01-01";
    const end = period.end ?? "9999-12-31";
    const profile = query.profile ? toChartProfile(query.profile) : undefined;
    const [accounts, journals] = await Promise.all([
      this.repo.listLedgers(query.clientId, profile),
      this.repo.listJournals(query.clientId, this.repo.toDate(start), this.repo.toDate(end)),
    ]);
    const lines = journals.flatMap((entry) =>
      entry.lines.map((line) => ({
        ledgerAccountId: line.ledgerAccountId,
        debit: Number(line.debit),
        credit: Number(line.credit),
        date: entry.date,
      })),
    );
    return {
      accounts: accounts.map((account) => ({ ...account, openingBalance: Number(account.openingBalance) })) as Array<
        LedgerSnapshot & { openingBalance: number }
      >,
      journals,
      lines,
      period: { start, end, financialYear: query.financialYear ?? inferFinancialYear(start) },
    };
  }
}

function inferFinancialYear(start: string): string | undefined {
  if (start === "1900-01-01") {
    return undefined;
  }
  try {
    const year = Number(start.slice(0, 4));
    const monthDay = start.slice(5);
    const taxYearStart = monthDay >= "04-06" ? year : year - 1;
    return `${taxYearStart}-${String(taxYearStart + 1).slice(2)}`;
  } catch {
    return undefined;
  }
}
