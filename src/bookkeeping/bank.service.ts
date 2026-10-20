import { Injectable, NotFoundException } from "@nestjs/common";
import { BankTxnStatus, JournalSource, ReconciliationStatus } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { ClientsService } from "../clients/clients.service";
import { AuthUser } from "../common/types";
import { defaultProfileForClientType } from "../ledger/chart-of-accounts.catalog";
import { BookkeepingError, BK_ERR } from "./bookkeeping.errors";
import { BookkeepingRepository } from "./bookkeeping.repository";
import {
  BankSplitDto,
  CreateBankAccountDto,
  ImportBankDto,
  ReconcileBankDto,
  ReconciliationIgnoreDto,
  ReconciliationMatchDto,
  ReconciliationQueryDto,
  ReconciliationSummaryQueryDto,
} from "./dto/bookkeeping.dto";
import { LedgerSnapshot } from "./domain/journal.rules";
import {
  ImportedBankLine,
  parseBankCsv,
  parseBankOfx,
  suggestMatches,
} from "./domain/matching.engine";
import { money, parseDate, sumMoney } from "./domain/money";
import { bankPaymentLines, bankReceiptLines, controlCodes, requireAccount } from "./domain/posting";
import { JournalService } from "./journal.service";

@Injectable()
export class BankService {
  constructor(
    private readonly repo: BookkeepingRepository,
    private readonly clients: ClientsService,
    private readonly journals: JournalService,
    private readonly audit: AuditService,
  ) {}

  async listAccounts(user: AuthUser, clientId: string) {
    await this.clients.get(user, clientId);
    const accounts = await this.repo.listBankAccounts(clientId);
    const counts = await this.repo.countTransactionsByStatus(accounts.map((account) => account.id));
    return accounts.map((account) => this.publicAccount(account, counts));
  }

  async createAccount(user: AuthUser, dto: CreateBankAccountDto) {
    const client = await this.clients.get(user, dto.clientId);
    const account = await this.repo.createBankAccount({
      firm: { connect: { id: client.firmId } },
      client: { connect: { id: client.id } },
      name: dto.name,
      sortCode: dto.sortCode,
      accountNumber: dto.accountNumber,
      provider: dto.provider,
      externalId: dto.externalId,
      ledgerId: dto.ledgerId,
    });
    await this.audit.record({
      actor: user,
      clientId: client.id,
      actionType: "bookkeeping.bank.account.created",
      metadata: { bankAccountId: account.id },
    });
    return account;
  }

  async transactions(user: AuthUser, bankAccountId: string) {
    const account = await this.requireBankAccount(user, bankAccountId);
    const [rows, journals] = await Promise.all([
      this.repo.listBankTransactions(account.id),
      this.repo.listJournals(account.clientId),
    ]);
    const suggestions = suggestMatches(
      rows.map((row) => ({
        id: row.id,
        date: row.date,
        amount: Number(row.amount),
        type: row.type,
        description: row.description,
        status: row.status,
      })),
      journals.map((journal) => ({
        id: journal.id,
        date: journal.date,
        description: journal.description,
        reference: journal.reference,
        total: journalGross(journal.lines),
      })),
    );
    return {
      account: this.publicAccount({ ...account, _count: { transactions: rows.length } }, this.countsFromRows(account.id, rows)),
      transactions: rows.map((row) => this.publicTransaction(row)),
      suggestions: this.decorateSuggestions(suggestions, journals),
    };
  }

  async suggestions(user: AuthUser, query: ReconciliationQueryDto) {
    if (query.bankAccountId) {
      const feed = await this.transactions(user, query.bankAccountId);
      return {
        accounts: [feed.account],
        transactions: feed.transactions,
        suggestions: feed.suggestions,
      };
    }
    if (!query.clientId) {
      throw new BookkeepingError(BK_ERR.INVALID_ACCOUNT, "clientId or bankAccountId is required");
    }
    const accounts = await this.listAccounts(user, query.clientId);
    const packs = await Promise.all(accounts.map((account) => this.transactions(user, account.id)));
    return {
      accounts,
      transactions: packs.flatMap((pack) => pack.transactions),
      suggestions: packs.flatMap((pack) => pack.suggestions),
    };
  }

  async matchOne(user: AuthUser, dto: ReconciliationMatchDto) {
    const txn = await this.requireTransaction(user, dto.bankTransactionId);
    this.assertOpen(txn);
    const journal = await this.repo.findJournal(dto.journalEntryId);
    if (!journal || journal.clientId !== txn.bankAccount.clientId) {
      throw new BookkeepingError(BK_ERR.INVALID_ACCOUNT, "Journal does not belong to this client");
    }
    const updated = await this.repo.updateBankTransaction(txn.id, {
      matchedJournal: { connect: { id: journal.id } },
      status: BankTxnStatus.MATCHED,
    });
    await this.audit.record({
      actor: user,
      clientId: txn.bankAccount.clientId,
      actionType: "bookkeeping.reconciliation.matched",
      resourceType: "bank_transaction",
      resourceId: txn.id,
      beforeData: { status: txn.status, matchedJournalEntryId: txn.matchedJournalEntryId ?? null },
      afterData: { status: BankTxnStatus.MATCHED, matchedJournalEntryId: journal.id },
      metadata: { bankTransactionId: txn.id, journalEntryId: journal.id },
    });
    return { transaction: this.publicTransaction(updated), journal };
  }

  async ignoreOne(user: AuthUser, dto: ReconciliationIgnoreDto) {
    const txn = await this.requireTransaction(user, dto.bankTransactionId);
    const updated = await this.repo.updateBankTransaction(txn.id, {
      status: BankTxnStatus.IGNORED,
      matchedJournal: { disconnect: true },
    });
    await this.audit.record({
      actor: user,
      clientId: txn.bankAccount.clientId,
      actionType: "bookkeeping.reconciliation.ignored",
      metadata: { bankTransactionId: txn.id },
    });
    return { transaction: this.publicTransaction(updated) };
  }

  async splitOne(user: AuthUser, dto: BankSplitDto) {
    const txn = await this.requireTransaction(user, dto.bankTransactionId);
    this.assertOpen(txn);
    const client = await this.clients.get(user, txn.bankAccount.clientId);
    const journal = await this.postSplit(user, client, txn.bankAccount, txn, dto);
    await this.audit.record({
      actor: user,
      clientId: client.id,
      actionType: "bookkeeping.reconciliation.split",
      metadata: { bankTransactionId: txn.id, journalId: journal.id },
    });
    const updated = await this.repo.findBankTransaction(txn.id);
    return { transaction: this.publicTransaction(updated!), journal };
  }

  async summary(user: AuthUser, query: ReconciliationSummaryQueryDto) {
    const account = await this.requireBankAccount(user, query.bankAccountId);
    const client = await this.clients.get(user, account.clientId);
    const ledgers = await this.repo.listLedgers(client.id);
    const profile = defaultProfileForClientType(client.type);
    const bankLedger = account.ledgerId
      ? (ledgers.find((item) => item.id === account.ledgerId) as (LedgerSnapshot & { currentBalance?: unknown }) | undefined)
      : requireAccount(ledgers as LedgerSnapshot[], controlCodes(profile).bank, profile);
    const rows = await this.repo.listBankTransactions(account.id);
    const dates = rows.map((row) => row.date.toISOString().slice(0, 10)).sort();
    const periodStart = query.periodStart ?? dates[0] ?? new Date().toISOString().slice(0, 10);
    const periodEnd = query.periodEnd ?? dates[dates.length - 1] ?? periodStart;
    const report = this.reconciliationReport(rows, { currentBalance: Number((bankLedger as { currentBalance?: unknown } | null)?.currentBalance ?? 0) }, {
      periodStart,
      periodEnd,
      statementBalance: query.statementBalance,
    });
    const reconciled = rows.filter((row) => row.status === "MATCHED" || row.status === "RECONCILED" || row.status === "IGNORED");
    return {
      account: this.publicAccount(account),
      periodStart,
      periodEnd,
      total: rows.length,
      reconciledCount: reconciled.length,
      remainingCount: report.unmatchedCount,
      unmatchedCount: report.unmatchedCount,
      matchedCount: rows.filter((row) => row.status === "MATCHED" || row.status === "RECONCILED").length,
      ignoredCount: rows.filter((row) => row.status === "IGNORED").length,
      bankCredits: report.bankCredits,
      bankDebits: report.bankDebits,
      ledgerBalance: report.ledgerBalance,
      statementBalance: report.statementBalance,
      variance: report.difference,
      unmatched: report.unmatched.map((row) => this.publicTransaction(row as never)),
    };
  }

  async import(user: AuthUser, bankAccountId: string, dto: ImportBankDto) {
    const account = await this.requireBankAccount(user, bankAccountId);
    const imported = this.parseImport(dto);
    await this.repo.createBankTransactions(
      account.id,
      imported.map((row) => ({
        date: parseDate(row.date),
        amount: row.amount,
        type: row.type,
        description: row.description,
        externalRef: row.externalRef,
      })),
    );
    await this.audit.record({
      actor: user,
      clientId: account.clientId,
      actionType: "bookkeeping.bank.imported",
      metadata: { bankAccountId: account.id, count: imported.length, format: dto.format ?? "csv" },
    });
    return this.transactions(user, account.id);
  }

  async reconcile(user: AuthUser, bankAccountId: string, dto: ReconcileBankDto) {
    const account = await this.requireBankAccount(user, bankAccountId);
    const client = await this.clients.get(user, account.clientId);
    const ledgers = await this.repo.listLedgers(client.id);
    const profile = defaultProfileForClientType(client.type);
    const bankLedger = account.ledgerId
      ? (ledgers.find((item) => item.id === account.ledgerId) as LedgerSnapshot | undefined)
      : requireAccount(ledgers as LedgerSnapshot[], controlCodes(profile).bank, profile);

    if (!bankLedger) {
      throw new BookkeepingError(BK_ERR.INVALID_ACCOUNT, "Bank ledger account is missing");
    }

    for (const match of dto.matches ?? []) {
      await this.repo.updateBankTransaction(match.bankTransactionId, {
        matchedJournal: { connect: { id: match.journalEntryId } },
        status: BankTxnStatus.MATCHED,
      });
    }

    for (const id of dto.ignores ?? []) {
      await this.repo.updateBankTransaction(id, { status: BankTxnStatus.IGNORED, matchedJournal: { disconnect: true } });
    }

    for (const split of dto.splits ?? []) {
      const txn = (await this.repo.findBankTransactions([split.bankTransactionId]))[0];
      if (!txn) {
        throw new BookkeepingError(BK_ERR.TRANSACTION_NOT_FOUND, "Bank transaction not found for split");
      }
      await this.postSplit(user, client, account, txn, split, profile, bankLedger);
    }

    if (dto.autoPostUnmatched) {
      const open = (await this.repo.listBankTransactions(account.id)).filter((row) => row.status === "UNMATCHED");
      const controls = controlCodes(profile);
      const income = requireAccount(ledgers as LedgerSnapshot[], controls.defaultIncome, profile);
      const expense = requireAccount(ledgers as LedgerSnapshot[], controls.defaultExpense, profile);
      for (const txn of open) {
        const counterpart = txn.type === "CREDIT" ? income : expense;
        const lines =
          txn.type === "CREDIT"
            ? bankReceiptLines(bankLedger, counterpart, Number(txn.amount), txn.description)
            : bankPaymentLines(bankLedger, counterpart, Number(txn.amount), txn.description);
        const journal = await this.journals.post(user, {
          clientId: client.id,
          firmId: client.firmId,
          date: txn.date.toISOString().slice(0, 10),
          description: txn.description,
          source: JournalSource.BANK_FEED,
          lines,
          profile,
        });
        await this.repo.updateBankTransaction(txn.id, {
          matchedJournal: { connect: { id: journal.id } },
          status: BankTxnStatus.MATCHED,
        });
      }
    }

    const periodRows = (await this.repo.listBankTransactions(account.id)).filter((row) => {
      const iso = row.date.toISOString().slice(0, 10);
      return iso >= dto.periodStart && iso <= dto.periodEnd;
    });
    const matchedIds = periodRows.filter((row) => row.status === "MATCHED" || row.status === "RECONCILED").map((row) => row.id);
    if (matchedIds.length > 0) {
      await this.repo.markReconciled(matchedIds);
    }

    const session = await this.repo.createReconciliation({
      bankAccount: { connect: { id: account.id } },
      periodStart: parseDate(dto.periodStart),
      periodEnd: parseDate(dto.periodEnd),
      status: ReconciliationStatus.COMPLETE,
      createdByUserId: user.id,
      statementBalance: dto.statementBalance,
    });

    const refreshed = await this.repo.listBankTransactions(account.id);
    const report = this.reconciliationReport(refreshed, { currentBalance: Number((bankLedger as { currentBalance?: unknown }).currentBalance ?? 0) }, dto);
    await this.audit.record({
      actor: user,
      clientId: client.id,
      actionType: "bookkeeping.bank.reconciled",
      metadata: { bankAccountId: account.id, sessionId: session.id },
    });
    return { session, report, transactions: refreshed };
  }

  private async postSplit(
    user: AuthUser,
    client: { id: string; firmId: string; type: Parameters<typeof defaultProfileForClientType>[0] },
    account: { id: string; ledgerId?: string | null; clientId: string },
    txn: { id: string; date: Date; amount: unknown; type: string; description: string },
    split: BankSplitDto,
    profile = defaultProfileForClientType(client.type),
    bankLedger?: LedgerSnapshot,
  ) {
    const ledgers = await this.repo.listLedgers(client.id);
    const bank =
      bankLedger ??
      (account.ledgerId
        ? (ledgers.find((item) => item.id === account.ledgerId) as LedgerSnapshot | undefined)
        : requireAccount(ledgers as LedgerSnapshot[], controlCodes(profile).bank, profile));
    if (!bank) {
      throw new BookkeepingError(BK_ERR.INVALID_ACCOUNT, "Bank ledger account is missing");
    }
    const allocated = money(sumMoney(split.allocations.map((item) => item.amount)));
    if (allocated !== money(Number(txn.amount))) {
      throw new BookkeepingError(BK_ERR.UNBALANCED_JOURNAL, "Split allocations must equal the bank amount");
    }
    const lines =
      txn.type === "CREDIT"
        ? [
            { ledgerAccountId: bank.id, debit: allocated, credit: 0, description: txn.description },
            ...split.allocations.map((item) => ({
              ledgerAccountId: item.ledgerAccountId,
              debit: 0,
              credit: item.amount,
              taxCodeId: item.taxCodeId,
              description: item.description ?? txn.description,
            })),
          ]
        : [
            ...split.allocations.map((item) => ({
              ledgerAccountId: item.ledgerAccountId,
              debit: item.amount,
              credit: 0,
              taxCodeId: item.taxCodeId,
              description: item.description ?? txn.description,
            })),
            { ledgerAccountId: bank.id, debit: 0, credit: allocated, description: txn.description },
          ];
    const journal = await this.journals.post(user, {
      clientId: client.id,
      firmId: client.firmId,
      date: txn.date.toISOString().slice(0, 10),
      description: `Split ${txn.description}`,
      source: JournalSource.BANK_FEED,
      lines,
      profile,
    });
    await this.repo.updateBankTransaction(txn.id, {
      matchedJournal: { connect: { id: journal.id } },
      status: BankTxnStatus.MATCHED,
    });
    return journal;
  }

  private reconciliationReport(
    rows: Array<{ id?: string; date: Date; amount: unknown; type: string; status: string; description: string }>,
    bankLedger: { currentBalance?: unknown },
    dto: { periodStart: string; periodEnd: string; statementBalance?: number },
  ) {
    const inPeriod = rows.filter((row) => {
      const iso = row.date.toISOString().slice(0, 10);
      return iso >= dto.periodStart && iso <= dto.periodEnd;
    });
    const credits = sumMoney(inPeriod.filter((row) => row.type === "CREDIT").map((row) => Number(row.amount)));
    const debits = sumMoney(inPeriod.filter((row) => row.type === "DEBIT").map((row) => Number(row.amount)));
    const unmatched = inPeriod.filter((row) => row.status === "UNMATCHED");
    const ledgerBalance = money(Number(bankLedger.currentBalance ?? 0));
    const statementBalance = dto.statementBalance ?? money(credits - debits);
    return {
      periodStart: dto.periodStart,
      periodEnd: dto.periodEnd,
      bankCredits: credits,
      bankDebits: debits,
      unmatchedCount: unmatched.length,
      unmatched,
      ledgerBalance,
      statementBalance,
      difference: money(statementBalance - ledgerBalance),
    };
  }

  private parseImport(dto: ImportBankDto): ImportedBankLine[] {
    if (dto.transactions?.length) {
      return dto.transactions.map((row) => ({ ...row, amount: money(row.amount) }));
    }
    if (!dto.payload) {
      return [];
    }
    if ((dto.format ?? "csv") === "ofx" || dto.payload.includes("<STMTTRN>")) {
      return parseBankOfx(dto.payload);
    }
    return parseBankCsv(dto.payload);
  }

  private async requireBankAccount(user: AuthUser, id: string) {
    const account = await this.repo.findBankAccount(id);
    if (!account) {
      throw new NotFoundException("Bank account not found");
    }
    await this.clients.get(user, account.clientId);
    return account;
  }

  private async requireTransaction(user: AuthUser, id: string) {
    const txn = await this.repo.findBankTransaction(id);
    if (!txn) {
      throw new BookkeepingError(BK_ERR.TRANSACTION_NOT_FOUND, "Bank transaction not found");
    }
    await this.clients.get(user, txn.bankAccount.clientId);
    return txn;
  }

  private assertOpen(txn: { status: string }) {
    if (txn.status !== BankTxnStatus.UNMATCHED) {
      throw new BookkeepingError(BK_ERR.ALREADY_MATCHED, "Bank transaction is already matched or ignored");
    }
  }

  private publicAccount(
    account: {
      id: string;
      clientId: string;
      name: string;
      sortCode?: string | null;
      accountNumber?: string | null;
      provider?: string | null;
      externalId?: string | null;
      currency?: string | null;
      balance?: unknown;
      ledgerId?: string | null;
      createdAt: Date;
      updatedAt?: Date;
      _count?: { transactions: number };
    },
    counts: Array<{ bankAccountId: string; status: string; _count: { _all: number } }> = [],
  ) {
    const rows = counts.filter((row) => row.bankAccountId === account.id);
    const byStatus = (status: string) => rows.find((row) => row.status === status)?._count._all ?? 0;
    const unmatchedCount = byStatus("UNMATCHED");
    const matchedCount = byStatus("MATCHED");
    const ignoredCount = byStatus("IGNORED");
    const reconciledCount = byStatus("RECONCILED");
    return {
      id: account.id,
      clientId: account.clientId,
      name: account.name,
      sortCode: account.sortCode ?? null,
      accountNumber: account.accountNumber ?? null,
      provider: account.provider ?? null,
      externalId: account.externalId ?? null,
      currency: account.currency ?? "GBP",
      balance: Number(account.balance ?? 0),
      ledgerId: account.ledgerId ?? null,
      transactionCount: account._count?.transactions ?? unmatchedCount + matchedCount + ignoredCount + reconciledCount,
      unmatchedCount,
      matchedCount,
      ignoredCount,
      reconciledCount,
      lastSyncAt: account.updatedAt ?? account.createdAt,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };
  }

  private publicTransaction(row: {
    id: string;
    bankAccountId?: string;
    date: Date | string;
    amount: unknown;
    type: string;
    description: string;
    externalRef?: string | null;
    merchantName?: string | null;
    category?: string | null;
    merchantCategoryCode?: string | null;
    status: string;
    matchedJournalEntryId?: string | null;
    matchedJournal?: { id: string; description: string; reference?: string | null } | null;
  }) {
    return {
      id: row.id,
      bankAccountId: row.bankAccountId,
      date: row.date,
      amount: Number(row.amount),
      type: String(row.type).toUpperCase() === "CREDIT" ? "CREDIT" : "DEBIT",
      description: row.description,
      externalRef: row.externalRef ?? null,
      merchantName: row.merchantName ?? null,
      category: row.category ?? null,
      merchantCategoryCode: row.merchantCategoryCode ?? null,
      status: String(row.status).toUpperCase(),
      matchedJournalEntryId: row.matchedJournalEntryId ?? null,
      matchedJournal: row.matchedJournal
        ? { id: row.matchedJournal.id, description: row.matchedJournal.description, reference: row.matchedJournal.reference ?? null }
        : null,
    };
  }

  private countsFromRows(bankAccountId: string, rows: Array<{ status: string }>) {
    const statuses = ["UNMATCHED", "MATCHED", "IGNORED", "RECONCILED"];
    return statuses.map((status) => ({
      bankAccountId,
      status,
      _count: { _all: rows.filter((row) => String(row.status).toUpperCase() === status).length },
    }));
  }

  private decorateSuggestions(
    suggestions: Array<{ bankTransactionId: string; journalEntryId: string; score: number; reasons: string[] }>,
    journals: Array<{
      id: string;
      date: Date;
      description: string;
      reference?: string | null;
      source?: string;
      lines: Array<{ debit: unknown; credit: unknown }>;
    }>,
  ) {
    const byId = new Map(journals.map((journal) => [journal.id, journal]));
    return suggestions.map((item) => {
      const journal = byId.get(item.journalEntryId);
      return {
        ...item,
        journal: journal
          ? {
              id: journal.id,
              date: journal.date,
              description: journal.description,
              reference: journal.reference ?? null,
              source: journal.source ?? null,
              total: journalGross(journal.lines),
            }
          : null,
      };
    });
  }
}

function journalGross(lines: Array<{ debit: unknown; credit: unknown }>): number {
  return money(lines.reduce((total, line) => total + Number(line.debit), 0));
}
