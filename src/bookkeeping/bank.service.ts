import { Injectable, NotFoundException } from "@nestjs/common";
import { BankTxnStatus, JournalSource, ReconciliationStatus } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { ClientsService } from "../clients/clients.service";
import { AuthUser } from "../common/types";
import { defaultProfileForClientType } from "../ledger/chart-of-accounts.catalog";
import { BookkeepingError, BK_ERR } from "./bookkeeping.errors";
import { BookkeepingRepository } from "./bookkeeping.repository";
import {
  CreateBankAccountDto,
  ImportBankDto,
  ReconcileBankDto,
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
    return this.repo.listBankAccounts(clientId);
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
    return { account, transactions: rows, suggestions };
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
        throw new BookkeepingError(BK_ERR.INVALID_ACCOUNT, "Bank transaction not found for split");
      }
      const allocated = money(sumMoney(split.allocations.map((item) => item.amount)));
      if (allocated !== money(Number(txn.amount))) {
        throw new BookkeepingError(BK_ERR.UNBALANCED_JOURNAL, "Split allocations must equal the bank amount");
      }
      const lines =
        txn.type === "CREDIT"
          ? [
              { ledgerAccountId: bankLedger.id, debit: allocated, credit: 0, description: txn.description },
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
              { ledgerAccountId: bankLedger.id, debit: 0, credit: allocated, description: txn.description },
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
    const report = this.reconciliationReport(refreshed, bankLedger, dto);
    await this.audit.record({
      actor: user,
      clientId: client.id,
      actionType: "bookkeeping.bank.reconciled",
      metadata: { bankAccountId: account.id, sessionId: session.id },
    });
    return { session, report, transactions: refreshed };
  }

  private reconciliationReport(
    rows: Array<{ date: Date; amount: unknown; type: string; status: string; description: string }>,
    bankLedger: LedgerSnapshot & { currentBalance?: unknown },
    dto: ReconcileBankDto,
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
}

function journalGross(lines: Array<{ debit: unknown; credit: unknown }>): number {
  return money(lines.reduce((total, line) => total + Number(line.debit), 0));
}
